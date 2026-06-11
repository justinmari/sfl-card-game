'use client'

import { useState } from 'react'
import {
  type BattlePlayer,
  type BattleCard,
  type RoundResult,
  createBot,
  precomputeRound,
} from '@/lib/battle-engine'
import CompactCard from '@/components/compact-card'

type DeckOption = {
  slot: number
  name: string
  cards: BattleCard[]
}

const starCount: Record<string, number> = {
  common: 1, uncommon: 2, rare: 3, ultra_rare: 4, legendary: 5, secret_rare: 6,
}

export default function TestArena({
  userId,
  userName,
  avatarUrl,
  adminDecks,
  allCards,
}: {
  userId: string
  userName: string
  avatarUrl: string | null
  adminDecks: DeckOption[]
  allCards: BattleCard[]
}) {
  const [phase, setPhase] = useState<'setup' | 'battle' | 'done'>('setup')
  const [selectedDeck, setSelectedDeck] = useState<number | null>(null)
  const [botCount, setBotCount] = useState(1)
  const [players, setPlayers] = useState<BattlePlayer[]>([])
  const [displayHp, setDisplayHp] = useState<Record<string, number>>({})
  const [roundNum, setRoundNum] = useState(0)
  const [precomputed, setPrecomputed] = useState<RoundResult | null>(null)
  const [currentMatch, setCurrentMatch] = useState(0)
  const [currentFaceOff, setCurrentFaceOff] = useState(-1)
  const [showingRoundResult, setShowingRoundResult] = useState(false)

  const aliveCount = () => Object.values(displayHp).filter((hp) => hp > 0).length

  const startBattle = () => {
    if (selectedDeck === null) return
    const deck = adminDecks.find((d) => d.slot === selectedDeck)
    if (!deck) return

    const admin: BattlePlayer = {
      id: userId, name: userName, avatar_url: avatarUrl,
      deck: deck.cards, hp: 10, eliminated: false,
    }
    const bots = Array.from({ length: botCount }, (_, i) => createBot(i, allCards))
    const allPlayers = [admin, ...bots]
    const hpMap: Record<string, number> = {}
    allPlayers.forEach((p) => { hpMap[p.id] = 10 })

    setPlayers(allPlayers)
    setDisplayHp(hpMap)
    setPhase('battle')
    setRoundNum(0)
    setPrecomputed(null)
    setShowingRoundResult(false)
  }

  const startNextRound = () => {
    const nextRound = roundNum + 1
    // Update players with current displayHp
    const updated = players.map((p) => ({
      ...p,
      hp: displayHp[p.id] ?? 0,
      eliminated: (displayHp[p.id] ?? 0) <= 0,
    }))
    setPlayers(updated)

    const result = precomputeRound(updated, displayHp, nextRound)
    setPrecomputed(result)
    setRoundNum(nextRound)
    setCurrentMatch(0)
    setCurrentFaceOff(-1)
    setShowingRoundResult(false)
  }

  const revealCards = () => {
    if (!precomputed) return
    const match = precomputed.matches[currentMatch]
    if (!match) return
    setCurrentFaceOff(0)
    // Apply first face-off damage
    const fo = match.faceOffs[0]
    setDisplayHp((prev) => ({
      ...prev,
      [match.player1Id]: Math.max(0, (prev[match.player1Id] || 0) - fo.damage1),
      [match.player2Id]: Math.max(0, (prev[match.player2Id] || 0) - fo.damage2),
    }))
  }

  const nextCard = () => {
    if (!precomputed) return
    const match = precomputed.matches[currentMatch]
    if (!match) return

    const nextFo = currentFaceOff + 1
    if (nextFo < match.faceOffs.length) {
      setCurrentFaceOff(nextFo)
      const fo = match.faceOffs[nextFo]
      setDisplayHp((prev) => ({
        ...prev,
        [match.player1Id]: Math.max(0, (prev[match.player1Id] || 0) - fo.damage1),
        [match.player2Id]: Math.max(0, (prev[match.player2Id] || 0) - fo.damage2),
      }))
    }
  }

  const nextMatch = () => {
    if (!precomputed) return
    if (currentMatch < precomputed.matches.length - 1) {
      setCurrentMatch(currentMatch + 1)
      setCurrentFaceOff(-1)
    } else {
      setShowingRoundResult(true)
    }
  }

  const checkGameOver = () => {
    return aliveCount() <= 1
  }

  const getPlayer = (id: string) => players.find((p) => p.id === id)
  const sortedByHp = [...players].sort((a, b) => (displayHp[b.id] ?? 0) - (displayHp[a.id] ?? 0))
  const activeMatch = precomputed?.matches[currentMatch]
  const activeFo = activeMatch && currentFaceOff >= 0 ? activeMatch.faceOffs[currentFaceOff] : null
  const p1Hp = activeMatch ? (displayHp[activeMatch.player1Id] ?? 0) : 0
  const p2Hp = activeMatch ? (displayHp[activeMatch.player2Id] ?? 0) : 0
  const isKo = activeMatch && (p1Hp <= 0 || p2Hp <= 0)
  const isLastCard = activeMatch && currentFaceOff >= activeMatch.faceOffs.length - 1
  const isLastMatch = precomputed && currentMatch >= precomputed.matches.length - 1

  return (
    <div>
      {/* ===== SETUP ===== */}
      {phase === 'setup' && (
        <div>
          <h2 className="mb-6 text-xl font-bold text-center">Test Arena Setup</h2>

          <div className="mb-6">
            <h3 className="mb-3 text-sm text-zinc-400">Your Deck</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {adminDecks.map((deck) => (
                <button
                  key={deck.slot}
                  onClick={() => setSelectedDeck(deck.slot)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    selectedDeck === deck.slot ? 'border-red-500 bg-red-950/30' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-sm font-semibold">{deck.name}</span>
                  <div className="mt-2 flex gap-1">
                    {deck.cards.map((card) => (
                      <div key={card.id} className="h-8 w-6 overflow-hidden rounded border border-zinc-700">
                        {card.image_url ? <img src={card.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-[6px]">🃏</div>}
                      </div>
                    ))}
                  </div>
                </button>
              ))}
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

          <button onClick={startBattle} disabled={selectedDeck === null}
            className="rounded-lg bg-red-600 px-8 py-3 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-30"
          >
            Start Battle ({botCount + 1} players)
          </button>
        </div>
      )}

      {/* ===== BATTLE ===== */}
      {phase === 'battle' && (
        <div>
          {/* Scoreboard */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm text-zinc-400">Scoreboard</h3>
              <span className="text-sm text-zinc-500">{aliveCount()} alive</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {sortedByHp.map((p) => {
                const hp = displayHp[p.id] ?? 0
                const fighting = activeMatch && !showingRoundResult && (activeMatch.player1Id === p.id || activeMatch.player2Id === p.id)
                return (
                  <div key={p.id}
                    className={`rounded-lg border p-3 text-center transition-all ${
                      hp <= 0 ? 'border-zinc-800 opacity-40'
                      : fighting ? 'border-red-600 bg-red-950/20'
                      : p.id === userId ? 'border-amber-700 bg-amber-950/20'
                      : 'border-zinc-800 bg-zinc-900'
                    }`}
                  >
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-800">
                      <div className={`h-full rounded-full transition-all duration-500 ${hp <= 3 ? 'bg-red-500' : hp <= 6 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${(hp / 10) * 100}%` }} />
                    </div>
                    <span className={`text-xs font-bold ${hp <= 3 ? 'text-red-400' : 'text-green-400'}`}>{hp}</span>
                    {hp <= 0 && <span className="block text-[9px] text-red-400">DEAD</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* No round yet */}
          {!precomputed && !showingRoundResult && (
            <div className="text-center py-8">
              <button onClick={startNextRound}
                className="rounded-lg bg-red-600 px-8 py-3 text-sm font-bold text-white hover:bg-red-500"
              >
                Start Round 1
              </button>
            </div>
          )}

          {/* Active match */}
          {activeMatch && !showingRoundResult && (
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-1 text-center text-xs text-zinc-500">
                Round {roundNum} — Match {currentMatch + 1}/{precomputed?.matches.length}
              </div>
              <div className="mb-4 text-center">
                <span className="text-lg font-bold">
                  {getPlayer(activeMatch.player1Id)?.name}
                  <span className="mx-2 text-sm text-zinc-500">({p1Hp} HP)</span>
                </span>
                <span className="mx-3 text-zinc-600 font-black">VS</span>
                <span className="text-lg font-bold">
                  {getPlayer(activeMatch.player2Id)?.name}
                  <span className="mx-2 text-sm text-zinc-500">({p2Hp} HP)</span>
                </span>
              </div>

              {/* Pre-reveal */}
              {currentFaceOff === -1 && (
                <div className="text-center">
                  <button onClick={revealCards}
                    className="rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-500"
                  >
                    Reveal Cards
                  </button>
                </div>
              )}

              {/* Face-off */}
              {activeFo && (
                <>
                  <div className="flex items-center justify-center gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-20"><CompactCard card={activeFo.card1} /></div>
                      <span className="text-xs text-zinc-400">
                        ⭐ {('star1' in activeFo) ? (activeFo as any).star1 : starCount[activeFo.card1.rarity]}
                        {('roll1' in activeFo) && (activeFo as any).roll1 > 0 && (
                          <span className="text-amber-400"> +{(activeFo as any).roll1} 🎲</span>
                        )}
                        {(' = ' + (('effective1' in activeFo) ? (activeFo as any).effective1 : ''))}
                      </span>
                      {activeFo.damage1 > 0 && <span className="text-sm font-bold text-red-400 animate-pulse">-{activeFo.damage1}</span>}
                      {activeFo.damage2 > 0 && <span className="text-xs font-bold text-green-400">Wins!</span>}
                      {activeFo.damage1 === 0 && activeFo.damage2 === 0 && <span className="text-xs text-zinc-500">Tie</span>}
                    </div>
                    <span className="text-xl font-black text-zinc-700">VS</span>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-20"><CompactCard card={activeFo.card2} /></div>
                      <span className="text-xs text-zinc-400">
                        ⭐ {('star2' in activeFo) ? (activeFo as any).star2 : starCount[activeFo.card2.rarity]}
                        {('roll2' in activeFo) && (activeFo as any).roll2 > 0 && (
                          <span className="text-amber-400"> +{(activeFo as any).roll2} 🎲</span>
                        )}
                        {(' = ' + (('effective2' in activeFo) ? (activeFo as any).effective2 : ''))}
                      </span>
                      {activeFo.damage2 > 0 && <span className="text-sm font-bold text-red-400 animate-pulse">-{activeFo.damage2}</span>}
                      {activeFo.damage1 > 0 && <span className="text-xs font-bold text-green-400">Wins!</span>}
                      {activeFo.damage2 === 0 && activeFo.damage1 === 0 && <span className="text-xs text-zinc-500">Tie</span>}
                    </div>
                  </div>

                  <div className="mt-3 text-center text-xs text-zinc-500">
                    Card {currentFaceOff + 1}/5
                    {isKo && <span className="ml-2 text-red-400 font-bold">💀 KO!</span>}
                  </div>

                  <div className="mt-4 flex justify-center">
                    {isKo || isLastCard ? (
                      <button onClick={nextMatch}
                        className="rounded-lg bg-zinc-700 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-600"
                      >
                        {isLastMatch ? 'End Round' : 'Next Match'}
                      </button>
                    ) : (
                      <button onClick={nextCard}
                        className="rounded-lg bg-zinc-700 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-600"
                      >
                        Next Card
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Round result */}
          {showingRoundResult && precomputed && (
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
              <h3 className="mb-4 text-lg font-bold">Round {roundNum} Complete</h3>
              {precomputed.matches.map((m, i) => {
                const winner = getPlayer(m.winnerId || '')
                return (
                  <div key={i} className="mb-2 text-sm">
                    <span className={m.winnerId === m.player1Id ? 'text-green-400 font-medium' : 'text-zinc-400'}>
                      {getPlayer(m.player1Id)?.name}
                    </span>
                    <span className="text-zinc-600"> vs </span>
                    <span className={m.winnerId === m.player2Id ? 'text-green-400 font-medium' : 'text-zinc-400'}>
                      {getPlayer(m.player2Id)?.name}
                    </span>
                    <span className="text-zinc-500"> — {winner?.name} wins</span>
                  </div>
                )
              })}
              {precomputed.byePlayerId && (
                <div className="mt-2 text-xs text-zinc-500">
                  {getPlayer(precomputed.byePlayerId)?.name} got a bye
                </div>
              )}

              {checkGameOver() ? (
                <button onClick={() => setPhase('done')}
                  className="mt-4 rounded-lg bg-white px-6 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-200"
                >
                  Final Results
                </button>
              ) : (
                <button onClick={() => { setPrecomputed(null); setShowingRoundResult(false); startNextRound() }}
                  className="mt-4 rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-500"
                >
                  Next Round
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== DONE ===== */}
      {phase === 'done' && (
        <div className="text-center">
          <span className="mb-4 block text-5xl">🏆</span>
          <h2 className="mb-2 text-2xl font-bold">{sortedByHp[0]?.name} Wins!</h2>
          <p className="mb-2 text-sm text-zinc-400">{displayHp[sortedByHp[0]?.id] ?? 0} HP remaining</p>
          <p className="mb-6 text-xs text-zinc-500">Completed in {roundNum} rounds</p>

          <div className="mb-8">
            {sortedByHp.map((p, i) => (
              <div key={p.id} className="mb-2 flex items-center justify-center gap-3">
                <span className="w-6 text-right text-sm font-bold text-zinc-500">#{i + 1}</span>
                <span className={`text-sm ${i === 0 ? 'text-amber-400 font-bold' : 'text-zinc-300'}`}>{p.name}</span>
                <span className={`text-sm ${(displayHp[p.id] ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {displayHp[p.id] ?? 0} HP
                </span>
              </div>
            ))}
          </div>

          <button onClick={() => { setPhase('setup'); setPlayers([]); setPrecomputed(null); setRoundNum(0) }}
            className="rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  )
}
