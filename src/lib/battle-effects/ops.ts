import type { BattleEffectHooks, EffectKind } from '@/lib/skills/types'

// ============================================================
// Op registry: the fixed vocabulary of battle-effect operations.
// A battle effect (in code or DB) = an op id + params. The op's `build`
// binds params into the actual phase hooks. Logic lives here; composition
// (which op + which params) can live in the DB.
// ============================================================

export const RARITIES = ['common', 'uncommon', 'rare', 'ultra_rare', 'legendary', 'secret_rare']
const starCount: Record<string, number> = {
  common: 1, uncommon: 2, rare: 3, ultra_rare: 4, legendary: 5, secret_rare: 6,
}

function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// A single configurable parameter — drives the admin form + validation.
export type ParamSpec =
  | { key: string; type: 'number'; label: string; default: number; min?: number; max?: number }
  | { key: string; type: 'string'; label: string; default: string }
  | { key: string; type: 'rarity'; label: string; default: string }

export type OpHandler = {
  id: string
  label: string
  phase: 'faceoff' | 'round'
  defaultKind: EffectKind[]
  params: ParamSpec[]
  build: (params: Record<string, unknown>) => BattleEffectHooks
  // Optional short range/label for the dice-roll UI (e.g. "1-3", "0-10").
  rangeLabel?: (params: Record<string, unknown>) => string
}

const num = (p: Record<string, unknown>, k: string, d: number): number =>
  typeof p[k] === 'number' ? (p[k] as number) : d
const str = (p: Record<string, unknown>, k: string, d: string): string =>
  typeof p[k] === 'string' ? (p[k] as string) : d

export const OP_REGISTRY: Record<string, OpHandler> = {
  // --- Dice ---
  zero_dice: {
    id: 'zero_dice', label: 'No dice rolls', phase: 'faceoff', defaultKind: ['dice'], params: [],
    build: () => ({ onDiceOverride: (s) => ({ ...s, roll1: 0, roll2: 0 }) }),
  },
  dice_bonus: {
    id: 'dice_bonus', label: 'Dice bonus', phase: 'faceoff', defaultKind: ['dice'],
    params: [{ key: 'amount', type: 'number', label: 'Bonus', default: 2, min: 1, max: 10 }],
    rangeLabel: (p) => `+${num(p, 'amount', 2)}`,
    build: (p) => {
      const amt = num(p, 'amount', 2)
      return {
        onDice: (s) => ({
          ...s,
          roll1: (s.roll1 > 0 || s.star1 <= s.star2) ? s.roll1 + amt : s.roll1,
          roll2: (s.roll2 > 0 || s.star2 <= s.star1) ? s.roll2 + amt : s.roll2,
        }),
      }
    },
  },
  extra_dice: {
    // Bounds may be negative — a die from -1 to 0 is a "penalty die" (e.g. Drowsy).
    id: 'extra_dice', label: 'Roll an extra die', phase: 'faceoff', defaultKind: ['extraDice'],
    params: [
      { key: 'min', type: 'number', label: 'Die min', default: 0, min: -12, max: 12 },
      { key: 'max', type: 'number', label: 'Die max', default: 2, min: -12, max: 12 },
    ],
    rangeLabel: (p) => {
      const mn = num(p, 'min', 0)
      const mx = Math.max(mn, num(p, 'max', 2))
      // Use an unambiguous separator when a bound is negative ("-1 to 0").
      return mn < 0 || mx < 0 ? `${mn} to ${mx}` : `${mn}-${mx}`
    },
    build: (p) => {
      const min = num(p, 'min', 0)
      const max = Math.max(min, num(p, 'max', 2))
      const span = max - min + 1
      return {
        onDice: (s) => ({
          ...s,
          bonusRoll1: s.bonusRoll1 + min + Math.floor(s.rand() * span),
          bonusRoll2: s.bonusRoll2 + min + Math.floor(s.rand() * span),
        }),
      }
    },
  },
  big_dice: {
    id: 'big_dice', label: 'Big dice (lower rarity)', phase: 'faceoff', defaultKind: ['dice'],
    params: [{ key: 'max', type: 'number', label: 'Max roll', default: 10, min: 1, max: 20 }],
    rangeLabel: (p) => `0-${num(p, 'max', 10)}`,
    build: (p) => {
      const max = num(p, 'max', 10)
      return {
        onDiceOverride: (s) => {
          let { roll1, roll2 } = s
          if (s.star1 < s.star2) roll1 = Math.floor(s.rand() * (max + 1))
          else if (s.star2 < s.star1) roll2 = Math.floor(s.rand() * (max + 1))
          else { roll1 = Math.floor(s.rand() * (max + 1)); roll2 = Math.floor(s.rand() * (max + 1)) }
          return { ...s, roll1, roll2 }
        },
      }
    },
  },

  // --- Totals / damage ---
  multiply_total: {
    id: 'multiply_total', label: 'Multiply totals', phase: 'faceoff', defaultKind: ['total'],
    params: [{ key: 'factor', type: 'number', label: 'Factor', default: 2, min: 1, max: 5 }],
    build: (p) => {
      const f = num(p, 'factor', 2)
      return { onTotals: (s) => ({ ...s, effective1: Math.round(s.effective1 * f), effective2: Math.round(s.effective2 * f) }) }
    },
  },
  multiply_damage: {
    id: 'multiply_damage', label: 'Multiply damage', phase: 'faceoff', defaultKind: ['damage'],
    params: [{ key: 'factor', type: 'number', label: 'Factor', default: 2, min: 1, max: 5 }],
    build: (p) => {
      const f = num(p, 'factor', 2)
      return { onDamage: (s) => ({ ...s, damage1: Math.round(s.damage1 * f), damage2: Math.round(s.damage2 * f) }) }
    },
  },
  flat_damage: {
    id: 'flat_damage', label: 'Flat damage to losers', phase: 'faceoff', defaultKind: ['damage'],
    params: [{ key: 'value', type: 'number', label: 'Damage', default: 3, min: 1, max: 10 }],
    build: (p) => {
      const v = num(p, 'value', 3)
      return { onDamage: (s) => ({ ...s, damage1: s.damage1 > 0 ? v : 0, damage2: s.damage2 > 0 ? v : 0 }) }
    },
  },
  reverse_damage: {
    id: 'reverse_damage', label: 'Reverse damage', phase: 'faceoff', defaultKind: ['damage'], params: [],
    build: () => ({ onDamage: (s) => ({ ...s, damage1: s.damage2, damage2: s.damage1 }) }),
  },
  lifesteal: {
    // Heal the side that dealt damage this face-off. `mode` picks how much:
    //   full    → heal equal to the damage dealt
    //   flat    → heal a fixed `amount`
    //   percent → heal floor(damage * amount / 100)
    // `chance` (0-100) is the probability the heal happens at all. Bind with
    // scope 'synergy_cards' + target 'allies' so only your own typed cards drain.
    id: 'lifesteal', label: 'Lifesteal', phase: 'faceoff', defaultKind: ['heal'],
    params: [
      { key: 'mode', type: 'string', label: 'Mode (full | flat | percent)', default: 'flat' },
      { key: 'amount', type: 'number', label: 'Flat heal / percent value', default: 1, min: 0, max: 100 },
      { key: 'chance', type: 'number', label: 'Heal chance %', default: 100, min: 0, max: 100 },
    ],
    build: (p) => {
      const mode = str(p, 'mode', 'flat')
      const amount = num(p, 'amount', 1)
      const chance = num(p, 'chance', 100)
      const healFor = (dmgDealt: number, rand: () => number): number => {
        if (dmgDealt <= 0 || chance <= 0) return 0
        // Only burn an RNG draw for a real coin-flip, so a 100%-chance lifesteal
        // leaves the dice stream (and thus all later face-offs) untouched.
        if (chance < 100 && rand() * 100 >= chance) return 0
        if (mode === 'full') return dmgDealt
        if (mode === 'percent') return Math.floor((dmgDealt * amount) / 100)
        return amount
      }
      return {
        onDamage: (s) => ({
          // side1 dealt damage when damage2 > 0; side2 when damage1 > 0. At most
          // one side deals damage per face-off, so at most one chance roll fires.
          ...s,
          heal1: s.heal1 + healFor(s.damage2, s.rand),
          heal2: s.heal2 + healFor(s.damage1, s.rand),
        }),
      }
    },
  },

  // --- Power / rarity ---
  set_power: {
    id: 'set_power', label: 'Set base power', phase: 'faceoff', defaultKind: ['power'],
    params: [{ key: 'value', type: 'number', label: 'Power (stars)', default: 1, min: 1, max: 6 }],
    build: (p) => {
      const v = num(p, 'value', 1)
      return { onStars: (s) => ({ ...s, star1: v, star2: v }) }
    },
  },
  randomize_rarity: {
    id: 'randomize_rarity', label: 'Randomize rarity', phase: 'faceoff', defaultKind: ['rarity', 'power'], params: [],
    build: () => ({
      onStars: (s) => {
        const r1 = RARITIES[Math.floor(s.rand() * RARITIES.length)]
        const r2 = RARITIES[Math.floor(s.rand() * RARITIES.length)]
        return { ...s, rarity1: r1, rarity2: r2, star1: starCount[r1] || 1, star2: starCount[r2] || 1 }
      },
    }),
  },
  set_rarity_if: {
    id: 'set_rarity_if', label: 'Promote rarity (conditional)', phase: 'faceoff', defaultKind: ['rarity'],
    params: [
      { key: 'ifRarity', type: 'rarity', label: 'If rarity is', default: 'common' },
      { key: 'toRarity', type: 'rarity', label: 'Set rarity to', default: 'secret_rare' },
    ],
    build: (p) => {
      const ifR = str(p, 'ifRarity', 'common')
      const toR = str(p, 'toRarity', 'secret_rare')
      return {
        onStars: (s) => ({
          ...s,
          rarity1: s.card1.rarity === ifR ? toR : s.rarity1,
          rarity2: s.card2.rarity === ifR ? toR : s.rarity2,
        }),
      }
    },
  },
  boost_power_if: {
    id: 'boost_power_if', label: 'Boost power (conditional)', phase: 'faceoff', defaultKind: ['power'],
    params: [
      { key: 'ifRarity', type: 'rarity', label: 'If rarity is', default: 'common' },
      { key: 'value', type: 'number', label: 'Power (stars)', default: 6, min: 1, max: 6 },
    ],
    build: (p) => {
      const ifR = str(p, 'ifRarity', 'common')
      const v = num(p, 'value', 6)
      return {
        onStars: (s) => ({
          ...s,
          star1: s.card1.rarity === ifR ? v : s.star1,
          star2: s.card2.rarity === ifR ? v : s.star2,
        }),
      }
    },
  },

  // --- Round-level ---
  redeal_all: {
    id: 'redeal_all', label: 'Shuffle & redeal all decks', phase: 'round', defaultKind: ['deck'], params: [],
    build: () => ({
      onRound: (ctx) => {
        const alivePlayers = ctx.players.filter((pl) => !pl.eliminated)
        const allCards = alivePlayers.flatMap((pl) => [...pl.deck]).sort((a, b) => a.id.localeCompare(b.id))
        const shuffled = seededShuffle(allCards, ctx.rand)
        const decks = new Map(ctx.decks)
        let cardIdx = 0
        for (const pl of alivePlayers) {
          const dealt = shuffled.slice(cardIdx, cardIdx + 5)
          decks.set(pl.id, dealt.length === 5 ? dealt : [...dealt, ...pl.deck.slice(dealt.length)])
          cardIdx += 5
        }
        return { ...ctx, decks }
      },
    }),
  },
  heal_instead: {
    id: 'heal_instead', label: 'Heal instead of damage', phase: 'round', defaultKind: ['heal'], params: [],
    build: () => ({ onRound: (ctx) => ({ ...ctx, flags: { ...ctx.flags, healInstead: true } }) }),
  },
  visual_tint: {
    id: 'visual_tint', label: 'Visual tint', phase: 'round', defaultKind: ['visual'],
    params: [{ key: 'filter', type: 'string', label: 'CSS filter', default: 'sepia(0.8) brightness(0.85)' }],
    build: (p) => {
      const filter = str(p, 'filter', 'sepia(0.8) brightness(0.85)')
      return { onRound: (ctx) => ({ ...ctx, flags: { ...ctx.flags, visualEffect: filter } }) }
    },
  },
}

// Validate a params object against an op's spec. Returns an error string or null.
export function validateOpParams(op: string, params: Record<string, unknown>): string | null {
  const handler = OP_REGISTRY[op]
  if (!handler) return `Unknown op: ${op}`
  for (const spec of handler.params) {
    const v = params[spec.key]
    if (v === undefined || v === null) continue // defaults apply
    if (spec.type === 'number') {
      if (typeof v !== 'number' || Number.isNaN(v)) return `${spec.key} must be a number`
      if (spec.min !== undefined && v < spec.min) return `${spec.key} must be >= ${spec.min}`
      if (spec.max !== undefined && v > spec.max) return `${spec.key} must be <= ${spec.max}`
    } else if (spec.type === 'rarity') {
      if (!RARITIES.includes(v as string)) return `${spec.key} must be a valid rarity`
    } else if (spec.type === 'string') {
      if (typeof v !== 'string') return `${spec.key} must be a string`
    }
  }
  return null
}
