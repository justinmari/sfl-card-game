export type { Skill, SkillHooks, FaceOffState, RoundContext, ActiveSkill } from '@/lib/skills'
export { SKILL_REGISTRY, resolveSkills } from '@/lib/skills'

import type { Skill, ActiveSkill, FaceOffState, RoundContext } from '@/lib/skills'
import { seededShuffle } from '@/lib/seeded-random'

export type BattleCard = {
  id: string
  name: string
  image_url: string | null
  rarity: string
  creature_name: string | null
  dbSkillIds?: string[]
  skills?: Skill[]
}

export type BattlePlayer = {
  id: string
  name: string
  avatar_url: string | null
  deck: BattleCard[]
  hp: number
  eliminated: boolean
}

// A single field a skill changed during a face-off, with before/after so the
// UI can animate the transition. side 1 = card1, side 2 = card2.
export type ActivationChange = {
  side: 1 | 2
  field: 'star' | 'roll' | 'effective' | 'damage'
  before: number
  after: number
}
export type ActivationPhase = 'onStars' | 'onDiceOverride' | 'onDice' | 'onTotals' | 'onDamage'
export type SkillActivation = {
  skillId: string
  skillName: string
  phase: ActivationPhase
  changes: ActivationChange[]
}

export type FaceOff = {
  card1: BattleCard
  card2: BattleCard
  damage1: number
  damage2: number
  // Per-skill before/after trace (deterministic; populated by resolveFaceOff).
  activations?: SkillActivation[]
}

export type MatchResult = {
  player1Id: string
  player2Id: string
  faceOffs: FaceOff[]
  winnerId: string | null
  hpSnapshots: Record<string, number>[]
}

export type RoundFlags = {
  healInstead?: boolean
  visualEffect?: string
}

export type RoundResult = {
  round: number
  matches: MatchResult[]
  byePlayerId: string | null
  flags?: RoundFlags
}

export const starCount: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  ultra_rare: 4,
  legendary: 5,
  secret_rare: 6,
}

function shuffle<T>(arr: T[], rng?: () => number): T[] {
  if (rng) return seededShuffle(arr, rng)
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export type FaceOffDetail = FaceOff & {
  star1: number
  star2: number
  roll1: number
  roll2: number
  effective1: number
  effective2: number
}

// --- Phase functions ---

function resolveStars(state: FaceOffState): FaceOffState {
  return state
}

function resolveBaseDice(state: FaceOffState): FaceOffState {
  const { star1, star2, rand } = state
  const diff = Math.abs(star1 - star2)
  let roll1 = 0
  let roll2 = 0

  if (star1 === star2) {
    roll1 = Math.floor(rand() * 2)
    roll2 = Math.floor(rand() * 2)
  } else if (star1 < star2) {
    roll1 = Math.floor(rand() * (diff + 2))
  } else {
    roll2 = Math.floor(rand() * (diff + 2))
  }

  return { ...state, roll1, roll2 }
}

function resolveEffective(state: FaceOffState): FaceOffState {
  return {
    ...state,
    effective1: state.star1 + state.roll1,
    effective2: state.star2 + state.roll2,
  }
}

function resolveBaseDamage(state: FaceOffState): FaceOffState {
  const finalDiff = Math.abs(state.effective1 - state.effective2)
  return {
    ...state,
    damage1: state.effective2 > state.effective1 ? finalDiff : 0,
    damage2: state.effective1 > state.effective2 ? finalDiff : 0,
  }
}

const ACTIVATION_FIELDS: [ActivationChange['field'], 'star1' | 'roll1' | 'effective1' | 'damage1', 'star2' | 'roll2' | 'effective2' | 'damage2'][] = [
  ['star', 'star1', 'star2'],
  ['roll', 'roll1', 'roll2'],
  ['effective', 'effective1', 'effective2'],
  ['damage', 'damage1', 'damage2'],
]

function applyHooks(skills: ActiveSkill[] | undefined, phase: ActivationPhase, state: FaceOffState, trace?: SkillActivation[]): FaceOffState {
  if (!skills) return state
  for (const s of skills) {
    const hook = s.skill.hooks[phase]
    if (!hook) continue
    const after = hook(state)
    if (trace) {
      const changes: ActivationChange[] = []
      for (const [field, k1, k2] of ACTIVATION_FIELDS) {
        if (state[k1] !== after[k1]) changes.push({ side: 1, field, before: state[k1], after: after[k1] })
        if (state[k2] !== after[k2]) changes.push({ side: 2, field, before: state[k2], after: after[k2] })
      }
      if (changes.length > 0) trace.push({ skillId: s.skill.id, skillName: s.skill.name, phase, changes })
    }
    state = after
  }
  return state
}

export function resolveFaceOff(card1: BattleCard, card2: BattleCard, activeSkills?: ActiveSkill[], rng?: () => number): FaceOffDetail {
  const rand = rng || Math.random

  const activations: SkillActivation[] = []

  let state: FaceOffState = {
    card1, card2,
    star1: starCount[card1.rarity] || 1,
    star2: starCount[card2.rarity] || 1,
    roll1: 0, roll2: 0,
    effective1: 0, effective2: 0,
    damage1: 0, damage2: 0,
    rand,
  }

  // Phase 1: Stars
  state = resolveStars(state)
  state = applyHooks(activeSkills, 'onStars', state, activations)

  // Phase 2: Dice — override hooks replace base dice entirely
  const hasDiceOverride = activeSkills?.some(s => s.skill.hooks.onDiceOverride)
  if (hasDiceOverride) {
    state = applyHooks(activeSkills, 'onDiceOverride', state, activations)
  } else {
    state = resolveBaseDice(state)
  }
  state = applyHooks(activeSkills, 'onDice', state, activations)

  // Phase 3: Effective totals
  state = resolveEffective(state)
  state = applyHooks(activeSkills, 'onTotals', state, activations)

  // Phase 4: Damage
  state = resolveBaseDamage(state)
  state = applyHooks(activeSkills, 'onDamage', state, activations)

  return {
    card1, card2,
    star1: state.star1, star2: state.star2,
    roll1: state.roll1, roll2: state.roll2,
    effective1: state.effective1, effective2: state.effective2,
    damage1: state.damage1, damage2: state.damage2,
    ...(activations.length > 0 ? { activations } : {}),
  }
}

// Build the face-off as it looks after `step` skill activations are applied:
// cumulative star/roll/effective per side, plus only the activations revealed so
// far (so the battle UI can reveal skills/totals progressively). step 0 = base
// (pre-skill). step >= activation count returns the final face-off unchanged.
export function faceOffAtStep(fo: FaceOffDetail, step: number): FaceOffDetail {
  const acts = fo.activations ?? []
  if (acts.length === 0 || step >= acts.length) return fo
  const baseOf = (side: 1 | 2, field: ActivationChange['field'], fallback: number): number => {
    for (const a of acts) for (const c of a.changes) if (c.side === side && c.field === field) return c.before
    return fallback
  }
  let s1 = baseOf(1, 'star', fo.star1), r1 = baseOf(1, 'roll', fo.roll1)
  let s2 = baseOf(2, 'star', fo.star2), r2 = baseOf(2, 'roll', fo.roll2)
  let e1 = s1 + r1, e2 = s2 + r2
  for (let i = 0; i < step; i++) {
    for (const c of acts[i].changes) {
      if (c.side === 1) {
        if (c.field === 'star') { s1 = c.after; e1 = s1 + r1 }
        else if (c.field === 'roll') { r1 = c.after; e1 = s1 + r1 }
        else if (c.field === 'effective') { e1 = c.after }
      } else {
        if (c.field === 'star') { s2 = c.after; e2 = s2 + r2 }
        else if (c.field === 'roll') { r2 = c.after; e2 = s2 + r2 }
        else if (c.field === 'effective') { e2 = c.after }
      }
    }
  }
  return { ...fo, star1: s1, star2: s2, roll1: r1, roll2: r2, effective1: e1, effective2: e2, activations: acts.slice(0, step) }
}

export function randomPair(players: BattlePlayer[], rng?: () => number): { pairs: [string, string][]; byeId: string | null } {
  const alive = shuffle(players.filter((p) => !p.eliminated).sort((a, b) => a.id.localeCompare(b.id)), rng)
  const pairs: [string, string][] = []
  let byeId: string | null = null

  for (let i = 0; i < alive.length - 1; i += 2) {
    pairs.push([alive[i].id, alive[i + 1].id])
  }

  if (alive.length % 2 === 1) {
    byeId = alive[alive.length - 1].id
  }

  return { pairs, byeId }
}

function applyRoundHooks(skills: ActiveSkill[] | undefined, ctx: RoundContext): RoundContext {
  if (!skills) return ctx
  for (const s of skills) {
    const hook = s.skill.hooks.onRound
    if (hook) ctx = hook(ctx)
  }
  return ctx
}

export function precomputeRound(
  players: BattlePlayer[],
  currentHp: Record<string, number>,
  roundNum: number,
  fixedPairings?: { pairs: [string, string][]; byeId: string | null },
  activeSkills?: ActiveSkill[],
  rng?: () => number,
): RoundResult {
  const rand = rng || Math.random
  const { pairs, byeId } = fixedPairings || randomPair(players, rng)

  // Build round context and let round-level skills modify it
  const initialDecks = new Map<string, BattleCard[]>()
  let roundCtx: RoundContext = {
    players,
    decks: initialDecks,
    flags: {},
    rand,
  }
  roundCtx = applyRoundHooks(activeSkills, roundCtx)

  const flags: RoundFlags = roundCtx.flags
  const healInstead = flags.healInstead ?? false

  const matches: MatchResult[] = pairs.map(([id1, id2]) => {
    const p1 = players.find((p) => p.id === id1)!
    const p2 = players.find((p) => p.id === id2)!
    const deck1 = roundCtx.decks.get(id1) || shuffle([...p1.deck].sort((a, b) => a.id.localeCompare(b.id)), rng)
    const deck2 = roundCtx.decks.get(id2) || shuffle([...p2.deck].sort((a, b) => a.id.localeCompare(b.id)), rng)
    const faceOffs: FaceOff[] = []

    const matchSkills = activeSkills?.filter((s) => s.activatedBy === id1 || s.activatedBy === id2)

    for (let i = 0; i < 5; i++) {
      faceOffs.push(resolveFaceOff(deck1[i], deck2[i], matchSkills, rng))
    }

    let hp1 = currentHp[id1] || 0
    let hp2 = currentHp[id2] || 0
    const hpSnapshots: Record<string, number>[] = [{ [id1]: hp1, [id2]: hp2 }]

    for (const fo of faceOffs) {
      if (healInstead) {
        hp1 = Math.min(10, hp1 + fo.damage1)
        hp2 = Math.min(10, hp2 + fo.damage2)
      } else {
        hp1 = Math.max(0, hp1 - fo.damage1)
        hp2 = Math.max(0, hp2 - fo.damage2)
      }
      hpSnapshots.push({ [id1]: hp1, [id2]: hp2 })
      if (hp1 <= 0 || hp2 <= 0) break
    }

    const finalHp1 = hpSnapshots[hpSnapshots.length - 1][id1]
    const finalHp2 = hpSnapshots[hpSnapshots.length - 1][id2]
    let winnerId: string | null = null
    if (finalHp1 > finalHp2) winnerId = id1
    else if (finalHp2 > finalHp1) winnerId = id2
    else winnerId = rand() > 0.5 ? id1 : id2

    return { player1Id: id1, player2Id: id2, faceOffs, winnerId, hpSnapshots }
  })

  return { round: roundNum, matches, byePlayerId: byeId, flags: Object.keys(flags).length > 0 ? flags : undefined }
}

const BOT_NAMES = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta', 'Bot Epsilon', 'Bot Zeta', 'Bot Eta']

export function createBot(index: number, allCards: BattleCard[]): BattlePlayer {
  const deck = shuffle(allCards).slice(0, 5)
  return {
    id: `bot-${index}`,
    name: BOT_NAMES[index] || `Bot ${index + 1}`,
    avatar_url: null,
    deck,
    hp: 10,
    eliminated: false,
  }
}
