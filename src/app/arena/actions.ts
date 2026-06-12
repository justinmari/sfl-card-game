'use server'

import { createClient } from '@/lib/supabase/server'
import { type BattlePlayer, type RoundResult, precomputeRound, randomPair } from '@/lib/battle-engine'
import { type ActiveSkill } from '@/lib/skills'
import { createSeededRng } from '@/lib/seeded-random'
import { resolveSkills, SKILL_REGISTRY } from '@/lib/skills'

type SessionPlayer = {
  id: string
  name: string
  avatar_url: string | null
  deck: { id: string; name: string; image_url: string | null; rarity: string; creature_name: string | null; dbSkillIds?: string[] }[]
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
  sessionPlayers.forEach((p) => { hp[p.id] = 10 })

  const { data: rounds } = await supabase
    .from('arena_rounds')
    .select('result')
    .eq('session_id', sessionId)
    .order('round_num')

  if (rounds) {
    for (const round of rounds) {
      const result = round.result as RoundResult
      for (const match of result.matches) {
        // Apply damage from each face-off, stopping at KO
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

  return hp
}

// Check for active session and join/rejoin
export async function checkActiveSession(userId: string, playerName: string, avatarUrl: string | null, deck: SessionPlayer['deck']) {
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('arena_sessions')
    .select('id, seed, players, hp, status')
    .eq('lobby_id', 'arena-lobby')
    .eq('status', 'active')
    .maybeSingle()

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
  }
  const updatedPlayers = [...sessionPlayers, newPlayer]
  const hp = await computeHpFromRounds(supabase, session.id, sessionPlayers)
  hp[userId] = 0 // dead on arrival

  await supabase.from('arena_sessions').update({
    players: updatedPlayers,
    hp,
  }).eq('id', session.id)

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

  // Build initial HP map
  const hp: Record<string, number> = {}
  players.forEach((p) => { hp[p.id] = 10 })

  // Clean up only completed/stale sessions (not active ones)
  await supabase.from('arena_sessions').delete().eq('lobby_id', lobbyId).eq('status', 'done')

  // Try to insert new session (ON CONFLICT ignores if already exists)
  await supabase
    .from('arena_sessions')
    .insert({ lobby_id: lobbyId, players, hp })
    .select()
    .maybeSingle()

  // Always read the current session
  const { data: session } = await supabase
    .from('arena_sessions')
    .select('id, seed, players, hp')
    .eq('lobby_id', lobbyId)
    .single()

  if (!session) return null

  // Return session — round 1 is computed when all players submit ready
  return {
    sessionId: session.id,
    seed: session.seed,
    players: session.players as SessionPlayer[],
    hp: session.hp as Record<string, number>,
  }
}

// Submit ready + skills for a target round
// When all alive players are ready, computes that round
export async function submitRoundReady(
  sessionId: string,
  targetRound: number,
  skillIds: string[],
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

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
  const allReady = waitingForIds.every((id) => readyIds.has(id))

  if (!allReady) {
    return { ready: true, allReady: false, readyCount: readyIds.size, aliveCount: waitingForIds.length }
  }

  // Collect all skills from ready players
  const allSkills: ActiveSkill[] = []
  for (const row of readyRows || []) {
    const playerSkillIds = (row.skills as string[]) || []
    for (const skillId of playerSkillIds) {
      const skill = SKILL_REGISTRY[skillId]
      if (skill) {
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

  // Store round (ON CONFLICT ignore)
  await supabase.from('arena_rounds').insert({
    session_id: sessionId,
    round_num: targetRound,
    result: result as unknown as Record<string, unknown>,
    skills_used: allSkills as unknown as Record<string, unknown>[],
  }).maybeSingle()

  return { ready: true, allReady: true, readyCount: readyIds.size, aliveCount: aliveIds.length, round: result, skills: allSkills }
}

// Update HP in session after a round completes
export async function updateSessionHp(sessionId: string, hp: Record<string, number>) {
  const supabase = await createClient()
  await supabase.from('arena_sessions').update({ hp }).eq('id', sessionId)
}

// Mark session as done
export async function endArenaSession(sessionId: string) {
  const supabase = await createClient()
  await supabase.from('arena_sessions').update({ status: 'done' }).eq('id', sessionId)
}

// Clean up session
export async function cleanupArenaSession(lobbyId: string) {
  const supabase = await createClient()
  await supabase.from('arena_sessions').delete().eq('lobby_id', lobbyId)
}

// Update connected players list (called when presence changes)
export async function updateConnectedPlayers(sessionId: string, connectedIds: string[]) {
  const supabase = await createClient()
  await supabase.from('arena_sessions').update({ connected_players: connectedIds }).eq('id', sessionId)
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

  // Store matchups + computed HP
  await supabase.from('arena_sessions').update({
    matchups: { round: targetRound, pairs, byeId },
    hp,
  }).eq('id', sessionId)

  return { pairs, byeId }
}
