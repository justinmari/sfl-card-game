'use server'

import { createClient } from '@/lib/supabase/server'
import { type BattlePlayer, type RoundResult, precomputeRound } from '@/lib/battle-engine'
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

  // Try to create session (ON CONFLICT returns existing)
  const { data: existing } = await supabase
    .from('arena_sessions')
    .select('id, seed, players, hp')
    .eq('lobby_id', lobbyId)
    .single()

  if (existing) {
    // Session already exists — return it with round 1
    const { data: round1 } = await supabase
      .from('arena_rounds')
      .select('result, skills_used')
      .eq('session_id', existing.id)
      .eq('round_num', 1)
      .single()

    return {
      sessionId: existing.id,
      seed: existing.seed,
      players: existing.players as SessionPlayer[],
      hp: existing.hp as Record<string, number>,
      round: round1?.result as RoundResult | null,
    }
  }

  // Create new session
  const { data: session, error: sessionErr } = await supabase
    .from('arena_sessions')
    .insert({ lobby_id: lobbyId, players, hp })
    .select('id, seed')
    .single()

  if (sessionErr || !session) return null

  // Compute round 1
  const battlePlayers = buildBattlePlayers(players)
  const rng = createSeededRng(session.seed * 1000 + 1)
  const result = precomputeRound(
    battlePlayers.map((p) => ({ ...p, hp: 10, eliminated: false })),
    hp, 1, undefined, undefined, rng,
  )

  // Store round 1
  await supabase.from('arena_rounds').insert({
    session_id: session.id,
    round_num: 1,
    result: result as unknown as Record<string, unknown>,
  })

  return {
    sessionId: session.id,
    seed: session.seed,
    players,
    hp,
    round: result,
  }
}

// Submit ready state + skills for a round
// When all alive players are ready, computes the next round
export async function submitRoundReady(
  sessionId: string,
  roundNum: number,
  skillIds: string[],
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Upsert ready state
  await supabase.from('arena_ready').upsert({
    session_id: sessionId,
    user_id: user.id,
    round_num: roundNum,
    skills: skillIds,
    is_ready: true,
  }, { onConflict: 'session_id,user_id,round_num' })

  // Get session
  const { data: session } = await supabase
    .from('arena_sessions')
    .select('seed, players, hp')
    .eq('id', sessionId)
    .single()

  if (!session) return null

  const hp = session.hp as Record<string, number>
  const sessionPlayers = session.players as SessionPlayer[]
  const aliveIds = sessionPlayers.filter((p) => (hp[p.id] ?? 0) > 0).map((p) => p.id)

  // Check if all alive players are ready
  const { data: readyRows } = await supabase
    .from('arena_ready')
    .select('user_id, skills')
    .eq('session_id', sessionId)
    .eq('round_num', roundNum)
    .eq('is_ready', true)

  const readyIds = new Set((readyRows || []).map((r) => r.user_id))
  const allReady = aliveIds.every((id) => readyIds.has(id))

  if (!allReady) {
    return { ready: true, allReady: false, readyCount: readyIds.size, aliveCount: aliveIds.length }
  }

  // All ready — check if next round already computed (race prevention)
  const nextRound = roundNum + 1
  const { data: existingRound } = await supabase
    .from('arena_rounds')
    .select('result')
    .eq('session_id', sessionId)
    .eq('round_num', nextRound)
    .single()

  if (existingRound) {
    return { ready: true, allReady: true, round: existingRound.result as RoundResult }
  }

  // Collect all skills from ready players
  const allSkills: ActiveSkill[] = []
  for (const row of readyRows || []) {
    const playerSkillIds = (row.skills as string[]) || []
    for (const skillId of playerSkillIds) {
      const skill = SKILL_REGISTRY[skillId]
      if (skill) {
        const player = sessionPlayers.find((p) => p.id === row.user_id)
        const card = player?.deck.find((c) => c.dbSkillIds?.includes(skillId))
        if (card) {
          allSkills.push({ skill, activatedBy: row.user_id, roundActivated: nextRound })
        }
      }
    }
  }

  // Compute next round
  const battlePlayers = buildBattlePlayers(sessionPlayers)
  const rng = createSeededRng(session.seed * 1000 + nextRound)
  const updated = battlePlayers.map((p) => ({
    ...p, hp: hp[p.id] ?? 0, eliminated: (hp[p.id] ?? 0) <= 0,
  }))

  const result = precomputeRound(
    updated, hp, nextRound, undefined,
    allSkills.length > 0 ? allSkills : undefined, rng,
  )

  // Store round
  await supabase.from('arena_rounds').insert({
    session_id: sessionId,
    round_num: nextRound,
    result: result as unknown as Record<string, unknown>,
    skills_used: allSkills as unknown as Record<string, unknown>[],
  })

  return { ready: true, allReady: true, round: result, skills: allSkills }
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
