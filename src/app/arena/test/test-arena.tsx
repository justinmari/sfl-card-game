'use client'

import { useState } from 'react'
import {
  type BattlePlayer,
  type BattleCard,
  type RoundResult,
  type FaceOff,
  createBot,
  runRound,
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
  const [rounds, setRounds] = useState<RoundResult[]>([])
  const [currentRound, setCurrentRound] = useState(0)
  const [currentFaceOff, setCurrentFaceOff] = useState(0)
  const [currentMatch, setCurrentMatch] = useState(0)
  const [showingResult, setShowingResult] = useState(false)
  const [previousPairs] = useState(new Set<string>())

  const startBattle = () => {
    if (selectedDeck === null) return
    const deck = adminDecks.find((d) => d.slot === selectedDeck)
    if (!deck) return

    const admin: BattlePlayer = {
      id: userId,
      name: userName,
      avatar_url: avatarUrl,
      deck: deck.cards,
      hp: 10,
      eliminated: false,
    }

    const bots = Array.from({ length: botCount }, (_, i) => createBot(i, allCards))
    const allPlayers = [admin, ...bots]
    setPlayers(allPlayers)
    setPhase('battle')
    setCurrentRound(0)
    setCurrentMatch(0)
    setCurrentFaceOff(0)
    setRounds([])
  }

  const playRound = () => {
    const roundNum = rounds.length + 1
    const result = runRound(players, roundNum, previousPairs)
    setRounds((prev) => [...prev, result])
    setCurrentRound(roundNum)
    setCurrentMatch(0)
    setCurrentFaceOff(0)
    setShowingResult(false)

    // Check if tournament is over
    const alive = players.filter((p) => !p.eliminated)
    if (alive.length <= 1 || roundNum >= 3) {
      setTimeout(() => setPhase('done'), 100)
    }
  }

  const activeRound = rounds[rounds.length - 1]
  const activeMatch = activeRound?.matches[currentMatch]

  const nextFaceOff = () => {
    if (!activeMatch) return
    if (currentFaceOff < activeMatch.faceOffs.length - 1) {
      setCurrentFaceOff(currentFaceOff + 1)
    } else if (currentMatch < activeRound.matches.length - 1) {
      setCurrentMatch(currentMatch + 1)
      setCurrentFaceOff(0)
    } else {
      setShowingResult(true)
    }
  }

  const getPlayer = (id: string) => players.find((p) => p.id === id)
  const sortedPlayers = [...players].sort((a, b) => b.hp - a.hp)
  const winner = phase === 'done' ? sortedPlayers[0] : null

  return (
    <div>
      {/* Setup phase */}
      {phase === 'setup' && (
        <div>
          <h2 className="mb-6 text-xl font-bold text-center">Test Arena Setup</h2>

          {/* Deck selection */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm text-zinc-400">Your Deck</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {adminDecks.map((deck) => (
                <button
                  key={deck.slot}
                  onClick={() => setSelectedDeck(deck.slot)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    selectedDeck === deck.slot
                      ? 'border-red-500 bg-red-950/30'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-sm font-semibold">{deck.name}</span>
                  <div className="mt-2 flex gap-1">
                    {deck.cards.map((card) => (
                      <div key={card.id} className="h-8 w-6 overflow-hidden rounded border border-zinc-700">
                        {card.image_url ? (
                          <img src={card.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-[6px]">🃏</div>
                        )}
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Bot count */}
          <div className="mb-8">
            <h3 className="mb-3 text-sm text-zinc-400">Number of Bots</h3>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  onClick={() => setBotCount(n)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    botCount === n
                      ? 'bg-red-600 text-white'
                      : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
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
            className="rounded-lg bg-red-600 px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-30"
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
              {sortedPlayers.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-lg border p-3 text-center ${
                    p.eliminated
                      ? 'border-zinc-800 bg-zinc-900/50 opacity-50'
                      : p.id === userId
                        ? 'border-amber-700 bg-amber-950/20'
                        : 'border-zinc-800 bg-zinc-900'
                  }`}
                >
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <span className={`text-lg font-bold ${p.hp <= 3 ? 'text-red-400' : 'text-green-400'}`}>
                      {p.hp}
                    </span>
                    <span className="text-xs text-zinc-500">HP</span>
                  </div>
                  {p.eliminated && <span className="text-[10px] text-red-400">ELIMINATED</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Current match */}
          {activeMatch && !showingResult && (
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="mb-4 text-center text-sm text-zinc-400">
                Round {currentRound} — Match {currentMatch + 1}/{activeRound.matches.length}
              </h3>
              <div className="mb-2 text-center text-lg font-bold">
                {getPlayer(activeMatch.player1Id)?.name} vs {getPlayer(activeMatch.player2Id)?.name}
              </div>

              {/* Face-off display */}
              {(() => {
                const fo = activeMatch.faceOffs[currentFaceOff]
                if (!fo) return null
                return (
                  <div className="flex items-center justify-center gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-20">
                        <CompactCard card={fo.card1} />
                      </div>
                      <span className="text-xs text-zinc-400">⭐ {starCount[fo.card1.rarity]}</span>
                      {fo.damage1 > 0 && <span className="text-sm font-bold text-red-400">-{fo.damage1} HP</span>}
                      {fo.damage1 === 0 && fo.damage2 === 0 && <span className="text-sm text-zinc-500">Tie</span>}
                      {fo.damage2 > 0 && <span className="text-sm font-bold text-green-400">Winner!</span>}
                    </div>

                    <div className="text-2xl font-black text-zinc-600">VS</div>

                    <div className="flex flex-col items-center gap-2">
                      <div className="w-20">
                        <CompactCard card={fo.card2} />
                      </div>
                      <span className="text-xs text-zinc-400">⭐ {starCount[fo.card2.rarity]}</span>
                      {fo.damage2 > 0 && <span className="text-sm font-bold text-red-400">-{fo.damage2} HP</span>}
                      {fo.damage2 === 0 && fo.damage1 === 0 && <span className="text-sm text-zinc-500">Tie</span>}
                      {fo.damage1 > 0 && <span className="text-sm font-bold text-green-400">Winner!</span>}
                    </div>
                  </div>
                )
              })()}

              <div className="mt-4 text-center text-xs text-zinc-500">
                Face-off {currentFaceOff + 1}/5
              </div>

              <div className="mt-4 flex justify-center">
                <button
                  onClick={nextFaceOff}
                  className="rounded-lg bg-zinc-700 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-600"
                >
                  {currentFaceOff < activeMatch.faceOffs.length - 1
                    ? 'Next Card'
                    : currentMatch < activeRound.matches.length - 1
                      ? 'Next Match'
                      : 'See Results'}
                </button>
              </div>
            </div>
          )}

          {/* Round result */}
          {showingResult && activeRound && (
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
              <h3 className="mb-4 text-lg font-bold">Round {currentRound} Complete</h3>
              {activeRound.matches.map((m, i) => {
                const p1 = getPlayer(m.player1Id)
                const p2 = getPlayer(m.player2Id)
                const winner = getPlayer(m.winnerId || '')
                return (
                  <div key={i} className="mb-2 text-sm">
                    <span className={m.winnerId === m.player1Id ? 'text-green-400 font-medium' : 'text-zinc-400'}>
                      {p1?.name}
                    </span>
                    <span className="text-zinc-600"> vs </span>
                    <span className={m.winnerId === m.player2Id ? 'text-green-400 font-medium' : 'text-zinc-400'}>
                      {p2?.name}
                    </span>
                    <span className="text-zinc-500"> — {winner?.name} wins</span>
                  </div>
                )
              })}
              {activeRound.byePlayerId && (
                <div className="mt-2 text-xs text-zinc-500">
                  {getPlayer(activeRound.byePlayerId)?.name} had a bye
                </div>
              )}

              {players.filter((p) => !p.eliminated).length > 1 && rounds.length < 3 && (
                <button
                  onClick={playRound}
                  className="mt-4 rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-500"
                >
                  Next Round
                </button>
              )}
              {(players.filter((p) => !p.eliminated).length <= 1 || rounds.length >= 3) && (
                <button
                  onClick={() => setPhase('done')}
                  className="mt-4 rounded-lg bg-white px-6 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-200"
                >
                  See Final Results
                </button>
              )}
            </div>
          )}

          {/* No active round yet */}
          {!activeRound && (
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
      {phase === 'done' && winner && (
        <div className="text-center">
          <span className="mb-4 block text-5xl">🏆</span>
          <h2 className="mb-2 text-2xl font-bold">{winner.name} Wins!</h2>
          <p className="mb-6 text-sm text-zinc-400">{winner.hp} HP remaining</p>

          <div className="mb-8">
            <h3 className="mb-3 text-sm text-zinc-400">Final Standings</h3>
            {sortedPlayers.map((p, i) => (
              <div key={p.id} className="mb-2 flex items-center justify-center gap-3">
                <span className="w-6 text-right text-sm font-bold text-zinc-500">#{i + 1}</span>
                <span className={`text-sm ${i === 0 ? 'text-amber-400 font-bold' : 'text-zinc-300'}`}>
                  {p.name}
                </span>
                <span className={`text-sm ${p.hp > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {p.hp} HP
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => { setPhase('setup'); setRounds([]); setPlayers([]); previousPairs.clear() }}
            className="rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  )
}
