import type { BattleEffect, EffectKind } from '@/lib/skills/types'
import { OP_REGISTRY } from './ops'

export { OP_REGISTRY, validateOpParams, RARITIES } from './ops'
export type { OpHandler, ParamSpec } from './ops'

// Build a BattleEffect from an op id + params. Used by the built-in effects
// below and (later) by the DB loader.
export function makeEffect(
  key: string,
  name: string,
  op: string,
  params: Record<string, unknown> = {},
  kind?: EffectKind[],
): BattleEffect {
  const handler = OP_REGISTRY[op]
  if (!handler) throw new Error(`Unknown battle-effect op: ${op}`)
  return { id: key, name, kind: kind ?? handler.defaultKind, hooks: handler.build(params), rangeLabel: handler.rangeLabel?.(params) }
}

// Built-in effects (the reference compositions). Skills import these today; the
// DB loader will produce equivalent objects from battle_effects rows.

export const FX_ZERO_DICE = makeEffect('zero-dice', 'No Dice', 'zero_dice')
export const FX_DICE_BONUS_2 = makeEffect('dice-bonus-2', 'Dice Bonus +2', 'dice_bonus', { amount: 2 })
export const FX_BIG_DICE = makeEffect('big-dice', 'Big Dice', 'big_dice', { max: 10 })

export const FX_DOUBLE_TOTALS = makeEffect('double-totals', 'Double Totals', 'multiply_total', { factor: 2 })
export const FX_DOUBLE_DAMAGE = makeEffect('double-damage', 'Double Damage', 'multiply_damage', { factor: 2 })
export const FX_FLAT_DAMAGE_3 = makeEffect('flat-damage-3', 'Flat Damage 3', 'flat_damage', { value: 3 })
export const FX_REVERSE_DAMAGE = makeEffect('reverse-damage', 'Reverse Damage', 'reverse_damage')

export const FX_LEVEL_POWER = makeEffect('level-power', 'Level Power', 'set_power', { value: 1 })
export const FX_RANDOMIZE_RARITY = makeEffect('randomize-rarity', 'Randomize Rarity', 'randomize_rarity', {}, ['rarity', 'power'])
export const FX_ASCEND_RARITY = makeEffect('ascend-rarity', 'Ascend Rarity', 'set_rarity_if', { ifRarity: 'common', toRarity: 'secret_rare' }, ['rarity'])
export const FX_ASCEND_POWER = makeEffect('ascend-power', 'Ascend Power', 'boost_power_if', { ifRarity: 'common', value: 6 }, ['power'])

export const FX_HEAL_INSTEAD = makeEffect('heal-instead', 'Heal Instead', 'heal_instead')
export const FX_BROWN_TINT = makeEffect('brown-tint', 'Brown Tint', 'visual_tint', { filter: 'sepia(0.8) brightness(0.85)' })
export const FX_REDEAL_ALL = makeEffect('redeal-all', 'Redeal All', 'redeal_all')
