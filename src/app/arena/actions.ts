'use server'

import { createClient } from '@/lib/supabase/server'
import { isArenaEnabled } from '@/lib/arena-settings'
import { type BattlePlayer, type RoundResult, precomputeRound, randomPair } from '@/lib/battle-engine'
import { type ActiveSkill } from '@/lib/skills'
import { createSeededRng } from '@/lib/seeded-random'
import { resolveSkills, SKILL_REGISTRY } from '@/lib/skills'

type SessionPlayer = {
  id: string
  name: string
  avatar_url: string | null
  deck: { id: string; name: string; image_url: string | null; rarity: string; creature_name: string | null; dbSkillIds?: string[] }[]
  startingHp?: number // 10 for original players, 0 for late-joining spectators
}

function buildBattlePlayers(sessionPlayers: SessionPlayer[]): BattlePlayer[] {
  return sessionPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    avatar_url: p.avatar_url,
    deck: p.deck.map((c) => ({
      ...c,
      skills: c.dbSkillIds && c.dbSkillIds.length > 0 ? resolveSkills(c.dbSkillIds) : undefined,
    })),
    hp: 10,
    eliminated: false,
  }))
}

// Compute HP from all played rounds (single source of truth)
async function computeHpFromRounds(supabase: Awaited<ReturnType<typeof createClient>>, sessionId: string, sessionPlayers: SessionPlayer[]) {
  const hp: Record<string, number> = {}
  sessionPlayers.forEach((p) => { hp[p.id] = p.startingHp ?? 10 })

  const { data: rounds } = await supabase
    .from('arena_rounds')
    .select('result')
    .eq('session_id', sessionId)
    .order('round_num')

  if (rounds) {
    for (const round of rounds) {
      const result = round.result as RoundResult
      for (const match of result.matches) {
        if (match.hpSnapshots && match.hpSnapshots.length > 0) {
          const finalSnap = match.hpSnapshots[match.hpSnapshots.length - 1]
          Object.assign(hp, finalSnap)
        } else {
          // Legacy fallback for rounds computed before hpSnapshots
          for (const fo of match.faceOffs) {
            if (result.flags?.healInstead) {
              hp[match.player1Id] = Math.min(10, (hp[match.player1Id] ?? 0) + fo.damage1)
              hp[match.player2Id] = Math.min(10, (hp[match.player2Id] ?? 0) + fo.damage2)
            } else {
              hp[match.player1Id] = Math.max(0, (hp[match.player1Id] ?? 0) - fo.damage1)
              hp[match.player2Id] = Math.max(0, (hp[match.player2Id] ?? 0) - fo.damage2)
            }
            if (hp[match.player1Id] <= 0 || hp[match.player2Id] <= 0) break
          }
        }
      }
    }
  }

  return hp
}

// Check for active session and join/rejoin
export async function checkActiveSession(lobbyId: string, userId: string, playerName: string, avatarUrl: string | null, deck: SessionPlayer['deck']) {
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('arena_sessions')
    .select('id, seed, players, hp, status, connected_players, created_at')
    .eq('arena_lobby_id', lobbyId)
    .eq('status', 'active')
    .maybeSingle()

  // Clean up stale sessions with no connected players
  if (session) {
    const connectedPlayers = (session.connected_players as string[]) || []
    if (connectedPlayers.length === 0) {
      await supabase.rpc('rpc_delete_arena_session', { p_lobby_id: 'arena-lobby' })
      return null
    }
  }

  if (!session) return null

  const sessionPlayers = session.players as SessionPlayer[]
  const existingPlayer = sessionPlayers.find((p) => p.id === userId)

  if (existingPlayer) {
    // Reconnecting player — they're already in the session
    // Compute current HP from rounds
    const hp = await computeHpFromRounds(supabase, session.id, sessionPlayers)

    // Get the latest round
    const { data: latestRound } = await supabase
      .from('arena_rounds')
      .select('round_num, result, skills_used')
      .eq('session_id', session.id)
      .order('round_num', { ascending: false })
      .limit(1)
      .maybeSingle()

    return {
      type: 'rejoin' as const,
      sessionId: session.id,
      seed: session.seed,
      players: sessionPlayers,
      hp,
      latestRound: latestRound ? {
        roundNum: latestRound.round_num as number,
        result: latestRound.result as RoundResult,
        skills: (latestRound.skills_used || []) as ActiveSkill[],
      } : null,
    }
  }

  // New player joining as dead spectator
  const newPlayer: SessionPlayer = {
    id: userId,
    name: playerName,
    avatar_url: avatarUrl,
    deck,
    startingHp: 0, // dead on arrival
  }
  const updatedPlayers = [...sessionPlayers, newPlayer]
  const hp = await computeHpFromRounds(supabase, session.id, updatedPlayers)

  // Update session via RPC (players + hp)
  await supabase.rpc('rpc_update_arena_session', {
    p_session_id: session.id,
    p_hp: hp,
    p_players: updatedPlayers,
  })

  const { data: latestRound } = await supabase
    .from('arena_rounds')
    .select('round_num, result, skills_used')
    .eq('session_id', session.id)
    .order('round_num', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    type: 'spectator' as const,
    sessionId: session.id,
    seed: session.seed,
    players: updatedPlayers,
    hp,
    latestRound: latestRound ? {
      roundNum: latestRound.round_num as number,
      result: latestRound.result as RoundResult,
      skills: (latestRound.skills_used || []) as ActiveSkill[],
    } : null,
  }
}

// Create arena session and compute round 1
export async function createArenaSession(lobbyId: string, players: SessionPlayer[]) {
  const supabase = await createClient()

  const hp: Record<string, number> = {}
  players.forEach((p) => { hp[p.id] = 10 })

  // Create session via SECURITY DEFINER RPC (handles cleanup + ON CONFLICT)
  const { data: session } = await supabase.rpc('rpc_create_arena_session', {
    p_lobby_id: lobbyId,
    p_arena_lobby_id: null,
    p_players: players,
    p_hp: hp,
    p_connected_players: players.map((p) => p.id),
  })

  if (!session) return null
  const s = session as { id: string; seed: number; players: SessionPlayer[]; hp: Record<string, number> }
  return { sessionId: s.id, seed: s.seed, players: s.players, hp: s.hp }
}

// Submit ready + skills for a target round
// When all alive players are ready, computes that round
export async function submitRoundReady(
  sessionId: string,
  targetRound: number,
  skillIds: string[],
  connectedPlayerIds?: string[],
) {
  if (!(await isArenaEnabled())) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Update connected players from caller's live presence data
  if (connectedPlayerIds) {
    await supabase.rpc('rpc_update_arena_session', { p_session_id: sessionId, p_connected_players: connectedPlayerIds })
  }

  // Upsert ready state
  await supabase.from('arena_ready').upsert({
    session_id: sessionId,
    user_id: user.id,
    round_num: targetRound,
    skills: skillIds,
    is_ready: true,
  }, { onConflict: 'session_id,user_id,round_num' })

  // Check if this round already computed
  const { data: existingRound } = await supabase
    .from('arena_rounds')
    .select('result, skills_used')
    .eq('session_id', sessionId)
    .eq('round_num', targetRound)
    .maybeSingle()

  if (existingRound) {
    return { ready: true, allReady: true, readyCount: 0, aliveCount: 0, round: existingRound.result as RoundResult, skills: (existingRound.skills_used || []) as ActiveSkill[] }
  }

  // Get session (includes stored matchups + connected players)
  const { data: session } = await supabase
    .from('arena_sessions')
    .select('seed, players, matchups, connected_players')
    .eq('id', sessionId)
    .single()

  if (!session) return null

  const sessionPlayers = session.players as SessionPlayer[]
  // Compute HP from round history (deterministic, no client dependency)
  const hp = await computeHpFromRounds(supabase, sessionId, sessionPlayers)
  const connectedIds = new Set((session.connected_players as string[]) || [])
  const aliveIds = sessionPlayers.filter((p) => (hp[p.id] ?? 0) > 0).map((p) => p.id)
  // Only wait for players who are both alive AND connected
  const waitingForIds = aliveIds.filter((id) => connectedIds.size === 0 || connectedIds.has(id))

  // Check if all connected alive players are ready for this round
  const { data: readyRows } = await supabase
    .from('arena_ready')
    .select('user_id, skills')
    .eq('session_id', sessionId)
    .eq('round_num', targetRound)
    .eq('is_ready', true)

  const readyIds = new Set((readyRows || []).map((r) => r.user_id))
  // Only count alive players as ready (dead players don't count)
  const aliveReadyCount = waitingForIds.filter((id) => readyIds.has(id)).length
  const allReady = waitingForIds.every((id) => readyIds.has(id))

  if (!allReady) {
    return { ready: true, allReady: false, readyCount: aliveReadyCount, aliveCount: waitingForIds.length }
  }

  // Collect all skills from ready players (validated against their actual deck)
  const { data: dbSkillRows } = await supabase.from('skills').select('id, name, description')
  const dbSkillMap = new Map((dbSkillRows || []).map((s) => [s.id, s]))

  const allSkills: ActiveSkill[] = []
  for (const row of readyRows || []) {
    const playerSkillIds = (row.skills as string[]) || []
    // Get this player's deck to validate skills
    const player = sessionPlayers.find((p) => p.id === row.user_id)
    const playerCardSkillIds = new Set(
      (player?.deck || []).flatMap((c) => c.dbSkillIds || [])
    )
    for (const skillId of playerSkillIds) {
      // Only allow skills the player's deck actually has
      if (!playerCardSkillIds.has(skillId)) continue
      const base = SKILL_REGISTRY[skillId]
      if (base) {
        const dbOverride = dbSkillMap.get(skillId)
        const skill = dbOverride ? { ...base, name: dbOverride.name, description: dbOverride.description } : base
        allSkills.push({ skill, activatedBy: row.user_id, roundActivated: targetRound })
      }
    }
  }

  // Use stored matchups as fixed pairings (same ones shown in skill-select)
  const storedMatchups = session.matchups as { round: number; pairs: [string, string][]; byeId: string | null } | null
  const fixedPairings = storedMatchups?.round === targetRound ? { pairs: storedMatchups.pairs, byeId: storedMatchups.byeId } : undefined

  // Compute this round
  const battlePlayers = buildBattlePlayers(sessionPlayers)
  const rng = createSeededRng(session.seed * 1000 + targetRound)
  const updated = battlePlayers.map((p) => ({
    ...p, hp: hp[p.id] ?? 0, eliminated: (hp[p.id] ?? 0) <= 0,
  }))

  const result = precomputeRound(
    updated, hp, targetRound, fixedPairings,
    allSkills.length > 0 ? allSkills : undefined, rng,
  )

  // Store round via SECURITY DEFINER RPC
  await supabase.rpc('rpc_insert_arena_round', {
    p_session_id: sessionId,
    p_round_num: targetRound,
    p_result: result as unknown as Record<string, unknown>,
    p_skills_used: allSkills as unknown as Record<string, unknown>[],
  })

  return { ready: true, allReady: true, readyCount: readyIds.size, aliveCount: aliveIds.length, round: result, skills: allSkills }
}

// Get fresh HP computed from round history
export async function getSessionHp(sessionId: string) {
  const supabase = await createClient()
  const { data: session } = await supabase
    .from('arena_sessions')
    .select('players')
    .eq('id', sessionId)
    .single()
  if (!session) return null
  return computeHpFromRounds(supabase, sessionId, session.players as SessionPlayer[])
}

// Update HP in session after a round completes
export async function updateSessionHp(sessionId: string, hp: Record<string, number>) {
  const supabase = await createClient()
  await supabase.rpc('rpc_update_arena_session', { p_session_id: sessionId, p_hp: hp })
}

// Mark session as done
export async function endArenaSession(sessionId: string) {
  const supabase = await createClient()
  await supabase.rpc('rpc_update_arena_session', { p_session_id: sessionId, p_status: 'done' })
}

// Clean up session
export async function cleanupArenaSession(lobbyId: string) {
  const supabase = await createClient()
  await supabase.rpc('rpc_delete_arena_session', { p_lobby_id: lobbyId })
}

// Update connected players list (called when presence changes)
export async function updateConnectedPlayers(sessionId: string, connectedIds: string[]) {
  const supabase = await createClient()
  await supabase.rpc('rpc_update_arena_session', { p_session_id: sessionId, p_connected_players: connectedIds })
}

// Get matchup preview for a round (pairings only, no full computation)
export async function getMatchupPreview(sessionId: string, targetRound: number) {
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('arena_sessions')
    .select('seed, players, matchups')
    .eq('id', sessionId)
    .single()

  if (!session) return null

  // Return stored matchups if already computed for this round
  const stored = session.matchups as { round: number; pairs: [string, string][]; byeId: string | null } | null
  if (stored && stored.round === targetRound) {
    return { pairs: stored.pairs, byeId: stored.byeId }
  }

  // Compute HP from round history (server-side, deterministic)
  const sessionPlayers = session.players as SessionPlayer[]
  const hp = await computeHpFromRounds(supabase, sessionId, sessionPlayers)

  // Compute and store matchups
  const battlePlayers = buildBattlePlayers(sessionPlayers)
  const rng = createSeededRng(session.seed * 1000 + targetRound)
  const updated = battlePlayers.map((p) => ({
    ...p, hp: hp[p.id] ?? 0, eliminated: (hp[p.id] ?? 0) <= 0,
  }))

  const { pairs, byeId } = randomPair(updated, rng)

  // Store matchups + computed HP via RPC
  await supabase.rpc('rpc_update_arena_session', {
    p_session_id: sessionId,
    p_matchups: { round: targetRound, pairs, byeId },
    p_hp: hp,
  })

  return { pairs, byeId }
}
