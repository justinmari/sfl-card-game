'use client'

import { useState } from 'react'
import {
  type BattlePlayer,
  type BattleCard,
  type SkillEffectRows,
  createBot,
  starCount,
  resolveSkills,
} from '@/lib/battle-engine'
import ArenaBattle from '@/components/arena/arena-battle'
import type { SynergyDefRow } from '@/lib/synergies/loader'
import CompactCard from '@/components/compact-card'
import { rarityLabel, rarityBadgeColors } from '@/lib/rarities'

type DeckOption = { slot: number; name: string; cards: BattleCard[] }

export default function TestArena({
  userId, userName, avatarUrl, adminDecks, allCards, dbSkills, skillEffectRows, synergyDefs,
}: {
  userId: string; userName: string; avatarUrl: string | null
  adminDecks: DeckOption[]; allCards: BattleCard[]
  dbSkills?: { id: string; name: string; description: string }[]
  skillEffectRows?: SkillEffectRows
  synergyDefs?: SynergyDefRow[]
}) {
  const [phase, setPhase] = useState<'setup' | 'battle'>('setup')
  const [selectedDeck, setSelectedDeck] = useState<number | null>(null)
  const [botCount, setBotCount] = useState(1)
  const [battlePlayers, setBattlePlayers] = useState<BattlePlayer[]>([])

  const attachSkills = (cards: BattleCard[]): BattleCard[] =>
    cards.map((c) => ({
      ...c,
      skills: c.dbSkillIds && c.dbSkillIds.length > 0 ? resolveSkills(c.dbSkillIds, dbSkills, skillEffectRows) : undefined,
    }))

  const startBattle = () => {
    if (selectedDeck === null) return
    const deck = adminDecks.find((d) => d.slot === selectedDeck)
    if (!deck) return
    const admin: BattlePlayer = { id: userId, name: userName, avatar_url: avatarUrl, deck: attachSkills(deck.cards), hp: 10, eliminated: false }
    const bots = Array.from({ length: botCount }, (_, i) => {
      const bot = createBot(i, allCards)
      return { ...bot, deck: attachSkills(bot.deck) }
    })
    setBattlePlayers([admin, ...bots])
    setPhase('battle')
  }

  if (phase === 'battle' && battlePlayers.length > 0) {
    return (
      <ArenaBattle
        userId={userId}
        players={battlePlayers}
        synergyDefs={synergyDefs}
        onBattleEnd={() => { setPhase('setup'); setBattlePlayers([]) }}
      />
    )
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-center">Test Arena Setup</h2>
      <div className="mb-6">
        <h3 className="mb-3 text-sm text-zinc-400">Your Deck</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {adminDecks.map((deck) => {
            const totalPower = deck.cards.reduce((s, c) => s + (starCount[c.rarity] || 1), 0)
            const avgPower = (totalPower / deck.cards.length).toFixed(1)
            const rarityCounts: Record<string, number> = {}
            deck.cards.forEach((c) => { rarityCounts[c.rarity] = (rarityCounts[c.rarity] || 0) + 1 })
            const secretRareCount = deck.cards.filter((c) => c.rarity === 'secret_rare').length
            const illegal = secretRareCount > 1

            return (
              <button key={deck.slot} onClick={() => !illegal && setSelectedDeck(deck.slot)}
                className={`rounded-xl border p-4 text-left transition-all ${illegal ? 'border-red-800 opacity-50 cursor-not-allowed' : selectedDeck === deck.slot ? 'border-red-500 bg-red-950/30' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">{deck.name}</span>
                  <span className="text-xs text-zinc-500">⭐ {totalPower} ({avgPower} avg)</span>
                </div>
                {illegal && (
                  <div className="mb-2 rounded bg-red-900/50 px-2 py-1 text-[10px] text-red-300 text-center">
                    Max 1 Secret Rare per deck
                  </div>
                )}
                <div className="relative h-28 mb-3 flex items-center justify-center">
                  {deck.cards.map((card, i) => (
                    <div key={card.id}
                      className="absolute w-20 transition-all duration-200 hover:!z-50 hover:scale-110 hover:!translate-x-0"
                      style={{
                        left: `calc(50% + ${(i - 2) * 38}px - 40px)`,
                        top: `${Math.abs(i - 2) * 3}px`,
                        zIndex: i,
                        transform: `rotate(${(i - 2) * 4}deg)`,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'rotate(0deg) scale(1.1)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = `rotate(${(i - 2) * 4}deg)` }}
                    >
                      <CompactCard card={card} />
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(rarityCounts).sort((a, b) => (starCount[b[0]] || 0) - (starCount[a[0]] || 0)).map(([rarity, count]) => (
                    <span key={rarity} className={`rounded px-1.5 py-0.5 text-[9px] text-white ${rarityBadgeColors[rarity] || 'bg-zinc-700'}`}>
                      <span className="font-bold">{count}x</span> {rarityLabel[rarity] || rarity}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="mb-8">
        <h3 className="mb-3 text-sm text-zinc-400">Number of Bots</h3>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button key={n} onClick={() => setBotCount(n)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${botCount === n ? 'bg-red-600 text-white' : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}
            >{n}</button>
          ))}
        </div>
      </div>
      <button suppressHydrationWarning onClick={startBattle} disabled={selectedDeck == null}
        className="rounded-lg bg-red-600 px-8 py-3 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-30">
        Start Battle ({botCount + 1} players)
      </button>
    </div>
  )
}
