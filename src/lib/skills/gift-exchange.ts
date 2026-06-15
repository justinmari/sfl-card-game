import type { Skill, FaceOffState } from './types'
import type { BattleCard } from '@/lib/battle-engine'

function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const SKILL_GIFT_EXCHANGE: Skill = {
  id: 'gift-exchange',
  name: 'Gift Exchange',
  description: 'All cards are shuffled together and randomly dealt into new decks for this round',
  usesPerBattle: 1,
  hooks: {
    onRound: (ctx) => {
      const alivePlayers = ctx.players.filter((p) => !p.eliminated)
      const allCards = alivePlayers.flatMap((p) => [...p.deck]).sort((a, b) => a.id.localeCompare(b.id))
      const shuffled = seededShuffle(allCards, ctx.rand)
      const decks = new Map(ctx.decks)
      let cardIdx = 0
      for (const p of alivePlayers) {
        const dealt = shuffled.slice(cardIdx, cardIdx + 5)
        decks.set(p.id, dealt.length === 5 ? dealt : [...dealt, ...p.deck.slice(dealt.length)])
        cardIdx += 5
      }
      return { ...ctx, decks }
    },
  },
}
