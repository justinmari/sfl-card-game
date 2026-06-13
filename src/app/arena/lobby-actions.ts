'use server'

import { createClient } from '@/lib/supabase/server'
import { isArenaEnabled } from '@/lib/arena-settings'

export type LobbyInfo = {
  id: string
  host_id: string
  name: string
  status: string
  max_players: number
  created_at: string
  player_count: number
  players: { user_id: string; user_name: string; avatar_url: string | null; is_ready: boolean }[]
  connected_ids: string[]
}

// List open lobbies
export async function listLobbies() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('arena_lobbies')
    .select('*, arena_lobby_players(user_id, user_name, avatar_url, is_ready), arena_sessions(connected_players)')
    .in('status', ['waiting', 'active'])
    .order('created_at', { ascending: false })

  // Clean up empty lobbies (players left by closing tabs)
  const emptyIds = (data || [])
    .filter((l) => ((l.arena_lobby_players as any[])?.length || 0) === 0)
    .map((l) => l.id)
  if (emptyIds.length > 0) {
    await supabase.from('arena_lobbies').delete().in('id', emptyIds)
  }

  return (data || []).filter((l) => !emptyIds.includes(l.id)).map((lobby) => ({
    id: lobby.id,
    host_id: lobby.host_id,
    name: lobby.name,
    status: lobby.status,
    max_players: lobby.max_players,
    created_at: lobby.created_at,
    player_count: (lobby.arena_lobby_players as any[])?.length || 0,
    players: (lobby.arena_lobby_players as any[]) || [],
    connected_ids: ((lobby.arena_sessions as any[])?.[0]?.connected_players as string[]) || [],
  })) as LobbyInfo[]
}

// Create a new lobby
export async function createLobby(name: string) {
  if (!(await isArenaEnabled())) return { error: 'Arena is currently disabled' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check if player is already in a lobby
  const { data: existing } = await supabase
    .from('arena_lobby_players')
    .select('lobby_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return { error: 'Already in a lobby' }

  const { data: lobby, error } = await supabase
    .from('arena_lobbies')
    .insert({ host_id: user.id, name: name.trim() || 'Arena Lobby' })
    .select('id')
    .single()

  if (error || !lobby) return null

  return { id: lobby.id }
}

// Join a lobby
export async function joinLobby(lobbyId: string, userName: string, avatarUrl: string | null) {
  if (!(await isArenaEnabled())) return { error: 'Arena is currently disabled' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check if lobby exists and has space
  const { data: lobby } = await supabase
    .from('arena_lobbies')
    .select('id, status, max_players')
    .eq('id', lobbyId)
    .single()

  if (!lobby) return { error: 'Lobby not found' }

  const { count } = await supabase
    .from('arena_lobby_players')
    .select('*', { count: 'exact', head: true })
    .eq('lobby_id', lobbyId)

  if ((count || 0) >= lobby.max_players) return { error: 'Lobby is full' }

  // Leave any existing lobby first
  await supabase.from('arena_lobby_players').delete().eq('user_id', user.id)

  // Join
  const { error } = await supabase.from('arena_lobby_players').insert({
    lobby_id: lobbyId,
    user_id: user.id,
    user_name: userName,
    avatar_url: avatarUrl,
  })

  if (error) return { error: error.message }
  return { success: true, status: lobby.status }
}

// Leave a lobby
export async function leaveLobby(lobbyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  await supabase.from('arena_lobby_players').delete().eq('lobby_id', lobbyId).eq('user_id', user.id)

  // Check if lobby is now empty → delete it
  const { count } = await supabase
    .from('arena_lobby_players')
    .select('*', { count: 'exact', head: true })
    .eq('lobby_id', lobbyId)

  if ((count || 0) === 0) {
    await supabase.from('arena_lobbies').delete().eq('id', lobbyId)
    return { deleted: true }
  }

  // If host left, transfer to next player
  const { data: lobby } = await supabase
    .from('arena_lobbies')
    .select('host_id')
    .eq('id', lobbyId)
    .single()

  if (lobby?.host_id === user.id) {
    const { data: nextPlayer } = await supabase
      .from('arena_lobby_players')
      .select('user_id')
      .eq('lobby_id', lobbyId)
      .order('joined_at')
      .limit(1)
      .single()

    if (nextPlayer) {
      await supabase.from('arena_lobbies').update({ host_id: nextPlayer.user_id }).eq('id', lobbyId)
    }
  }

  return { left: true }
}

// Toggle ready state
export async function toggleReady(lobbyId: string, ready: boolean, deckSlot?: number, deckCards?: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // If readying up with a deck, validate ownership server-side
  let validatedCards = null
  if (ready && deckSlot != null) {
    // Fetch the actual deck from DB
    const { data: deck } = await supabase
      .from('decks')
      .select('card_ids')
      .eq('user_id', user.id)
      .eq('slot', deckSlot)
      .single()

    if (!deck || !deck.card_ids || deck.card_ids.length !== 5) {
      return { error: 'Invalid deck' }
    }

    // Fetch actual card data from DB (not trusting client)
    const { data: cards } = await supabase
      .from('cards')
      .select('id, name, image_url, rarity, creatures(name), card_skills(skill_id)')
      .in('id', deck.card_ids as string[])

    // Verify player owns all cards
    const { data: owned } = await supabase
      .from('user_cards')
      .select('card_id')
      .eq('user_id', user.id)
      .in('card_id', deck.card_ids as string[])
      .gt('count', 0)

    const ownedIds = new Set((owned || []).map((o) => o.card_id))
    const allOwned = (deck.card_ids as string[]).every((id) => ownedIds.has(id))
    if (!allOwned) return { error: 'You don\'t own all cards in this deck' }

    validatedCards = (cards || []).map((c) => {
      const card = c as unknown as {
        id: string; name: string; image_url: string | null; rarity: string
        creatures: { name: string } | null; card_skills: { skill_id: string }[]
      }
      return {
        id: card.id, name: card.name, image_url: card.image_url, rarity: card.rarity,
        creature_name: card.creatures?.name || null,
        dbSkillIds: (card.card_skills || []).map((s) => s.skill_id),
      }
    })
  }

  await supabase.from('arena_lobby_players').update({
    is_ready: ready,
    deck_slot: deckSlot ?? null,
    deck_cards: ready ? validatedCards : null,
  }).eq('lobby_id', lobbyId).eq('user_id', user.id)

  return { success: true }
}

// Kick a player (host only)
export async function kickPlayer(lobbyId: string, targetUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Verify caller is host
  const { data: lobby } = await supabase
    .from('arena_lobbies')
    .select('host_id')
    .eq('id', lobbyId)
    .single()

  if (lobby?.host_id !== user.id) return { error: 'Not the host' }

  await supabase.from('arena_lobby_players').delete().eq('lobby_id', lobbyId).eq('user_id', targetUserId)
  return { success: true }
}

// Start game (host only) — creates arena session
export async function startGame(lobbyId: string) {
  if (!(await isArenaEnabled())) return { error: 'Arena is currently disabled' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Verify caller is host
  const { data: lobby } = await supabase
    .from('arena_lobbies')
    .select('host_id')
    .eq('id', lobbyId)
    .single()

  if (lobby?.host_id !== user.id) return { error: 'Not the host' }

  // Get all players with their decks
  const { data: players } = await supabase
    .from('arena_lobby_players')
    .select('user_id, user_name, avatar_url, deck_cards, is_ready')
    .eq('lobby_id', lobbyId)

  if (!players || players.length < 2) return { error: 'Need at least 2 players' }

  // Check all non-host players are ready
  const othersReady = players.filter((p) => p.user_id !== user.id).every((p) => p.is_ready)
  if (!othersReady) return { error: 'Not all players are ready' }

  // Check all have decks
  const allHaveDecks = players.every((p) => p.deck_cards && (p.deck_cards as any[]).length === 5)
  if (!allHaveDecks) return { error: 'Not all players have selected a deck' }

  // Build session players
  const sessionPlayers = players.map((p) => ({
    id: p.user_id,
    name: p.user_name,
    avatar_url: p.avatar_url,
    deck: p.deck_cards as any[],
  }))

  const hp: Record<string, number> = {}
  sessionPlayers.forEach((p) => { hp[p.id] = 10 })

  // Update lobby status
  await supabase.from('arena_lobbies').update({ status: 'active' }).eq('id', lobbyId)

  // Clean up any old session via RPC
  const { error: deleteErr } = await supabase.rpc('rpc_delete_arena_session_by_lobby', { p_arena_lobby_id: lobbyId })
  if (deleteErr) return { error: `Cleanup failed: ${deleteErr.message}` }

  // Create session via RPC
  const { data: sessionData, error: createErr } = await supabase.rpc('rpc_create_arena_session', {
    p_lobby_id: lobbyId,
    p_arena_lobby_id: lobbyId,
    p_players: sessionPlayers,
    p_hp: hp,
    p_connected_players: players.map((p) => p.user_id),
  })

  if (createErr) return { error: `Session creation failed: ${createErr.message}` }
  const session = sessionData as { id: string; seed: number } | null
  if (!session) return { error: 'Failed to create session (null response)' }

  return {
    sessionId: session.id,
    seed: session.seed,
    players: sessionPlayers,
    hp,
  }
}

// Check if player is in a lobby
export async function getMyLobby() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('arena_lobby_players')
    .select('lobby_id, arena_lobbies(id, status, host_id, name)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) return null

  const lobby = data.arena_lobbies as any
  return {
    lobbyId: data.lobby_id as string,
    status: lobby?.status as string,
    hostId: lobby?.host_id as string,
    name: lobby?.name as string,
  }
}

// Delete a lobby (host only or cleanup)
export async function deleteLobby(lobbyId: string) {
  const supabase = await createClient()
  await supabase.from('arena_lobbies').delete().eq('id', lobbyId)
}

// Close a stale lobby (safe — server validates 1hr+ age and no recent activity)
export async function closeStaleLobby(lobbyId: string) {
  const supabase = await createClient()
  const { data } = await supabase.rpc('rpc_close_stale_lobby', { p_lobby_id: lobbyId })
  return { closed: !!data }
}
