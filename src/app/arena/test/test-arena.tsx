'use client'

import { useState, useRef } from 'react'
import {
  type BattlePlayer,
  type BattleCard,
  type RoundResult,
  type MatchResult,
  createBot,
  pairPlayers,
  resolveFaceOff,
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
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
  const [rounds, setRounds] = useState<RoundResult[]>([])
  const [currentRound, setCurrentRound] = useState(0)
  const [currentFaceOff, setCurrentFaceOff] = useState(-1) // -1 = not started
  const [currentMatch, setCurrentMatch] = useState(0)
  const [showingResult, setShowingResult] = useState(false)
  const [precomputedRound, setPrecomputedRound] = useState<RoundResult | null>(null)
  const previousPairsRef = useRef(new Set<string>())

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
    allPlayers.forEach((p) => { hpMap[p.id] = p.hp })

    setPlayers(allPlayers)
    setDisplayHp(hpMap)
    setPhase('battle')
    setCurrentRound(0)
    setRounds([])
    previousPairsRef.current.clear()
  }

  const playRound = () => {
    const roundNum = rounds.length + 1
    const { pairs, byeId } = pairPlayers(players, previousPairsRef.current)

    // Precompute all matches for this round
    const matches: MatchResult[] = pairs.map(([id1, id2]) => {
      const p1 = players.find((p) => p.id === id1)!
      const p2 = players.find((p) => p.id === id2)!
      const deck1 = shuffle(p1.deck)
      const deck2 = shuffle(p2.deck)
      const faceOffs = []

      for (let i = 0; i < 5; i++) {
        faceOffs.push(resolveFaceOff(deck1[i], deck2[i]))
      }

      // Determine winner by simulating all damage
      let hp1 = displayHp[id1] || 0
      let hp2 = displayHp[id2] || 0
      for (const fo of faceOffs) {
        hp1 -= fo.damage1
        hp2 -= fo.damage2
        if (hp1 <= 0 || hp2 <= 0) break
      }

      let winnerId: string | null = null
      if (hp1 > hp2) winnerId = id1
      else if (hp2 > hp1) winnerId = id2
      else winnerId = Math.random() > 0.5 ? id1 : id2

      previousPairsRef.current.add([id1, id2].sort().join('-'))

      return { player1Id: id1, player2Id: id2, faceOffs, winnerId }
    })

    const round: RoundResult = { round: roundNum, matches, byePlayerId: byeId }
    setPrecomputedRound(round)
    setCurrentRound(roundNum)
    setCurrentMatch(0)
    setCurrentFaceOff(-1)
    setShowingResult(false)
  }

  const nextStep = () => {
    if (!precomputedRound) return
    const match = precomputedRound.matches[currentMatch]
    if (!match) return

    if (currentFaceOff < match.faceOffs.length - 1) {
      const nextFo = currentFaceOff + 1
      setCurrentFaceOff(nextFo)

      // Apply this face-off's damage to display HP
      const fo = match.faceOffs[nextFo]
      setDisplayHp((prev) => {
        const updated = { ...prev }
        updated[match.player1Id] = Math.max(0, (updated[match.player1Id] || 0) - fo.damage1)
        updated[match.player2Id] = Math.max(0, (updated[match.player2Id] || 0) - fo.damage2)
        return updated
      })

      // Check early KO
      setDisplayHp((prev) => {
        if ((prev[match.player1Id] || 0) <= 0 || (prev[match.player2Id] || 0) <= 0) {
          // Skip remaining face-offs for this match
          setTimeout(() => {
            if (currentMatch < precomputedRound.matches.length - 1) {
              setCurrentMatch(currentMatch + 1)
              setCurrentFaceOff(-1)
            } else {
              finishRound()
            }
          }, 1500)
        }
        return prev
      })
    } else if (currentMatch < precomputedRound.matches.length - 1) {
      setCurrentMatch(currentMatch + 1)
      setCurrentFaceOff(-1)
    } else {
      finishRound()
    }
  }

  const startMatch = () => {
    if (!precomputedRound) return
    const match = precomputedRound.matches[currentMatch]
    if (!match) return

    // Show first face-off and apply damage
    setCurrentFaceOff(0)
    const fo = match.faceOffs[0]
    setDisplayHp((prev) => {
      const updated = { ...prev }
      updated[match.player1Id] = Math.max(0, (updated[match.player1Id] || 0) - fo.damage1)
      updated[match.player2Id] = Math.max(0, (updated[match.player2Id] || 0) - fo.damage2)
      return updated
    })
  }

  const finishRound = () => {
    if (!precomputedRound) return
    setRounds((prev) => [...prev, precomputedRound])
    setShowingResult(true)

    // Update player state with final HP and elimination
    setPlayers((prev) => prev.map((p) => ({
      ...p,
      hp: displayHp[p.id] ?? p.hp,
      eliminated: (displayHp[p.id] ?? p.hp) <= 0,
    })))
  }

  const canContinue = () => {
    const alive = Object.entries(displayHp).filter(([, hp]) => hp > 0)
    return alive.length > 1 && (rounds.length + (showingResult ? 0 : -1)) < 2
  }

  const getPlayer = (id: string) => players.find((p) => p.id === id)
  const sortedByHp = [...players].sort((a, b) => (displayHp[b.id] ?? b.hp) - (displayHp[a.id] ?? a.hp))
  const activeMatch = precomputedRound?.matches[currentMatch]

  return (
    <div>
      {/* Setup phase */}
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
                <button
                  key={n}
                  onClick={() => setBotCount(n)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    botCount === n ? 'bg-red-600 text-white' : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startBattle}
            disabled={selectedDeck === null}
            className="rounded-lg bg-red-600 px-8 py-3 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-30"
          >
            Start Battle ({botCount + 1} players)
          </button>
        </div>
      )}

      {/* Battle phase */}
      {phase === 'battle' && (
        <div>
          {/* Scoreboard */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm text-zinc-400">Scoreboard</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {sortedByHp.map((p) => {
                const hp = displayHp[p.id] ?? p.hp
                const isInMatch = activeMatch && (activeMatch.player1Id === p.id || activeMatch.player2Id === p.id)
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg border p-3 text-center transition-all ${
                      hp <= 0
                        ? 'border-zinc-800 bg-zinc-900/50 opacity-50'
                        : isInMatch
                          ? 'border-red-600 bg-red-950/20'
                          : p.id === userId
                            ? 'border-amber-700 bg-amber-950/20'
                            : 'border-zinc-800 bg-zinc-900'
                    }`}
                  >
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    {/* HP bar */}
                    <div className="mt-1 h-2 w-full rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${hp <= 3 ? 'bg-red-500' : hp <= 6 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${(hp / 10) * 100}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold ${hp <= 3 ? 'text-red-400' : 'text-green-400'}`}>
                      {hp} HP
                    </span>
                    {hp <= 0 && <span className="block text-[10px] text-red-400">ELIMINATED</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Match display */}
          {activeMatch && !showingResult && (
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="mb-1 text-center text-sm text-zinc-400">
                Round {currentRound} — Match {currentMatch + 1}/{precomputedRound?.matches.length}
              </h3>
              <div className="mb-4 text-center text-lg font-bold">
                {getPlayer(activeMatch.player1Id)?.name}
                <span className="mx-2 text-zinc-600">vs</span>
                {getPlayer(activeMatch.player2Id)?.name}
              </div>

              {/* Pre-match: show start button */}
              {currentFaceOff === -1 && (
                <div className="text-center">
                  <button
                    onClick={startMatch}
                    className="rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-500"
                  >
                    Reveal Cards
                  </button>
                </div>
              )}

              {/* Face-off display */}
              {currentFaceOff >= 0 && (() => {
                const fo = activeMatch.faceOffs[currentFaceOff]
                if (!fo) return null
                const p1Hp = displayHp[activeMatch.player1Id] ?? 0
                const p2Hp = displayHp[activeMatch.player2Id] ?? 0
                const ko = p1Hp <= 0 || p2Hp <= 0
                return (
                  <>
                    <div className="flex items-center justify-center gap-4 sm:gap-8">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-20">
                          <CompactCard card={fo.card1} />
                        </div>
                        <span className="text-xs text-zinc-400">⭐ {starCount[fo.card1.rarity]}</span>
                        {fo.damage1 > 0 && <span className="text-sm font-bold text-red-400 animate-pulse">-{fo.damage1} HP</span>}
                        {fo.damage1 === 0 && fo.damage2 === 0 && <span className="text-xs text-zinc-500">Tie</span>}
                        {fo.damage2 > 0 && <span className="text-xs font-bold text-green-400">Wins!</span>}
                      </div>

                      <div className="text-xl font-black text-zinc-600">VS</div>

                      <div className="flex flex-col items-center gap-2">
                        <div className="w-20">
                          <CompactCard card={fo.card2} />
                        </div>
                        <span className="text-xs text-zinc-400">⭐ {starCount[fo.card2.rarity]}</span>
                        {fo.damage2 > 0 && <span className="text-sm font-bold text-red-400 animate-pulse">-{fo.damage2} HP</span>}
                        {fo.damage2 === 0 && fo.damage1 === 0 && <span className="text-xs text-zinc-500">Tie</span>}
                        {fo.damage1 > 0 && <span className="text-xs font-bold text-green-400">Wins!</span>}
                      </div>
                    </div>

                    <div className="mt-3 text-center text-xs text-zinc-500">
                      Card {currentFaceOff + 1}/5
                      {ko && <span className="ml-2 text-red-400 font-bold">KO!</span>}
                    </div>

                    {!ko && (
                      <div className="mt-4 flex justify-center">
                        <button
                          onClick={nextStep}
                          className="rounded-lg bg-zinc-700 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-600"
                        >
                          {currentFaceOff < activeMatch.faceOffs.length - 1
                            ? 'Next Card'
                            : currentMatch < (precomputedRound?.matches.length || 0) - 1
                              ? 'Next Match'
                              : 'See Results'}
                        </button>
                      </div>
                    )}

                    {ko && (
                      <div className="mt-4 flex justify-center">
                        <button
                          onClick={() => {
                            if (currentMatch < (precomputedRound?.matches.length || 0) - 1) {
                              setCurrentMatch(currentMatch + 1)
                              setCurrentFaceOff(-1)
                            } else {
                              finishRound()
                            }
                          }}
                          className="rounded-lg bg-zinc-700 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-600"
                        >
                          {currentMatch < (precomputedRound?.matches.length || 0) - 1 ? 'Next Match' : 'See Results'}
                        </button>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Round result */}
          {showingResult && precomputedRound && (
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
              <h3 className="mb-4 text-lg font-bold">Round {currentRound} Complete</h3>
              {precomputedRound.matches.map((m, i) => {
                const p1 = getPlayer(m.player1Id)
                const p2 = getPlayer(m.player2Id)
                return (
                  <div key={i} className="mb-2 text-sm">
                    <span className={m.winnerId === m.player1Id ? 'text-green-400 font-medium' : 'text-zinc-400'}>
                      {p1?.name}
                    </span>
                    <span className="text-zinc-600"> vs </span>
                    <span className={m.winnerId === m.player2Id ? 'text-green-400 font-medium' : 'text-zinc-400'}>
                      {p2?.name}
                    </span>
                    <span className="text-zinc-500"> — {getPlayer(m.winnerId || '')?.name} wins</span>
                  </div>
                )
              })}
              {precomputedRound.byePlayerId && (
                <div className="mt-2 text-xs text-zinc-500">
                  {getPlayer(precomputedRound.byePlayerId)?.name} had a bye
                </div>
              )}

              {canContinue() ? (
                <button
                  onClick={playRound}
                  className="mt-4 rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-500"
                >
                  Next Round
                </button>
              ) : (
                <button
                  onClick={() => setPhase('done')}
                  className="mt-4 rounded-lg bg-white px-6 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-200"
                >
                  Final Results
                </button>
              )}
            </div>
          )}

          {/* Start first round */}
          {!precomputedRound && !showingResult && (
            <div className="text-center">
              <button
                onClick={playRound}
                className="rounded-lg bg-red-600 px-8 py-3 text-sm font-bold text-white hover:bg-red-500"
              >
                Start Round 1
              </button>
            </div>
          )}
        </div>
      )}

      {/* Done phase */}
      {phase === 'done' && (
        <div className="text-center">
          <span className="mb-4 block text-5xl">🏆</span>
          <h2 className="mb-2 text-2xl font-bold">{sortedByHp[0]?.name} Wins!</h2>
          <p className="mb-6 text-sm text-zinc-400">{displayHp[sortedByHp[0]?.id] ?? 0} HP remaining</p>

          <div className="mb-8">
            <h3 className="mb-3 text-sm text-zinc-400">Final Standings</h3>
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

          <button
            onClick={() => { setPhase('setup'); setRounds([]); setPlayers([]); setPrecomputedRound(null); previousPairsRef.current.clear() }}
            className="rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  )
}
