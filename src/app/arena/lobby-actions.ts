'use server'

import { createClient } from '@/lib/supabase/server'
import { isArenaAccessible } from '@/lib/arena-settings'

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
  // Auto-close stale lobbies whenever the list is opened (no manual "close").
  await supabase.rpc('rpc_cleanup_stale_lobbies')
  const { data } = await supabase
    .from('arena_lobbies')
    .select('*, arena_lobby_players(user_id, user_name, avatar_url, is_ready), arena_sessions(connected_players)')
    .in('status', ['waiting', 'active'])
    .order('created_at', { ascending: false })

  // Clean up empty lobbies via RPC (RLS restricts direct delete to host only)
  const emptyIds = (data || [])
    .filter((l) => ((l.arena_lobby_players as any[])?.length || 0) === 0)
    .map((l) => l.id)
  if (emptyIds.length > 0) {
    await supabase.rpc('rpc_cleanup_empty_lobbies', { p_lobby_ids: emptyIds })
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
  if (!(await isArenaAccessible())) return { error: 'Arena is currently disabled' }
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
  if (!(await isArenaAccessible())) return { error: 'Arena is currently disabled' }
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
    await supabase.rpc('rpc_cleanup_empty_lobbies', { p_lobby_ids: [lobbyId] })
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

type Sb = Awaited<ReturnType<typeof createClient>>
type ValidatedDeckCard = { id: string; name: string; image_url: string | null; rarity: string; creature_name: string | null; dbSkillIds: string[] }

// Resolve a player's arena deck authoritatively from the DB: requires the saved
// deck at `slot` to have EXACTLY 5 unique cards, all owned by the player.
// Returns the server-built card list (never trusting any client-supplied card
// data) or an error. Used both when readying up and again at session start so a
// forged arena_lobby_players.deck_cards row can't sneak in unowned cards.
//
// Goes through the rpc_resolve_arena_deck SECURITY DEFINER function: the host
// re-validates OTHER players' decks at game start, and `decks`/`user_cards` are
// RLS-scoped to their owner, so a direct read as the host returns nothing. The
// RPC reads them under definer rights, guarded to lobby co-members.
async function resolveArenaDeck(supabase: Sb, userId: string, deckSlot: number | null | undefined): Promise<{ deck: ValidatedDeckCard[] } | { error: string }> {
  if (deckSlot == null) return { error: 'No deck selected' }
  const { data, error } = await supabase.rpc('rpc_resolve_arena_deck', { p_user_id: userId, p_slot: deckSlot })
  if (error) return { error: error.message }
  const rows = (data as { id: string; name: string; image_url: string | null; rarity: string; creature_name: string | null; skill_ids: string[] | null }[] | null) ?? []
  if (rows.length !== 5) return { error: 'Invalid deck' }
  const deckCards: ValidatedDeckCard[] = rows.map((c) => ({
    id: c.id, name: c.name, image_url: c.image_url, rarity: c.rarity,
    creature_name: c.creature_name, dbSkillIds: c.skill_ids ?? [],
  }))
  return { deck: deckCards }
}

// Toggle ready state
export async function toggleReady(lobbyId: string, ready: boolean, deckSlot?: number, deckCards?: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  let validatedCards: ValidatedDeckCard[] | null = null
  if (ready && deckSlot != null) {
    const resolved = await resolveArenaDeck(supabase, user.id, deckSlot)
    if ('error' in resolved) return { error: resolved.error }
    validatedCards = resolved.deck
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
  if (!(await isArenaAccessible())) return { error: 'Arena is currently disabled' }
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

  // Get all players (deck_cards is client-writable, so we do NOT trust it —
  // we re-resolve each player's deck from their saved deck slot below).
  const { data: players } = await supabase
    .from('arena_lobby_players')
    .select('user_id, user_name, avatar_url, deck_slot, is_ready')
    .eq('lobby_id', lobbyId)

  if (!players || players.length < 2) return { error: 'Need at least 2 players' }

  // Check all non-host players are ready
  const othersReady = players.filter((p) => p.user_id !== user.id).every((p) => p.is_ready)
  if (!othersReady) return { error: 'Not all players are ready' }

  // Re-validate every player's deck server-side (exactly 5 owned cards) and
  // rebuild the authoritative card data — closes the forged-deck exploit.
  const sessionPlayers = []
  for (const p of players) {
    const resolved = await resolveArenaDeck(supabase, p.user_id, p.deck_slot)
    if ('error' in resolved) return { error: `${p.user_name}'s deck is invalid: ${resolved.error}` }
    sessionPlayers.push({ id: p.user_id, name: p.user_name, avatar_url: p.avatar_url, deck: resolved.deck })
  }

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

// Delete a lobby (host only)
export async function deleteLobby(lobbyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: lobby } = await supabase
    .from('arena_lobbies')
    .select('host_id')
    .eq('id', lobbyId)
    .single()

  if (lobby?.host_id !== user.id) return

  await supabase.from('arena_lobbies').delete().eq('id', lobbyId)
}

// Auto-close every stale lobby (1hr+ old, no recent round/ready activity).
// Called whenever lobbies are queried — the arena list and the dashboard badge —
// so dead lobbies clear themselves with no manual action.
export async function cleanupStaleLobbies() {
  const supabase = await createClient()
  await supabase.rpc('rpc_cleanup_stale_lobbies')
}
