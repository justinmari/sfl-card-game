'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  type BattlePlayer,
  type BattleCard,
  type RoundResult,
  type FaceOffDetail,
  createBot,
  precomputeRound,
} from '@/lib/battle-engine'
import CompactCard from '@/components/compact-card'

type DeckOption = { slot: number; name: string; cards: BattleCard[] }

const starCount: Record<string, number> = {
  common: 1, uncommon: 2, rare: 3, ultra_rare: 4, legendary: 5, secret_rare: 6,
}

type AutoState = {
  phase: 'match-intro' | 'card-enter' | 'card-result' | 'match-end' | 'round-end'
  matchIdx: number
  cardIdx: number
}

export default function TestArena({
  userId, userName, avatarUrl, adminDecks, allCards,
}: {
  userId: string; userName: string; avatarUrl: string | null
  adminDecks: DeckOption[]; allCards: BattleCard[]
}) {
  const [phase, setPhase] = useState<'setup' | 'battle' | 'done'>('setup')
  const [selectedDeck, setSelectedDeck] = useState<number | null>(null)
  const [botCount, setBotCount] = useState(1)
  const [players, setPlayers] = useState<BattlePlayer[]>([])
  const [displayHp, setDisplayHp] = useState<Record<string, number>>({})
  const [roundNum, setRoundNum] = useState(0)
  const [precomputed, setPrecomputed] = useState<RoundResult | null>(null)
  const [auto, setAuto] = useState<AutoState | null>(null)
  const [showRoundEnd, setShowRoundEnd] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const aliveCount = () => Object.values(displayHp).filter((hp) => hp > 0).length

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }

  const startBattle = () => {
    if (selectedDeck === null) return
    const deck = adminDecks.find((d) => d.slot === selectedDeck)
    if (!deck) return
    const admin: BattlePlayer = { id: userId, name: userName, avatar_url: avatarUrl, deck: deck.cards, hp: 10, eliminated: false }
    const bots = Array.from({ length: botCount }, (_, i) => createBot(i, allCards))
    const all = [admin, ...bots]
    const hpMap: Record<string, number> = {}
    all.forEach((p) => { hpMap[p.id] = 10 })
    setPlayers(all)
    setDisplayHp(hpMap)
    setPhase('battle')
    setRoundNum(0)
    setPrecomputed(null)
    setAuto(null)
    setShowRoundEnd(false)
  }

  const startNextRound = useCallback(() => {
    const nextRound = roundNum + 1
    const updated = players.map((p) => ({ ...p, hp: displayHp[p.id] ?? 0, eliminated: (displayHp[p.id] ?? 0) <= 0 }))
    setPlayers(updated)
    const result = precomputeRound(updated, displayHp, nextRound)
    setPrecomputed(result)
    setRoundNum(nextRound)
    setShowRoundEnd(false)
    // Start auto animation
    if (result.matches.length > 0) {
      setAuto({ phase: 'match-intro', matchIdx: 0, cardIdx: 0 })
    }
  }, [roundNum, players, displayHp])

  // Auto-advance timer
  useEffect(() => {
    if (!auto || !precomputed) return
    clearTimer()

    const match = precomputed.matches[auto.matchIdx]
    if (!match) return

    const delay = (() => {
      switch (auto.phase) {
        case 'match-intro': return 1500
        case 'card-enter': return 800
        case 'card-result': return 1200
        case 'match-end': return 2000
        case 'round-end': return 0
        default: return 1000
      }
    })()

    timerRef.current = setTimeout(() => {
      const match = precomputed.matches[auto.matchIdx]
      if (!match) return

      switch (auto.phase) {
        case 'match-intro':
          // Show first card entering
          setAuto({ ...auto, phase: 'card-enter' })
          break

        case 'card-enter':
          // Apply damage and show result
          const fo = match.faceOffs[auto.cardIdx] as FaceOffDetail
          if (fo) {
            setDisplayHp((prev) => ({
              ...prev,
              [match.player1Id]: Math.max(0, (prev[match.player1Id] || 0) - fo.damage1),
              [match.player2Id]: Math.max(0, (prev[match.player2Id] || 0) - fo.damage2),
            }))
          }
          setAuto({ ...auto, phase: 'card-result' })
          break

        case 'card-result': {
          // Check KO or advance to next card
          const p1Hp = displayHp[match.player1Id] ?? 0
          const p2Hp = displayHp[match.player2Id] ?? 0
          const koAfterThis = (() => {
            // Recalculate since displayHp might not have updated yet
            const fo = match.faceOffs[auto.cardIdx] as FaceOffDetail
            const h1 = (displayHp[match.player1Id] || 0) - (fo?.damage1 || 0)
            const h2 = (displayHp[match.player2Id] || 0) - (fo?.damage2 || 0)
            return h1 <= 0 || h2 <= 0
          })()

          if (koAfterThis || auto.cardIdx >= 4) {
            // Match over
            setAuto({ ...auto, phase: 'match-end' })
          } else {
            // Next card
            setAuto({ ...auto, phase: 'card-enter', cardIdx: auto.cardIdx + 1 })
          }
          break
        }

        case 'match-end':
          // Move to next match or end round
          if (auto.matchIdx < precomputed.matches.length - 1) {
            setAuto({ phase: 'match-intro', matchIdx: auto.matchIdx + 1, cardIdx: 0 })
          } else {
            setAuto(null)
            setShowRoundEnd(true)
          }
          break
      }
    }, delay)

    return clearTimer
  }, [auto, precomputed, displayHp])

  const getPlayer = (id: string) => players.find((p) => p.id === id)
  const sortedByHp = [...players].sort((a, b) => (displayHp[b.id] ?? 0) - (displayHp[a.id] ?? 0))
  const activeMatch = precomputed && auto ? precomputed.matches[auto.matchIdx] : null
  const activeFo = activeMatch && auto && auto.cardIdx >= 0 ? activeMatch.faceOffs[auto.cardIdx] as FaceOffDetail : null

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
                <button key={deck.slot} onClick={() => setSelectedDeck(deck.slot)}
                  className={`rounded-xl border p-4 text-left transition-all ${selectedDeck === deck.slot ? 'border-red-500 bg-red-950/30' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'}`}>
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
            className="rounded-lg bg-red-600 px-8 py-3 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-30">
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
              <h3 className="text-sm text-zinc-400">Round {roundNum || '—'}</h3>
              <span className="text-sm text-zinc-500">{aliveCount()} alive</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {sortedByHp.map((p) => {
                const hp = displayHp[p.id] ?? 0
                const fighting = activeMatch && (activeMatch.player1Id === p.id || activeMatch.player2Id === p.id)
                return (
                  <div key={p.id}
                    className={`rounded-lg border p-3 text-center transition-all duration-300 ${
                      hp <= 0 ? 'border-zinc-800 opacity-40'
                      : fighting ? 'border-red-600 bg-red-950/20 scale-105'
                      : p.id === userId ? 'border-amber-700 bg-amber-950/20'
                      : 'border-zinc-800 bg-zinc-900'
                    }`}>
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-800">
                      <div className={`h-full rounded-full transition-all duration-700 ease-out ${hp <= 3 ? 'bg-red-500' : hp <= 6 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${(hp / 10) * 100}%` }} />
                    </div>
                    <span className={`text-xs font-bold ${hp <= 3 ? 'text-red-400' : 'text-green-400'}`}>{hp}</span>
                    {hp <= 0 && <span className="block text-[9px] text-red-400">DEAD</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Match intro */}
          {auto?.phase === 'match-intro' && activeMatch && (
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center animate-[fadeIn_0.5s_ease-out]">
              <div className="text-xs text-zinc-500 mb-2">Match {auto.matchIdx + 1}/{precomputed?.matches.length}</div>
              <div className="text-2xl font-black">
                <span className={activeMatch.player1Id === userId ? 'text-amber-400' : 'text-white'}>
                  {getPlayer(activeMatch.player1Id)?.name}
                </span>
                <span className="mx-3 text-zinc-600">VS</span>
                <span className={activeMatch.player2Id === userId ? 'text-amber-400' : 'text-white'}>
                  {getPlayer(activeMatch.player2Id)?.name}
                </span>
              </div>
            </div>
          )}

          {/* Card face-off */}
          {activeMatch && auto && (auto.phase === 'card-enter' || auto.phase === 'card-result') && activeFo && (
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-1 text-center text-xs text-zinc-500">
                Card {auto.cardIdx + 1}/5
              </div>

              <div className="flex items-stretch justify-center gap-4 sm:gap-8">
                {/* Player 1 card */}
                <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${
                  auto.phase === 'card-enter' ? 'animate-[slideFromLeft_0.4s_ease-out]' : ''
                }`}>
                  <div className="w-20 sm:w-24"><CompactCard card={activeFo.card1} /></div>
                  <div className="text-center">
                    <span className="text-xs text-zinc-400">⭐ {activeFo.star1}</span>
                    <span className={`text-xs ${activeFo.roll1 > 0 ? 'text-amber-400' : 'text-zinc-600'}`}> +{activeFo.roll1}🎲</span>
                    <span className="text-xs text-zinc-300"> = {activeFo.effective1}</span>
                  </div>
                  {auto.phase === 'card-result' && (
                    <div className="animate-[fadeIn_0.3s_ease-out]">
                      {activeFo.damage1 > 0 && <span className="text-sm font-bold text-red-400">-{activeFo.damage1} HP</span>}
                      {activeFo.damage2 > 0 && <span className="text-sm font-bold text-green-400">WIN</span>}
                      {activeFo.damage1 === 0 && activeFo.damage2 === 0 && <span className="text-xs text-zinc-500">TIE</span>}
                    </div>
                  )}
                </div>

                {/* VS */}
                <div className="flex items-center">
                  <span className="text-xl font-black text-zinc-700">⚔️</span>
                </div>

                {/* Player 2 card */}
                <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${
                  auto.phase === 'card-enter' ? 'animate-[slideFromRight_0.4s_ease-out]' : ''
                }`}>
                  <div className="w-20 sm:w-24"><CompactCard card={activeFo.card2} /></div>
                  <div className="text-center">
                    <span className="text-xs text-zinc-400">⭐ {activeFo.star2}</span>
                    <span className={`text-xs ${activeFo.roll2 > 0 ? 'text-amber-400' : 'text-zinc-600'}`}> +{activeFo.roll2}🎲</span>
                    <span className="text-xs text-zinc-300"> = {activeFo.effective2}</span>
                  </div>
                  {auto.phase === 'card-result' && (
                    <div className="animate-[fadeIn_0.3s_ease-out]">
                      {activeFo.damage2 > 0 && <span className="text-sm font-bold text-red-400">-{activeFo.damage2} HP</span>}
                      {activeFo.damage1 > 0 && <span className="text-sm font-bold text-green-400">WIN</span>}
                      {activeFo.damage2 === 0 && activeFo.damage1 === 0 && <span className="text-xs text-zinc-500">TIE</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* KO indicator */}
              {auto.phase === 'card-result' && ((displayHp[activeMatch.player1Id] ?? 0) <= 0 || (displayHp[activeMatch.player2Id] ?? 0) <= 0) && (
                <div className="mt-4 text-center text-2xl font-black text-red-400 animate-[scaleIn_0.3s_ease-out]">
                  💀 KO!
                </div>
              )}
            </div>
          )}

          {/* Match end */}
          {auto?.phase === 'match-end' && activeMatch && (
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center animate-[fadeIn_0.5s_ease-out]">
              <div className="text-lg font-bold">
                <span className="text-green-400">{getPlayer(activeMatch.winnerId || '')?.name}</span>
                <span className="text-zinc-400"> wins the match!</span>
              </div>
            </div>
          )}

          {/* Round end */}
          {showRoundEnd && precomputed && (
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center animate-[fadeIn_0.5s_ease-out]">
              <h3 className="mb-4 text-lg font-bold">Round {roundNum} Complete</h3>
              {precomputed.matches.map((m, i) => (
                <div key={i} className="mb-2 text-sm">
                  <span className={m.winnerId === m.player1Id ? 'text-green-400 font-medium' : 'text-zinc-400'}>{getPlayer(m.player1Id)?.name}</span>
                  <span className="text-zinc-600"> vs </span>
                  <span className={m.winnerId === m.player2Id ? 'text-green-400 font-medium' : 'text-zinc-400'}>{getPlayer(m.player2Id)?.name}</span>
                  <span className="text-zinc-500"> — {getPlayer(m.winnerId || '')?.name} wins</span>
                </div>
              ))}
              {precomputed.byePlayerId && (
                <div className="mt-2 text-xs text-zinc-500">{getPlayer(precomputed.byePlayerId)?.name} got a bye</div>
              )}

              {aliveCount() <= 1 ? (
                <button onClick={() => setPhase('done')}
                  className="mt-4 rounded-lg bg-white px-6 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-200">
                  Final Results
                </button>
              ) : (
                <button onClick={() => { setPrecomputed(null); setShowRoundEnd(false); startNextRound() }}
                  className="mt-4 rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-500">
                  Next Round
                </button>
              )}
            </div>
          )}

          {/* Start first round */}
          {!precomputed && !showRoundEnd && !auto && (
            <div className="text-center py-8">
              <button onClick={startNextRound}
                className="rounded-lg bg-red-600 px-8 py-3 text-sm font-bold text-white hover:bg-red-500">
                Start Round 1
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== DONE ===== */}
      {phase === 'done' && (
        <div className="text-center animate-[fadeIn_0.5s_ease-out]">
          <span className="mb-4 block text-5xl">🏆</span>
          <h2 className="mb-2 text-2xl font-bold">{sortedByHp[0]?.name} Wins!</h2>
          <p className="mb-2 text-sm text-zinc-400">{displayHp[sortedByHp[0]?.id] ?? 0} HP remaining</p>
          <p className="mb-6 text-xs text-zinc-500">Completed in {roundNum} rounds</p>
          <div className="mb-8">
            {sortedByHp.map((p, i) => (
              <div key={p.id} className="mb-2 flex items-center justify-center gap-3">
                <span className="w-6 text-right text-sm font-bold text-zinc-500">#{i + 1}</span>
                <span className={`text-sm ${i === 0 ? 'text-amber-400 font-bold' : 'text-zinc-300'}`}>{p.name}</span>
                <span className={`text-sm ${(displayHp[p.id] ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>{displayHp[p.id] ?? 0} HP</span>
              </div>
            ))}
          </div>
          <button onClick={() => { setPhase('setup'); setPlayers([]); setPrecomputed(null); setRoundNum(0) }}
            className="rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
            Play Again
          </button>
        </div>
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideFromLeft { from { transform: translateX(-40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideFromRight { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  )
}
