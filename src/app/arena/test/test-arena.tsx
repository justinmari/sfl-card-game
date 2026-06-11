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
type AutoPhase = 'round-intro' | 'card-enter' | 'card-power' | 'card-roll' | 'card-result' | 'card-settle' | 'round-end'

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
  const [autoPhase, setAutoPhase] = useState<AutoPhase | null>(null)
  const [cardIdx, setCardIdx] = useState(0)
  const [matchKo, setMatchKo] = useState<Set<number>>(new Set())
  const [glitchRolls, setGlitchRolls] = useState<Record<string, number>>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const glitchRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const aliveCount = () => Object.values(displayHp).filter((hp) => hp > 0).length
  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }
  const clearGlitch = () => { if (glitchRef.current) { clearInterval(glitchRef.current); glitchRef.current = null } }

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
    setAutoPhase(null)
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
    setGlitchRolls({})
    setAutoPhase('round-intro')
  }, [roundNum, players, displayHp])

  // Auto-advance
  useEffect(() => {
    if (!autoPhase || !precomputed) return
    clearTimer()

    const delays: Record<AutoPhase, number> = {
      'round-intro': 2000,
      'card-enter': 600,
      'card-power': 500,
      'card-roll': 900,
      'card-result': 1300,
      'card-settle': 400,
      'round-end': 0,
    }

    timerRef.current = setTimeout(() => {
      switch (autoPhase) {
        case 'round-intro':
          setAutoPhase('card-enter')
          break

        case 'card-enter':
          setAutoPhase('card-power')
          break

        case 'card-power': {
          // Start glitch animation
          clearGlitch()
          let ticks = 0
          glitchRef.current = setInterval(() => {
            ticks++
            const rolls: Record<string, number> = {}
            precomputed.matches.forEach((match, mi) => {
              if (matchKo.has(mi)) return
              const fo = match.faceOffs[cardIdx] as FaceOffDetail | undefined
              if (!fo) return
              const max1 = fo.star1 < fo.star2 ? Math.abs(fo.star2 - fo.star1) + 2 : fo.star1 === fo.star2 ? 2 : 1
              const max2 = fo.star2 < fo.star1 ? Math.abs(fo.star1 - fo.star2) + 2 : fo.star1 === fo.star2 ? 2 : 1
              rolls[`${mi}-1`] = Math.floor(Math.random() * max1)
              rolls[`${mi}-2`] = Math.floor(Math.random() * max2)
            })
            setGlitchRolls(rolls)
            if (ticks >= 14) {
              clearGlitch()
              // Land on final values
              const finalRolls: Record<string, number> = {}
              precomputed.matches.forEach((match, mi) => {
                const fo = match.faceOffs[cardIdx] as FaceOffDetail | undefined
                if (!fo) return
                finalRolls[`${mi}-1`] = fo.roll1
                finalRolls[`${mi}-2`] = fo.roll2
              })
              setGlitchRolls(finalRolls)
            }
          }, 55)
          setAutoPhase('card-roll')
          break
        }

        case 'card-roll':
          clearGlitch()
          // Set final rolls
          const finalRolls: Record<string, number> = {}
          precomputed.matches.forEach((match, mi) => {
            const fo = match.faceOffs[cardIdx] as FaceOffDetail | undefined
            if (!fo) return
            finalRolls[`${mi}-1`] = fo.roll1
            finalRolls[`${mi}-2`] = fo.roll2
          })
          setGlitchRolls(finalRolls)
          // Apply damage
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
          setAutoPhase('card-result')
          break

        case 'card-result':
          setAutoPhase('card-settle')
          break

        case 'card-settle':
          if (cardIdx >= 4 || matchKo.size === precomputed.matches.length) {
            setAutoPhase('round-end')
          } else {
            setCardIdx(cardIdx + 1)
            setGlitchRolls({})
            setAutoPhase('card-enter')
          }
          break
      }
    }, delays[autoPhase])

    return () => { clearTimer(); clearGlitch() }
  }, [autoPhase, precomputed, cardIdx, matchKo])

  // Detect KOs
  useEffect(() => {
    if (!precomputed || (autoPhase !== 'card-result' && autoPhase !== 'card-settle')) return
    const newKos = new Set(matchKo)
    let changed = false
    precomputed.matches.forEach((match, mi) => {
      if (newKos.has(mi)) return
      if ((displayHp[match.player1Id] ?? 0) <= 0 || (displayHp[match.player2Id] ?? 0) <= 0) {
        newKos.add(mi)
        changed = true
      }
    })
    if (changed) setMatchKo(newKos)
    if (newKos.size === precomputed.matches.length && autoPhase === 'card-settle') {
      clearTimer()
      timerRef.current = setTimeout(() => setAutoPhase('round-end'), 800)
    }
  }, [displayHp, precomputed, autoPhase])

  const getPlayer = (id: string) => players.find((p) => p.id === id)
  const sortedByHp = [...players].sort((a, b) => (displayHp[b.id] ?? 0) - (displayHp[a.id] ?? 0))
  const fightingIds = new Set<string>()
  if (precomputed && autoPhase && autoPhase !== 'round-end') {
    precomputed.matches.forEach((m) => { fightingIds.add(m.player1Id); fightingIds.add(m.player2Id) })
  }

  const showCards = autoPhase === 'card-enter' || autoPhase === 'card-power' || autoPhase === 'card-roll' || autoPhase === 'card-result' || autoPhase === 'card-settle'
  const showPower = autoPhase === 'card-power' || autoPhase === 'card-roll' || autoPhase === 'card-result' || autoPhase === 'card-settle'
  const showRoll = autoPhase === 'card-roll' || autoPhase === 'card-result' || autoPhase === 'card-settle'
  const showResult = autoPhase === 'card-result' || autoPhase === 'card-settle'

  // Render a large match (player's match)
  const renderLargeMatch = (match: typeof precomputed extends RoundResult | null ? NonNullable<typeof precomputed>['matches'][0] : never, mi: number) => {
    const ko = matchKo.has(mi)
    const fo = match.faceOffs[cardIdx] as FaceOffDetail | undefined
    if (!fo) return null
    const r1 = glitchRolls[`${mi}-1`] ?? 0
    const r2 = glitchRolls[`${mi}-2`] ?? 0
    const p1Won = showResult && fo.damage2 > 0
    const p2Won = showResult && fo.damage1 > 0
    const tie = showResult && fo.damage1 === 0 && fo.damage2 === 0

    return (
      <div className={`rounded-xl border bg-zinc-900 p-6 transition-all duration-300 ${ko ? 'border-red-800' : 'border-zinc-800'}`}>
        <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
          <span>{getPlayer(match.player1Id)?.name} ({displayHp[match.player1Id] ?? 0} HP)</span>
          <span>Card {cardIdx + 1}/5</span>
          <span>{getPlayer(match.player2Id)?.name} ({displayHp[match.player2Id] ?? 0} HP)</span>
        </div>

        <div className="flex items-center justify-center gap-4 sm:gap-8">
          {/* P1 */}
          <div className={`flex flex-col items-center gap-2 transition-all duration-300 ${
            autoPhase === 'card-enter' ? 'animate-[slideFromLeft_0.4s_ease-out]' : ''
          } ${p2Won && showResult ? 'opacity-40 scale-90 translate-x-2' : ''} ${p1Won && showResult ? 'scale-105' : ''}`}>
            <div className="w-20 sm:w-24"><CompactCard card={fo.card1} /></div>
            {showPower && (
              <span className="text-sm text-zinc-300 animate-[fadeIn_0.3s_ease-out]">⭐ {fo.star1}</span>
            )}
            {showRoll && (
              <span className={`text-sm font-mono font-bold animate-[fadeIn_0.2s_ease-out] ${
                autoPhase === 'card-roll' && glitchRef.current ? 'text-amber-300' : r1 > 0 ? 'text-amber-400' : 'text-zinc-600'
              }`}>
                +{r1} 🎲 = {fo.star1 + r1}
              </span>
            )}
            {showResult && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                {fo.damage1 > 0 && <span className="text-lg font-black text-red-400">-{fo.damage1} HP</span>}
                {p1Won && <span className="text-sm font-bold text-green-400">WIN</span>}
                {tie && <span className="text-xs text-zinc-500">TIE</span>}
              </div>
            )}
          </div>

          <span className="text-xl font-black text-zinc-700">⚔️</span>

          {/* P2 */}
          <div className={`flex flex-col items-center gap-2 transition-all duration-300 ${
            autoPhase === 'card-enter' ? 'animate-[slideFromRight_0.4s_ease-out]' : ''
          } ${p1Won && showResult ? 'opacity-40 scale-90 -translate-x-2' : ''} ${p2Won && showResult ? 'scale-105' : ''}`}>
            <div className="w-20 sm:w-24"><CompactCard card={fo.card2} /></div>
            {showPower && (
              <span className="text-sm text-zinc-300 animate-[fadeIn_0.3s_ease-out]">⭐ {fo.star2}</span>
            )}
            {showRoll && (
              <span className={`text-sm font-mono font-bold animate-[fadeIn_0.2s_ease-out] ${
                autoPhase === 'card-roll' && glitchRef.current ? 'text-amber-300' : r2 > 0 ? 'text-amber-400' : 'text-zinc-600'
              }`}>
                +{r2} 🎲 = {fo.star2 + r2}
              </span>
            )}
            {showResult && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                {fo.damage2 > 0 && <span className="text-lg font-black text-red-400">-{fo.damage2} HP</span>}
                {p2Won && <span className="text-sm font-bold text-green-400">WIN</span>}
                {tie && <span className="text-xs text-zinc-500">TIE</span>}
              </div>
            )}
          </div>
        </div>

        {showResult && ko && (
          <div className="mt-3 text-center text-2xl font-black text-red-400 animate-[scaleIn_0.3s_ease-out]">💀 KO!</div>
        )}
      </div>
    )
  }

  // Render a mini match (other matches)
  const renderMiniMatch = (match: typeof precomputed extends RoundResult | null ? NonNullable<typeof precomputed>['matches'][0] : never, mi: number) => {
    const ko = matchKo.has(mi)
    const fo = match.faceOffs[cardIdx] as FaceOffDetail | undefined
    if (!fo) return null
    const r1 = glitchRolls[`${mi}-1`] ?? 0
    const r2 = glitchRolls[`${mi}-2`] ?? 0

    return (
      <div key={mi} className={`rounded-lg border bg-zinc-900 p-3 transition-opacity duration-300 ${ko ? 'border-red-800 opacity-50' : 'border-zinc-800'}`}>
        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-2">
          <span>{getPlayer(match.player1Id)?.name} <span className={`font-bold ${(displayHp[match.player1Id] ?? 0) <= 3 ? 'text-red-400' : 'text-green-400'}`}>{displayHp[match.player1Id] ?? 0}</span></span>
          <span>vs</span>
          <span><span className={`font-bold ${(displayHp[match.player2Id] ?? 0) <= 3 ? 'text-red-400' : 'text-green-400'}`}>{displayHp[match.player2Id] ?? 0}</span> {getPlayer(match.player2Id)?.name}</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <div className="w-8 h-10 overflow-hidden rounded border border-zinc-700">
            {fo.card1.image_url ? <img src={fo.card1.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-[6px]">🃏</div>}
          </div>
          <div className="text-center min-w-[4rem]">
            {showPower && <div className="text-[9px] text-zinc-400">⭐{fo.star1} vs ⭐{fo.star2}</div>}
            {showRoll && (
              <div className={`text-[9px] font-mono font-bold ${autoPhase === 'card-roll' && glitchRef.current ? 'text-amber-300' : 'text-zinc-300'}`}>
                {fo.star1 + r1} vs {fo.star2 + r2}
              </div>
            )}
            {showResult && (
              <div className="text-[9px] font-bold">
                {fo.damage1 > 0 && <span className="text-red-400">-{fo.damage1}</span>}
                {fo.damage2 > 0 && <span className="text-green-400">-{fo.damage2}</span>}
                {fo.damage1 === 0 && fo.damage2 === 0 && <span className="text-zinc-500">TIE</span>}
              </div>
            )}
            {ko && showResult && <div className="text-[9px] text-red-400">💀</div>}
          </div>
          <div className="w-8 h-10 overflow-hidden rounded border border-zinc-700">
            {fo.card2.image_url ? <img src={fo.card2.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-[6px]">🃏</div>}
          </div>
        </div>
      </div>
    )
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
          {autoPhase === 'round-intro' && precomputed && (
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

          {/* Card face-offs */}
          {precomputed && showCards && (() => {
            const myMatchIdx = precomputed.matches.findIndex((m) => m.player1Id === userId || m.player2Id === userId)
            const otherMatches = precomputed.matches.map((m, i) => ({ match: m, idx: i })).filter((_, i) => i !== myMatchIdx)

            return (
              <div className="space-y-4">
                <div className="text-center text-xs text-zinc-500">Card {cardIdx + 1}/5</div>

                {myMatchIdx >= 0 && renderLargeMatch(precomputed.matches[myMatchIdx], myMatchIdx)}

                {myMatchIdx < 0 && (
                  <div className="rounded-xl border border-amber-800 bg-amber-950/20 p-6 text-center">
                    <span className="text-sm text-amber-400">You have a bye this round</span>
                  </div>
                )}

                {otherMatches.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs text-zinc-500">Other matches</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {otherMatches.map(({ match, idx }) => renderMiniMatch(match, idx))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Round end */}
          {autoPhase === 'round-end' && precomputed && (
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
                <button onClick={() => { setPrecomputed(null); setAutoPhase(null); startNextRound() }} className="mt-4 rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-500">Next Round</button>
              )}
            </div>
          )}

          {/* Start first round */}
          {!precomputed && !autoPhase && (
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
        @keyframes slideFromLeft { from { transform: translateX(-40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideFromRight { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  )
}
