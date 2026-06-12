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

// Create arena session and compute round 1
export async function createArenaSession(lobbyId: string, players: SessionPlayer[]) {
  const supabase = await createClient()

  // Build initial HP map
  const hp: Record<string, number> = {}
  players.forEach((p) => { hp[p.id] = 10 })

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
  currentHp?: Record<string, number>,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Update HP if provided
  if (currentHp) {
    await supabase.from('arena_sessions').update({ hp: currentHp }).eq('id', sessionId)
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
    .select('seed, players, hp, matchups, connected_players')
    .eq('id', sessionId)
    .single()

  if (!session) return null

  const hp = session.hp as Record<string, number>
  const sessionPlayers = session.players as SessionPlayer[]
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
export async function getMatchupPreview(sessionId: string, targetRound: number, currentHp?: Record<string, number>) {
  const supabase = await createClient()

  if (currentHp) {
    await supabase.from('arena_sessions').update({ hp: currentHp }).eq('id', sessionId)
  }

  const { data: session } = await supabase
    .from('arena_sessions')
    .select('seed, players, hp, matchups')
    .eq('id', sessionId)
    .single()

  if (!session) return null

  // Return stored matchups if already computed for this round
  const stored = session.matchups as { round: number; pairs: [string, string][]; byeId: string | null } | null
  if (stored && stored.round === targetRound) {
    return { pairs: stored.pairs, byeId: stored.byeId }
  }

  // Compute and store matchups
  const hp = session.hp as Record<string, number>
  const sessionPlayers = session.players as SessionPlayer[]
  const battlePlayers = buildBattlePlayers(sessionPlayers)
  const rng = createSeededRng(session.seed * 1000 + targetRound)
  const updated = battlePlayers.map((p) => ({
    ...p, hp: hp[p.id] ?? 0, eliminated: (hp[p.id] ?? 0) <= 0,
  }))

  const { pairs, byeId } = randomPair(updated, rng)

  // Store in session so submitRoundReady uses the same pairings
  await supabase.from('arena_sessions').update({
    matchups: { round: targetRound, pairs, byeId },
  }).eq('id', sessionId)

  return { pairs, byeId }
}
