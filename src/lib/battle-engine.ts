export type { Skill, SkillHooks, BattleEffect, BattleEffectHooks, EffectKind, FaceOffState, RoundContext, ActiveSkill, SkillEffectRows } from '@/lib/skills'
export { SKILL_REGISTRY, resolveSkills } from '@/lib/skills'

import type { Skill, ActiveSkill, EffectKind, FaceOffState, RoundContext } from '@/lib/skills'
import { seededShuffle } from '@/lib/seeded-random'

export type BattleCard = {
  id: string
  name: string
  image_url: string | null
  rarity: string
  creature_name: string | null
  dbSkillIds?: string[]
  skills?: Skill[]
  types?: string[] // type ids (for synergy scoping)
}

export type BattlePlayer = {
  id: string
  name: string
  avatar_url: string | null
  deck: BattleCard[]
  hp: number
  eliminated: boolean
}

// A single field an effect changed during a face-off, with before/after so the
// UI can animate the transition. side 1 = card1, side 2 = card2. The `rarity`
// field carries string values (the others are numeric).
export type ActivationChange = {
  side: 1 | 2
  field: 'star' | 'rarity' | 'roll' | 'bonusRoll' | 'effective' | 'damage'
  before: number | string
  after: number | string
}
export type ActivationPhase = 'onStars' | 'onDiceOverride' | 'onDice' | 'onTotals' | 'onDamage'
// One entry per effect that changed something. `skillId`/`skillName` identify
// the owning skill (what the player activated); `effectId`/`kind` identify the
// specific battle effect (what to animate).
export type SkillActivation = {
  skillId: string
  skillName: string
  effectId: string
  kind: EffectKind[]
  phase: ActivationPhase
  changes: ActivationChange[]
  activatedBy?: string // player id that activated it (skills); synergies use `synergy:` skillId
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
  rarity1: string
  rarity2: string
  roll1: number
  roll2: number
  bonusRoll1: number
  bonusRoll2: number
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
    effective1: state.star1 + state.roll1 + state.bonusRoll1,
    effective2: state.star2 + state.roll2 + state.bonusRoll2,
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

const ACTIVATION_FIELDS: [ActivationChange['field'], 'star1' | 'rarity1' | 'roll1' | 'bonusRoll1' | 'effective1' | 'damage1', 'star2' | 'rarity2' | 'roll2' | 'bonusRoll2' | 'effective2' | 'damage2'][] = [
  ['star', 'star1', 'star2'],
  ['rarity', 'rarity1', 'rarity2'],
  ['roll', 'roll1', 'roll2'],
  ['bonusRoll', 'bonusRoll1', 'bonusRoll2'],
  ['effective', 'effective1', 'effective2'],
  ['damage', 'damage1', 'damage2'],
]

// Which sides an effect's changes are kept for. Skills (no scope) hit both.
// Synergy effects are scoped to owner/opponent/everyone, and 'synergy_cards'
// further restricts to cards carrying one of the synergy's required types.
function effectAffects(eff: ActiveSkill['skill']['effects'][number], ownerSide: 1 | 2 | undefined, state: FaceOffState): { s1: boolean; s2: boolean } {
  if (!eff.scope) return { s1: true, s2: true }
  const owner = ownerSide ?? 1
  const opp: 1 | 2 = owner === 1 ? 2 : 1
  const target = eff.target ?? 'allies'
  let sides: Set<number>
  if (eff.scope === 'arena' || eff.scope === 'matchup') {
    sides = target === 'allies' ? new Set([owner]) : target === 'enemies' ? new Set([opp]) : new Set([1, 2])
  } else {
    sides = target === 'enemies' ? new Set([opp]) : new Set([owner])
  }
  let s1 = sides.has(1)
  let s2 = sides.has(2)
  if (eff.scope === 'synergy_cards' && eff.requiredTypes && eff.requiredTypes.length > 0) {
    const has = (c: BattleCard) => (c.types ?? []).some((t) => eff.requiredTypes!.includes(t))
    if (s1) s1 = has(state.card1)
    if (s2) s2 = has(state.card2)
  }
  return { s1, s2 }
}

function restoreSide(after: FaceOffState, before: FaceOffState, side: 1 | 2): FaceOffState {
  return side === 1
    ? { ...after, star1: before.star1, rarity1: before.rarity1, roll1: before.roll1, bonusRoll1: before.bonusRoll1, effective1: before.effective1, damage1: before.damage1 }
    : { ...after, star2: before.star2, rarity2: before.rarity2, roll2: before.roll2, bonusRoll2: before.bonusRoll2, effective2: before.effective2, damage2: before.damage2 }
}

function applyHooks(skills: ActiveSkill[] | undefined, phase: ActivationPhase, state: FaceOffState, trace?: SkillActivation[]): FaceOffState {
  if (!skills) return state
  for (const s of skills) {
    for (const eff of s.skill.effects) {
      const hook = eff.hooks[phase]
      if (!hook) continue
      let after = hook(state)
      // Scope synergy effects: revert changes on sides the effect doesn't reach.
      const { s1, s2 } = effectAffects(eff, s.ownerSide, state)
      if (!s1) after = restoreSide(after, state, 1)
      if (!s2) after = restoreSide(after, state, 2)
      if (trace) {
        const changes: ActivationChange[] = []
        for (const [field, k1, k2] of ACTIVATION_FIELDS) {
          if (state[k1] !== after[k1]) changes.push({ side: 1, field, before: state[k1], after: after[k1] })
          if (state[k2] !== after[k2]) changes.push({ side: 2, field, before: state[k2], after: after[k2] })
        }
        if (changes.length > 0) {
          trace.push({ skillId: s.skill.id, skillName: s.skill.name, effectId: eff.id, kind: eff.kind, phase, changes, activatedBy: s.activatedBy })
        }
      }
      state = after
    }
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
    rarity1: card1.rarity,
    rarity2: card2.rarity,
    roll1: 0, roll2: 0,
    bonusRoll1: 0, bonusRoll2: 0,
    effective1: 0, effective2: 0,
    damage1: 0, damage2: 0,
    rand,
  }

  // Phase 1: Stars
  state = resolveStars(state)
  state = applyHooks(activeSkills, 'onStars', state, activations)

  // Phase 2: Dice — override hooks replace base dice entirely
  // Only unscoped (skill) overrides replace base dice globally; scoped synergy
  // overrides run after base dice and are restricted to their side.
  const hasDiceOverride = activeSkills?.some(s => s.skill.effects.some(e => !e.scope && e.hooks.onDiceOverride))
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
    rarity1: state.rarity1, rarity2: state.rarity2,
    roll1: state.roll1, roll2: state.roll2,
    bonusRoll1: state.bonusRoll1, bonusRoll2: state.bonusRoll2,
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
    for (const a of acts) for (const c of a.changes) if (c.side === side && c.field === field) return c.before as number
    return fallback
  }
  const baseRarity = (side: 1 | 2, fallback: string): string => {
    for (const a of acts) for (const c of a.changes) if (c.side === side && c.field === 'rarity') return c.before as string
    return fallback
  }
  let s1 = baseOf(1, 'star', fo.star1), r1 = baseOf(1, 'roll', fo.roll1), b1 = baseOf(1, 'bonusRoll', fo.bonusRoll1)
  let s2 = baseOf(2, 'star', fo.star2), r2 = baseOf(2, 'roll', fo.roll2), b2 = baseOf(2, 'bonusRoll', fo.bonusRoll2)
  let rar1 = baseRarity(1, fo.rarity1), rar2 = baseRarity(2, fo.rarity2)
  let e1 = s1 + r1 + b1, e2 = s2 + r2 + b2
  for (let i = 0; i < step; i++) {
    for (const c of acts[i].changes) {
      if (c.side === 1) {
        if (c.field === 'star') { s1 = c.after as number; e1 = s1 + r1 + b1 }
        else if (c.field === 'rarity') { rar1 = c.after as string }
        else if (c.field === 'roll') { r1 = c.after as number; e1 = s1 + r1 + b1 }
        else if (c.field === 'bonusRoll') { b1 = c.after as number; e1 = s1 + r1 + b1 }
        else if (c.field === 'effective') { e1 = c.after as number }
      } else {
        if (c.field === 'star') { s2 = c.after as number; e2 = s2 + r2 + b2 }
        else if (c.field === 'rarity') { rar2 = c.after as string }
        else if (c.field === 'roll') { r2 = c.after as number; e2 = s2 + r2 + b2 }
        else if (c.field === 'bonusRoll') { b2 = c.after as number; e2 = s2 + r2 + b2 }
        else if (c.field === 'effective') { e2 = c.after as number }
      }
    }
  }
  return { ...fo, star1: s1, star2: s2, rarity1: rar1, rarity2: rar2, roll1: r1, roll2: r2, bonusRoll1: b1, bonusRoll2: b2, effective1: e1, effective2: e2, activations: acts.slice(0, step) }
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
    for (const eff of s.skill.effects) {
      const hook = eff.hooks.onRound
      if (!hook) continue
      // Round-level effects mutate the shared round context (decks/flags for all
      // players), so they're inherently arena-wide. A scoped synergy round-effect
      // that isn't arena-scoped is a misconfiguration — skip it rather than
      // silently applying it to everyone.
      if (eff.scope && eff.scope !== 'arena') continue
      ctx = hook(ctx)
    }
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

    const matchSkills = activeSkills
      ?.filter((s) => s.activatedBy === id1 || s.activatedBy === id2)
      .map((s) => ({ ...s, ownerSide: (s.activatedBy === id1 ? 1 : 2) as 1 | 2 }))

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
