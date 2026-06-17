import type { BattleCard, ActiveSkill } from '@/lib/battle-engine'
import type { BattleEffect, SynergyScope, SynergyTarget } from '@/lib/skills/types'

// A synergy definition (recipe + bound effects), assembled from the DB.
export type SynergyRequirement = { typeId: string; count: number }
export type SynergyEffectBinding = { effect: BattleEffect; scope: SynergyScope; target: SynergyTarget }
export type SynergyDef = {
  id: string
  name: string
  description: string
  requirements: SynergyRequirement[]
  effects: SynergyEffectBinding[]
}

type SynergyPlayer = { id: string; deck: BattleCard[] }

// Count, per type id, how many cards in the deck carry that type. Non-exclusive:
// a card counts toward every type it has, and toward multiple synergies.
function typeCounts(deck: BattleCard[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const card of deck) {
    for (const t of card.types ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return counts
}

export function synergyMet(deck: BattleCard[], def: SynergyDef): boolean {
  if (def.requirements.length === 0) return false
  const counts = typeCounts(deck)
  return def.requirements.every((r) => (counts.get(r.typeId) ?? 0) >= r.count)
}

// Build the persistent ActiveSkills produced by every satisfied synergy across
// all players. Each bound effect becomes one ActiveSkill carrying its scope/
// target; the engine restricts it to the right side(s) per face-off.
export function computeActiveSynergies(players: SynergyPlayer[], defs: SynergyDef[]): ActiveSkill[] {
  const out: ActiveSkill[] = []
  for (const player of players) {
    for (const def of defs) {
      if (!synergyMet(player.deck, def)) continue
      const requiredTypes = def.requirements.map((r) => r.typeId)
      for (const binding of def.effects) {
        const boundEffect: BattleEffect = {
          ...binding.effect,
          scope: binding.scope,
          target: binding.target,
          requiredTypes: binding.scope === 'synergy_cards' || binding.scope === 'non_synergy_cards' ? requiredTypes : undefined,
        }
        out.push({
          skill: {
            id: `synergy:${def.id}`,
            name: def.name,
            description: def.description,
            usesPerBattle: 1,
            effects: [boundEffect],
          },
          activatedBy: player.id,
          roundActivated: 0,
        })
      }
    }
  }
  return out
}

// Which synergies a single deck satisfies (for the discovery Codex / preview).
export function metSynergies(deck: BattleCard[], defs: SynergyDef[]): SynergyDef[] {
  return defs.filter((d) => synergyMet(deck, d))
}
