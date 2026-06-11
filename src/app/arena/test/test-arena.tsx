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
import BattleFaceoff from '@/components/battle-faceoff'

type DeckOption = { slot: number; name: string; cards: BattleCard[] }

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
  const [battlePhase, setBattlePhase] = useState<'idle' | 'round-intro' | 'fighting' | 'round-end'>('idle')
  const [cardIdx, setCardIdx] = useState(0)
  const [matchKo, setMatchKo] = useState<Set<number>>(new Set())
  const [faceoffKey, setFaceoffKey] = useState(0) // force re-mount
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
    setBattlePhase('idle')
  }

  const startNextRound = useCallback(() => {
    const nextRound = roundNum + 1
    const updated = players.map((p) => ({ ...p, hp: displayHp[p.id] ?? 0, eliminated: (displayHp[p.id] ?? 0) <= 0 }))
    setPlayers(updated)
    const result = precomputeRound(updated, displayHp, nextRound)
    setPrecomputed(result)
    setRoundNum(nextRound)
    setCardIdx(0)
    setMatchKo(new Set())
    setBattlePhase('round-intro')
    // Auto start fighting after intro
    timerRef.current = setTimeout(() => {
      setBattlePhase('fighting')
      setFaceoffKey((k) => k + 1)
    }, 2000)
  }, [roundNum, players, displayHp])

  // When a faceoff animation completes — apply damage for ALL active matches and advance
  const onFaceoffComplete = useCallback(() => {
    if (!precomputed) return

    // Apply damage for all non-KO matches
    setDisplayHp((prev) => {
      const updated = { ...prev }
      precomputed.matches.forEach((match, mi) => {
        if (matchKo.has(mi)) return
        const fo = match.faceOffs[cardIdx]
        if (!fo) return
        updated[match.player1Id] = Math.max(0, (updated[match.player1Id] || 0) - fo.damage1)
        updated[match.player2Id] = Math.max(0, (updated[match.player2Id] || 0) - fo.damage2)
      })
      return updated
    })

    // Wait then advance
    timerRef.current = setTimeout(() => {
      if (cardIdx >= 4) {
        setBattlePhase('round-end')
      } else {
        setCardIdx(cardIdx + 1)
        setFaceoffKey((k) => k + 1)
      }
    }, 800)
  }, [precomputed, cardIdx, matchKo])

  // If my match is KO'd but other matches are still going, auto-advance via timer
  useEffect(() => {
    if (!precomputed || battlePhase !== 'fighting') return
    const myMatchIdx = precomputed.matches.findIndex((m) => m.player1Id === userId || m.player2Id === userId)
    const myKo = myMatchIdx >= 0 && matchKo.has(myMatchIdx)
    const allKo = matchKo.size >= precomputed.matches.length

    if (myKo && !allKo && cardIdx < 4) {
      // My match is done but others aren't — auto advance on a timer
      clearTimer()
      timerRef.current = setTimeout(() => {
        // Apply damage for remaining matches
        setDisplayHp((prev) => {
          const updated = { ...prev }
          precomputed.matches.forEach((match, mi) => {
            if (matchKo.has(mi)) return
            const fo = match.faceOffs[cardIdx]
            if (!fo) return
            updated[match.player1Id] = Math.max(0, (updated[match.player1Id] || 0) - fo.damage1)
            updated[match.player2Id] = Math.max(0, (updated[match.player2Id] || 0) - fo.damage2)
          })
          return updated
        })
        setTimeout(() => {
          if (cardIdx >= 4) {
            setBattlePhase('round-end')
          } else {
            setCardIdx(cardIdx + 1)
            setFaceoffKey((k) => k + 1)
          }
        }, 800)
      }, 3500) // match the faceoff animation duration
    }
  }, [matchKo, precomputed, battlePhase, cardIdx])

  // Detect KOs
  useEffect(() => {
    if (!precomputed || battlePhase !== 'fighting') return
    const newKos = new Set(matchKo)
    let changed = false
    precomputed.matches.forEach((match, mi) => {
      if (newKos.has(mi)) return
      if ((displayHp[match.player1Id] ?? 0) <= 0 || (displayHp[match.player2Id] ?? 0) <= 0) {
        newKos.add(mi)
        changed = true
      }
    })
    if (changed) {
      setMatchKo(newKos)
      // If all KO'd, end round
      if (newKos.size === precomputed.matches.length) {
        clearTimer()
        timerRef.current = setTimeout(() => setBattlePhase('round-end'), 1200)
      }
    }
  }, [displayHp, precomputed, battlePhase])

  useEffect(() => { return clearTimer }, [])

  const getPlayer = (id: string) => players.find((p) => p.id === id)
  const sortedByHp = [...players].sort((a, b) => (displayHp[b.id] ?? 0) - (displayHp[a.id] ?? 0))
  const fightingIds = new Set<string>()
  if (precomputed && (battlePhase === 'round-intro' || battlePhase === 'fighting')) {
    precomputed.matches.forEach((m) => { fightingIds.add(m.player1Id); fightingIds.add(m.player2Id) })
  }

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
                const fighting = fightingIds.has(p.id)
                return (
                  <div key={p.id} className={`rounded-lg border p-2 text-center transition-all duration-300 ${
                    hp <= 0 ? 'border-zinc-800 opacity-40' : fighting ? 'border-red-600 bg-red-950/20' : p.id === userId ? 'border-amber-700 bg-amber-950/20' : 'border-zinc-800 bg-zinc-900'
                  }`}>
                    <p className="text-[11px] font-medium truncate">{p.name}</p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-800">
                      <div className={`h-full rounded-full transition-all duration-700 ease-out ${hp <= 3 ? 'bg-red-500' : hp <= 6 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${(hp / 10) * 100}%` }} />
                    </div>
                    <span className={`text-[11px] font-bold ${hp <= 3 ? 'text-red-400' : 'text-green-400'}`}>{hp}</span>
                    {hp <= 0 && <span className="block text-[8px] text-red-400">DEAD</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Round intro */}
          {battlePhase === 'round-intro' && precomputed && (
            <div className="space-y-3 animate-[fadeIn_0.5s_ease-out]">
              <div className="text-center text-xs text-zinc-500 mb-2">
                {precomputed.matches.length} match{precomputed.matches.length !== 1 ? 'es' : ''} this round
                {precomputed.byePlayerId && ` · ${getPlayer(precomputed.byePlayerId)?.name} has a bye`}
              </div>
              {precomputed.matches.map((m, i) => (
                <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 py-3 text-center">
                  <span className={m.player1Id === userId ? 'text-amber-400 font-bold' : 'text-white font-bold'}>{getPlayer(m.player1Id)?.name}</span>
                  <span className="mx-3 text-zinc-600 font-black">VS</span>
                  <span className={m.player2Id === userId ? 'text-amber-400 font-bold' : 'text-white font-bold'}>{getPlayer(m.player2Id)?.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Fighting */}
          {battlePhase === 'fighting' && precomputed && (() => {
            const myMatchIdx = precomputed.matches.findIndex((m) => m.player1Id === userId || m.player2Id === userId)
            const otherMatches = precomputed.matches.map((m, i) => ({ match: m, idx: i })).filter((_, i) => i !== myMatchIdx)

            return (
              <div className="space-y-4">
                <div className="text-center text-xs text-zinc-500">Card {cardIdx + 1}/5</div>

                {/* Player's match — large */}
                {myMatchIdx >= 0 && !matchKo.has(myMatchIdx) && (() => {
                  const myMatch = precomputed.matches[myMatchIdx]
                  const fo = myMatch.faceOffs[cardIdx] as FaceOffDetail
                  const imPlayer1 = myMatch.player1Id === userId
                  const opponentId = imPlayer1 ? myMatch.player2Id : myMatch.player1Id
                  // Ensure user is always on the left (card1)
                  const displayFo: FaceOffDetail = imPlayer1 ? fo : {
                    ...fo,
                    card1: fo.card2,
                    card2: fo.card1,
                    star1: fo.star2,
                    star2: fo.star1,
                    roll1: fo.roll2,
                    roll2: fo.roll1,
                    effective1: fo.effective2,
                    effective2: fo.effective1,
                    damage1: fo.damage2,
                    damage2: fo.damage1,
                  }

                  return (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                      <div className="mb-3 flex items-center justify-between text-xs">
                        <span className="text-amber-400 font-medium">You ({displayHp[userId] ?? 0} HP)</span>
                        <span className="text-zinc-500">{getPlayer(opponentId)?.name} ({displayHp[opponentId] ?? 0} HP)</span>
                      </div>
                      <BattleFaceoff
                        key={`large-${faceoffKey}`}
                        faceOff={displayFo}
                        onComplete={onFaceoffComplete}
                        large
                        p1Name="You"
                        p2Name={getPlayer(opponentId)?.name || 'Opponent'}
                      />
                    </div>
                  )
                })()}

                {myMatchIdx >= 0 && matchKo.has(myMatchIdx) && (
                  <div className="rounded-xl border border-red-800 bg-zinc-900 p-6 text-center opacity-60">
                    <span className="text-2xl">💀</span>
                    <p className="text-sm text-red-400 font-bold">KO!</p>
                  </div>
                )}

                {myMatchIdx < 0 && (
                  <div className="rounded-xl border border-amber-800 bg-amber-950/20 p-6 text-center">
                    <span className="text-sm text-amber-400">You have a bye this round</span>
                  </div>
                )}

                {/* Other matches — mini */}
                {otherMatches.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs text-zinc-500">Other matches</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {otherMatches.map(({ match, idx }) => {
                        const ko = matchKo.has(idx)
                        const fo = match.faceOffs[cardIdx] as FaceOffDetail | undefined
                        if (!fo) return null
                        return (
                          <div key={idx} className={`rounded-lg border bg-zinc-900 p-3 ${ko ? 'border-red-800 opacity-50' : 'border-zinc-800'}`}>
                            <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-2">
                              <span>{getPlayer(match.player1Id)?.name} <span className={`font-bold ${(displayHp[match.player1Id] ?? 0) <= 3 ? 'text-red-400' : 'text-green-400'}`}>{displayHp[match.player1Id] ?? 0}</span></span>
                              <span>vs</span>
                              <span><span className={`font-bold ${(displayHp[match.player2Id] ?? 0) <= 3 ? 'text-red-400' : 'text-green-400'}`}>{displayHp[match.player2Id] ?? 0}</span> {getPlayer(match.player2Id)?.name}</span>
                            </div>
                            {ko ? (
                              <div className="text-center text-sm text-red-400">💀</div>
                            ) : (
                              <BattleFaceoff
                                key={`mini-${idx}-${faceoffKey}`}
                                faceOff={fo}
                                onComplete={() => {}}
                                large={false}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Round end */}
          {battlePhase === 'round-end' && precomputed && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center animate-[fadeIn_0.5s_ease-out]">
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
                <button onClick={() => setPhase('done')} className="mt-4 rounded-lg bg-white px-6 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-200">Final Results</button>
              ) : (
                <button onClick={() => { setPrecomputed(null); setBattlePhase('idle'); startNextRound() }} className="mt-4 rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-500">Next Round</button>
              )}
            </div>
          )}

          {/* Start first round */}
          {battlePhase === 'idle' && !precomputed && (
            <div className="text-center py-8">
              <button onClick={startNextRound} className="rounded-lg bg-red-600 px-8 py-3 text-sm font-bold text-white hover:bg-red-500">Start Round 1</button>
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
            className="rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-300 hover:bg-zinc-800">Play Again</button>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  )
}
