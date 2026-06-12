'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  type BattlePlayer,
  type BattleCard,
  type RoundResult,
  type FaceOffDetail,
  type ActiveSkill,
  type Skill,
  starCount,
} from '@/lib/battle-engine'
import { createClient } from '@/lib/supabase/client'
import { submitRoundReady, updateSessionHp, endArenaSession, getMatchupPreview } from '@/app/arena/actions'
import { createSeededRng } from '@/lib/seeded-random'
import { precomputeRound, randomPair } from '@/lib/battle-engine'
import BattleFaceoff from '@/components/battle-faceoff'
import CompactCard from '@/components/compact-card'
import { rarityLabel, rarityBadgeColors } from '@/lib/rarities'

const rarityTextColor: Record<string, string> = {
  common: 'text-zinc-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  ultra_rare: 'text-purple-400',
  legendary: 'text-amber-400',
  secret_rare: 'text-pink-400',
}

export type ArenaBattleProps = {
  userId: string
  players: BattlePlayer[]
  sessionId?: string
  seed?: number
  initialRoundNum?: number
  initialRound?: RoundResult
  initialHp?: Record<string, number>
  initialSkills?: ActiveSkill[]
  getConnectedIds?: () => string[]
  onBattleEnd?: () => void
}

export default function ArenaBattle({
  userId,
  players: initialPlayers,
  sessionId,
  seed,
  initialRoundNum,
  initialRound,
  initialHp: initialHpProp,
  initialSkills,
  getConnectedIds,
  onBattleEnd,
}: ArenaBattleProps) {
  const isServerMode = !!sessionId
  const isReconnect = !!initialRoundNum // reconnecting if any round has been played
  const initHp = (): Record<string, number> => {
    if (initialHpProp) return { ...initialHpProp }
    const hpMap: Record<string, number> = {}
    // Use player.hp if available (reconnect/spectate), otherwise default to 10
    initialPlayers.forEach((p) => { hpMap[p.id] = p.hp ?? 10 })
    return hpMap
  }
  const getLocalRng = (round: number) => seed != null ? createSeededRng(seed * 1000 + round) : undefined

  const [phase, setPhase] = useState<'battle' | 'done'>('battle')
  const [players, setPlayers] = useState<BattlePlayer[]>(initialPlayers)

  // React to new players joining (reconnect/spectator)
  useEffect(() => {
    setPlayers((prev) => {
      const newPlayers = initialPlayers.filter((p) => !prev.some((ep) => ep.id === p.id))
      if (newPlayers.length === 0) return prev
      // Add new players and set their HP
      const updated = [...prev, ...newPlayers]
      setDisplayHp((hp) => {
        const copy = { ...hp }
        newPlayers.forEach((p) => { if (!(p.id in copy)) copy[p.id] = p.hp ?? 0 })
        return copy
      })
      return updated
    })
  }, [initialPlayers.length])
  const [displayHp, setDisplayHp] = useState<Record<string, number>>(initHp)
  // On reconnect: roundNum = next round (last computed + 1), start at waiting-for-round
  const [roundNum, setRoundNum] = useState(isReconnect ? (initialRoundNum! + 1) : 1)
  const [precomputed, setPrecomputed] = useState<RoundResult | null>(null)
  const [battlePhase, setBattlePhase] = useState<'skill-select' | 'waiting-for-round' | 'round-intro' | 'fighting' | 'round-end' | 'waiting'>(isReconnect ? 'waiting-for-round' : 'skill-select')
  const [cardIdx, setCardIdx] = useState(0)
  const [matchKo, setMatchKo] = useState<Set<number>>(new Set())
  const [faceoffPhase, setFaceoffPhase] = useState<'enter' | 'power' | 'rolling' | 'merge' | 'result' | 'done'>('enter')
  const [rollElapsed, setRollElapsed] = useState(0)
  const [roundEndCountdown, setRoundEndCountdown] = useState(0)
  const [skillUsage, setSkillUsage] = useState<Record<string, number>>({})
  const [localSkillIds, setLocalSkillIds] = useState<string[]>([])
  const [matchupPreview, setMatchupPreview] = useState<{ pairs: [string, string][]; byeId: string | null } | null>(null)
  const [activeRoundSkills, setActiveRoundSkills] = useState<ActiveSkill[]>(initialSkills ?? [])
  const [introCountdown, setIntroCountdown] = useState(5)
  const [myReady, setMyReady] = useState(false)
  const [readyInfo, setReadyInfo] = useState<{ readyCount: number; aliveCount: number } | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const introCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rafRef = useRef<number>(0)
  const appliedRef = useRef<Set<number>>(new Set())

  // Matchups: prefer precomputed result, then server preview, then null
  const introMatchups: { pairs: [string, string][]; byeId: string | null } | null = precomputed ? {
    pairs: precomputed.matches.map((m): [string, string] => [m.player1Id, m.player2Id]),
    byeId: precomputed.byePlayerId,
  } : matchupPreview

  const aliveCount = () => Object.values(displayHp).filter((hp) => hp > 0).length
  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    if (introCountdownRef.current) { clearInterval(introCountdownRef.current); introCountdownRef.current = null }
  }

  const getPlayerSkills = (playerId: string): { skill: Skill; card: BattleCard }[] => {
    const player = players.find((p) => p.id === playerId)
    if (!player) return []
    const results: { skill: Skill; card: BattleCard }[] = []
    for (const card of player.deck) {
      if (card.skills) {
        for (const skill of card.skills) results.push({ skill, card })
      }
    }
    return results
  }

  const isSkillUsable = (skill: Skill): boolean =>
    (skillUsage[skill.id] ?? 0) < skill.usesPerBattle

  // Local mode: compute next round client-side (test arena)
  const handleLocalNextRound = () => {
    const nextRound = roundNum + 1
    const updated = players.map((p) => ({ ...p, hp: displayHp[p.id] ?? 0, eliminated: (displayHp[p.id] ?? 0) <= 0 }))
    const alive = updated.filter((p) => !p.eliminated)
    if (alive.length <= 1) {
      setPhase('done')
      return
    }
    // Build skills from local selection
    const skills: ActiveSkill[] = localSkillIds.map((skillId) => {
      const ps = getPlayerSkills(userId).find(({ skill }) => skill.id === skillId)
      return ps ? { skill: ps.skill, activatedBy: userId, roundActivated: nextRound } : null
    }).filter(Boolean) as ActiveSkill[]

    const result = precomputeRound(updated, displayHp, nextRound, undefined, skills.length > 0 ? skills : undefined, getLocalRng(nextRound))
    handleNewRound(nextRound, result, skills)
  }

  // Subscribe to new rounds via Supabase Realtime (server mode only)
  useEffect(() => {
    if (!isServerMode) return
    const supabase = createClient()
    const channel = supabase.channel(`arena-rounds-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'arena_rounds',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const row = payload.new as { round_num: number; result: RoundResult; skills_used: ActiveSkill[] }
        if (row.round_num >= targetRoundRef.current) {
          handleNewRound(row.round_num, row.result, row.skills_used || [])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, roundNum])

  const handleNewRound = (newRoundNum: number, result: RoundResult, skills: ActiveSkill[]) => {
    setRoundNum(newRoundNum)
    setPrecomputed(result)
    setActiveRoundSkills(skills)
    setCardIdx(0)
    setMatchKo(new Set())
    appliedRef.current.clear()
    setMyReady(false)
    setReadyInfo(null)
    setLocalSkillIds([])
    setIntroCountdown(3) // brief intro before fighting
    setBattlePhase('round-intro')
    skills.forEach((s) => {
      if (s.activatedBy === userId) {
        setSkillUsage((prev) => ({ ...prev, [s.skill.id]: (prev[s.skill.id] ?? 0) + 1 }))
      }
    })
  }

  // Fetch matchup preview from server when entering skill-select
  useEffect(() => {
    if (battlePhase !== 'skill-select' || !isServerMode) return
    setMatchupPreview(null)
    getMatchupPreview(sessionId!, targetRoundRef.current).then((result) => {
      if (result) setMatchupPreview(result)
    })
  }, [battlePhase === 'skill-select', roundNum])

  // Skill select countdown → submit ready
  useEffect(() => {
    if (battlePhase !== 'skill-select') return
    setIntroCountdown(5)
    if (introCountdownRef.current) { clearInterval(introCountdownRef.current); introCountdownRef.current = null }
    introCountdownRef.current = setInterval(() => {
      setIntroCountdown((prev) => {
        if (prev <= 1) {
          if (introCountdownRef.current) { clearInterval(introCountdownRef.current); introCountdownRef.current = null }
          setTimeout(() => {
            if (isServerMode) {
              handleReadyUpRef.current()
            } else {
              // Local mode: compute round directly
              const updated = players.map((p) => ({ ...p, hp: displayHp[p.id] ?? 0, eliminated: (displayHp[p.id] ?? 0) <= 0 }))
              const skills: ActiveSkill[] = localSkillIds.map((skillId) => {
                const ps = getPlayerSkills(userId).find(({ skill }) => skill.id === skillId)
                return ps ? { skill: ps.skill, activatedBy: userId, roundActivated: roundNum } : null
              }).filter(Boolean) as ActiveSkill[]
              const result = precomputeRound(updated, displayHp, roundNum, undefined, skills.length > 0 ? skills : undefined, getLocalRng(roundNum))
              handleNewRound(roundNum, result, skills)
            }
          }, 0)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (introCountdownRef.current) { clearInterval(introCountdownRef.current); introCountdownRef.current = null } }
  }, [battlePhase === 'skill-select', roundNum])

  // Intro countdown → start fighting
  useEffect(() => {
    if (battlePhase !== 'round-intro') return
    if (introCountdownRef.current) { clearInterval(introCountdownRef.current); introCountdownRef.current = null }
    introCountdownRef.current = setInterval(() => {
      setIntroCountdown((prev) => {
        if (prev <= 1) {
          if (introCountdownRef.current) { clearInterval(introCountdownRef.current); introCountdownRef.current = null }
          setBattlePhase('fighting')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (introCountdownRef.current) { clearInterval(introCountdownRef.current); introCountdownRef.current = null } }
  }, [battlePhase === 'round-intro', roundNum])

  // Animation driver for faceoff phases
  const startFaceoffAnimation = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setFaceoffPhase('enter')
    setRollElapsed(0)

    const startTime = performance.now()
    const phases: [number, 'enter' | 'power' | 'rolling' | 'merge' | 'result' | 'done'][] = [
      [0, 'enter'], [500, 'power'], [1200, 'rolling'], [2400, 'merge'], [3100, 'result'], [4500, 'done'],
    ]
    let currentPhaseIdx = 0
    let rollingStart = 0
    let resultApplied = false

    const tick = () => {
      const elapsed = performance.now() - startTime
      while (currentPhaseIdx < phases.length - 1 && elapsed >= phases[currentPhaseIdx + 1][0]) {
        currentPhaseIdx++
        const phaseName = phases[currentPhaseIdx][1]
        setFaceoffPhase(phaseName)
        if (phaseName === 'rolling') rollingStart = performance.now()
        if (phaseName === 'merge') rollingStart = performance.now()

        if (phaseName === 'result' && !resultApplied) {
          resultApplied = true
          if (!appliedRef.current.has(cardIdx) && precomputed) {
            appliedRef.current.add(cardIdx)
            const heal = precomputed.flags?.healInstead
            setDisplayHp((prev) => {
              const updated = { ...prev }
              precomputed.matches.forEach((match, mi) => {
                if (matchKo.has(mi)) return
                const fo = match.faceOffs[cardIdx]
                if (!fo) return
                if (heal) {
                  updated[match.player1Id] = Math.min(10, (updated[match.player1Id] || 0) + fo.damage1)
                  updated[match.player2Id] = Math.min(10, (updated[match.player2Id] || 0) + fo.damage2)
                } else {
                  updated[match.player1Id] = Math.max(0, (updated[match.player1Id] || 0) - fo.damage1)
                  updated[match.player2Id] = Math.max(0, (updated[match.player2Id] || 0) - fo.damage2)
                }
              })
              return updated
            })
          }
        }

        if (phaseName === 'done') {
          if (cardIdx >= 4) {
            setBattlePhase('round-end')
          } else {
            setCardIdx((prev) => prev + 1)
          }
          return
        }
      }

      const currentPhaseName = phases[currentPhaseIdx][1]
      if (currentPhaseName === 'rolling' || currentPhaseName === 'merge') {
        setRollElapsed(performance.now() - rollingStart)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [precomputed, cardIdx, matchKo])

  useEffect(() => {
    if (battlePhase === 'fighting' && precomputed) startFaceoffAnimation()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [cardIdx, battlePhase === 'fighting'])

  // Detect KOs
  useEffect(() => {
    if (battlePhase !== 'fighting' || !precomputed) return
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
      if (newKos.size >= precomputed.matches.length) {
        clearTimer()
        timerRef.current = setTimeout(() => setBattlePhase('round-end'), 2000)
      }
    }
  }, [displayHp, battlePhase])

  // Round-end: sync HP to server + start countdown
  useEffect(() => {
    if (battlePhase !== 'round-end') return

    const gameOver = aliveCount() <= 1
    if (gameOver && isServerMode) endArenaSession(sessionId!)

    setRoundEndCountdown(20)
    setMyReady(false)
    setReadyInfo(null)
    setLocalSkillIds([])
    countdownRef.current = setInterval(() => {
      setRoundEndCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
          setTimeout(() => {
            if (gameOver) {
              setPhase('done')
            } else {
              setRoundNum((r) => r + 1)
              setBattlePhase('skill-select')
            }
          }, 0)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null } }
  }, [battlePhase === 'round-end'])

  useEffect(() => { return clearTimer }, [])

  // Submit ready to server
  // Track target round in a ref so polls always use the latest value
  const targetRoundRef = useRef(roundNum)
  targetRoundRef.current = roundNum
  const localSkillIdsRef = useRef(localSkillIds)
  localSkillIdsRef.current = localSkillIds

  const handleReadyUp = async () => {
    if (myReady) return
    setMyReady(true)
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    if (introCountdownRef.current) { clearInterval(introCountdownRef.current); introCountdownRef.current = null }

    if (!isServerMode) {
      handleLocalNextRound()
      return
    }

    const target = targetRoundRef.current
    setBattlePhase('waiting-for-round')
    const result = await submitRoundReady(sessionId!, target, localSkillIdsRef.current, getConnectedIds?.())
    if (result) {
      setReadyInfo({ readyCount: result.readyCount ?? 0, aliveCount: result.aliveCount ?? 0 })
      if (result.allReady && result.round) {
        handleNewRound(target, result.round, result.skills || [])
      }
    }
  }

  const handleReadyUpRef = useRef(handleReadyUp)
  handleReadyUpRef.current = handleReadyUp

  // Poll for ready status while waiting (server mode only)
  useEffect(() => {
    if (battlePhase !== 'waiting-for-round' || !isServerMode) return
    const interval = setInterval(async () => {
      const target = targetRoundRef.current
      const result = await submitRoundReady(sessionId!, target, localSkillIdsRef.current, getConnectedIds?.())
      if (result) {
        setReadyInfo({ readyCount: result.readyCount ?? 0, aliveCount: result.aliveCount ?? 0 })
        if (result.allReady && result.round) {
          handleNewRound(target, result.round, result.skills || [])
        }
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [battlePhase === 'waiting-for-round'])

  const getPlayer = (id: string) => players.find((p) => p.id === id)
  const sortedByHp = [...players].sort((a, b) => (displayHp[b.id] ?? 0) - (displayHp[a.id] ?? 0))
  // Filter skills to only those relevant to the user's match
  const myMatchPlayerIds = (() => {
    if (!precomputed) return new Set<string>()
    const m = precomputed.matches.find((m) => m.player1Id === userId || m.player2Id === userId)
    return m ? new Set([m.player1Id, m.player2Id]) : new Set<string>()
  })()
  const myMatchSkills = activeRoundSkills.filter((s) => myMatchPlayerIds.has(s.activatedBy))
  const fightingIds = new Set<string>()
  if (precomputed && (battlePhase === 'round-intro' || battlePhase === 'fighting')) {
    precomputed.matches.forEach((m) => { fightingIds.add(m.player1Id); fightingIds.add(m.player2Id) })
  }

  return (
    <div suppressHydrationWarning>
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
          {battlePhase === 'round-intro' && introMatchups && (() => {
            const myPair = introMatchups.pairs.find(([a, b]) => a === userId || b === userId)
            const opponentId = myPair ? (myPair[0] === userId ? myPair[1] : myPair[0]) : null
            const otherPairs = introMatchups.pairs.filter(([a, b]) => a !== userId && b !== userId)

            return (
              <div className="space-y-4 animate-[fadeIn_0.5s_ease-out]">
                {myMatchSkills.length > 0 && (
                  <div className="rounded-lg border border-pink-800 bg-pink-950/20 px-4 py-2 text-center">
                    {myMatchSkills.map((as, i) => (
                      <div key={i} className="text-sm">
                        <span className="font-bold text-pink-400">{as.skill.name}</span>
                        <span className="text-zinc-400"> — {as.skill.description}</span>
                        <span className="text-zinc-600"> (by {getPlayer(as.activatedBy)?.name})</span>
                      </div>
                    ))}
                  </div>
                )}

                {opponentId ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center" style={{ minHeight: '12rem' }}>
                    <div className="text-xs text-zinc-500 mb-4">Round {roundNum}</div>
                    <div className="text-2xl font-black">
                      <span className="text-amber-400">You</span>
                      <span className="mx-3 text-zinc-600">VS</span>
                      <span className="text-white">{getPlayer(opponentId)?.name}</span>
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-xl border ${(displayHp[userId] ?? 0) <= 0 ? 'border-zinc-800 bg-zinc-900' : 'border-amber-800 bg-amber-950/20'} p-8 text-center`} style={{ minHeight: '12rem' }}>
                    <div className="text-xs text-zinc-500 mb-4">Round {roundNum}</div>
                    {(displayHp[userId] ?? 0) <= 0
                      ? <><p className="text-sm text-red-400 font-medium">You have been eliminated</p><p className="text-xs text-zinc-500 mt-1">Spectating remaining matches</p></>
                      : <span className="text-lg text-amber-400">You have a pass this round</span>
                    }
                  </div>
                )}

                {otherPairs.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs text-zinc-500">Other matches</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {otherPairs.map(([id1, id2], idx) => (
                        <div key={idx} className="rounded-lg border border-zinc-800 bg-zinc-900 py-3 px-4 text-center text-sm">
                          <span className="text-white font-medium">{getPlayer(id1)?.name}</span>
                          <span className="mx-2 text-zinc-600 font-bold">vs</span>
                          <span className="text-white font-medium">{getPlayer(id2)?.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {introMatchups.byeId && introMatchups.byeId !== userId && (
                  <div className="text-xs text-zinc-500 text-center">{getPlayer(introMatchups.byeId)?.name} gets a pass</div>
                )}

                <div className="text-center pt-2">
                  <p className="text-xs text-zinc-500">Starting in <span className="font-bold text-white">{introCountdown}s</span></p>
                </div>
              </div>
            )
          })()}

          {/* Skill select (before round is computed) */}
          {battlePhase === 'skill-select' && (() => {
            const isAlive = (displayHp[userId] ?? 0) > 0
            const myPair = matchupPreview?.pairs.find(([a, b]) => a === userId || b === userId)
            const opponentId = myPair ? (myPair[0] === userId ? myPair[1] : myPair[0]) : null
            const hasPass = matchupPreview && !myPair && isAlive
            // Only show skills when matchup is loaded and player has an opponent
            const availableSkills = isAlive && opponentId ? getPlayerSkills(userId).filter(({ skill }) => isSkillUsable(skill)) : []

            return (
              <div className="space-y-4 animate-[fadeIn_0.5s_ease-out]">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center" style={{ minHeight: '10rem' }}>
                  <div className="text-xs text-zinc-500 mb-4">Round {roundNum}</div>
                  {!isAlive ? (
                    <><p className="text-sm text-red-400 font-medium">You have been eliminated</p><p className="text-xs text-zinc-500 mt-1">Spectating remaining matches</p></>
                  ) : hasPass ? (
                    <span className="text-lg text-amber-400">You have a pass this round</span>
                  ) : opponentId ? (
                    <div className="text-2xl font-black">
                      <span className="text-amber-400">You</span>
                      <span className="mx-3 text-zinc-600">VS</span>
                      <span className="text-white">{getPlayer(opponentId)?.name}</span>
                    </div>
                  ) : (
                    <div className="text-xl font-bold text-white animate-pulse">Preparing matchups...</div>
                  )}
                </div>

                {availableSkills.length > 0 && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <h4 className="mb-3 text-sm font-medium text-zinc-400 text-center">Skills</h4>
                    <div className="space-y-2">
                      {availableSkills.map(({ skill, card }) => {
                        const active = localSkillIds.includes(skill.id)
                        return (
                          <button key={`${card.id}-${skill.id}`}
                            onClick={() => setLocalSkillIds((prev) => active ? prev.filter((id) => id !== skill.id) : [...prev, skill.id])}
                            className={`w-full rounded-lg border p-3 text-left transition-all ${active ? 'border-pink-500 bg-pink-950/30' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-500'}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-16 flex-shrink-0"><CompactCard card={card} /></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-pink-400">{skill.name}</span>
                                  {active && <span className="rounded bg-pink-600 px-1.5 py-0.5 text-[8px] font-bold text-white">ACTIVE</span>}
                                </div>
                                <p className="text-xs text-zinc-400 mt-0.5">{skill.description}</p>
                                <p className="text-[10px] text-zinc-600 mt-0.5">
                                  From <span className={`font-medium ${rarityTextColor[card.rarity] || 'text-zinc-300'}`}>{card.name}</span>
                                  {' · '}{skill.usesPerBattle - (skillUsage[skill.id] ?? 0)} use{skill.usesPerBattle - (skillUsage[skill.id] ?? 0) !== 1 ? 's' : ''} left
                                </p>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="text-center pt-2 space-y-2">
                  <p className="text-xs text-zinc-500">Starting in <span className="font-bold text-white">{introCountdown}s</span></p>
                  {localSkillIds.length > 0 && <p className="text-xs text-pink-400">{localSkillIds.join(', ')} activated</p>}
                  {!isServerMode && (
                    <button onClick={() => {
                      if (introCountdownRef.current) { clearInterval(introCountdownRef.current); introCountdownRef.current = null }
                      const updated = players.map((p) => ({ ...p, hp: displayHp[p.id] ?? 0, eliminated: (displayHp[p.id] ?? 0) <= 0 }))
                      const skills: ActiveSkill[] = localSkillIds.map((skillId) => {
                        const ps = getPlayerSkills(userId).find(({ skill }) => skill.id === skillId)
                        return ps ? { skill: ps.skill, activatedBy: userId, roundActivated: roundNum } : null
                      }).filter(Boolean) as ActiveSkill[]
                      const result = precomputeRound(updated, displayHp, roundNum, undefined, skills.length > 0 ? skills : undefined, getLocalRng(roundNum))
                      handleNewRound(roundNum, result, skills)
                    }} className="rounded-lg bg-red-600 px-8 py-3 text-sm font-bold text-white hover:bg-red-500">
                      Fight Now
                    </button>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Waiting for round to be computed */}
          {battlePhase === 'waiting-for-round' && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center animate-pulse" style={{ minHeight: '12rem' }}>
              <p className="text-sm text-zinc-400">Waiting for all players...</p>
              {readyInfo && <p className="mt-2 text-xs text-zinc-500">{readyInfo.readyCount}/{readyInfo.aliveCount} ready</p>}
            </div>
          )}

          {/* Fighting */}
          {battlePhase === 'fighting' && precomputed && (() => {
            const myMatchIdx = precomputed.matches.findIndex((m) => m.player1Id === userId || m.player2Id === userId)
            const otherMatches = precomputed.matches.map((m, i) => ({ match: m, idx: i })).filter((_, i) => i !== myMatchIdx)

            return (
              <div className="space-y-4">
                {myMatchSkills.length > 0 && (
                  <div className="rounded-lg border border-pink-800 bg-pink-950/20 px-3 py-1.5 text-center">
                    {myMatchSkills.map((as, i) => (
                      <span key={i} className="text-xs"><span className="font-bold text-pink-400">{as.skill.name}</span><span className="text-zinc-500"> active</span></span>
                    ))}
                  </div>
                )}
                <div className="text-center text-xs text-zinc-500">Card {cardIdx + 1}/5</div>

                {myMatchIdx >= 0 && !matchKo.has(myMatchIdx) && (() => {
                  const myMatch = precomputed.matches[myMatchIdx]
                  const fo = myMatch.faceOffs[cardIdx] as FaceOffDetail
                  const imPlayer1 = myMatch.player1Id === userId
                  const opponentId = imPlayer1 ? myMatch.player2Id : myMatch.player1Id
                  const displayFo: FaceOffDetail = imPlayer1 ? fo : {
                    ...fo, card1: fo.card2, card2: fo.card1, star1: fo.star2, star2: fo.star1,
                    roll1: fo.roll2, roll2: fo.roll1, effective1: fo.effective2, effective2: fo.effective1,
                    damage1: fo.damage2, damage2: fo.damage1,
                  }
                  const myHp = displayHp[userId] ?? 0
                  const oppHp = displayHp[opponentId] ?? 0

                  return (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6" style={{ minHeight: '16rem' }}>
                      <div className="mb-4 flex items-center gap-4">
                        <div className="flex-1">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs font-medium text-amber-400">You</span>
                            <span className={`text-xs font-bold ${myHp <= 3 ? 'text-red-400' : 'text-green-400'}`}>{myHp} HP</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-zinc-800">
                            <div className={`h-full rounded-full transition-all duration-700 ease-out ${myHp <= 3 ? 'bg-red-500' : myHp <= 6 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${(myHp / 10) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-xs text-zinc-600">VS</span>
                        <div className="flex-1">
                          <div className="mb-1 flex items-center justify-between">
                            <span className={`text-xs font-bold ${oppHp <= 3 ? 'text-red-400' : 'text-green-400'}`}>{oppHp} HP</span>
                            <span className="text-xs font-medium text-zinc-400">{getPlayer(opponentId)?.name}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-zinc-800">
                            <div className={`h-full rounded-full transition-all duration-700 ease-out ${oppHp <= 3 ? 'bg-red-500' : oppHp <= 6 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${(oppHp / 10) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="mt-8" />
                      <BattleFaceoff faceOff={displayFo} phase={faceoffPhase} rollElapsed={rollElapsed} large
                        p1Name="You" p2Name={getPlayer(opponentId)?.name || 'Opponent'}
                        p1Hp={displayHp[userId] ?? 0} p2Hp={displayHp[opponentId] ?? 0}
                        cardFilter={precomputed.flags?.visualEffect} />
                    </div>
                  )
                })()}

                {myMatchIdx >= 0 && matchKo.has(myMatchIdx) && (() => {
                  const myMatch = precomputed.matches[myMatchIdx]
                  const myHp = displayHp[userId] ?? 0
                  const iDied = myHp <= 0
                  const opponentId = myMatch.player1Id === userId ? myMatch.player2Id : myMatch.player1Id
                  const opponentName = getPlayer(opponentId)?.name || 'Opponent'
                  return (
                    <div className={`rounded-xl border ${iDied ? 'border-red-900 bg-black' : 'border-green-900 bg-black'} flex flex-col items-center justify-center gap-2 animate-[fadeIn_1s_ease-out]`} style={{ minHeight: '16rem' }}>
                      {iDied ? (
                        <><p className="text-3xl font-black tracking-widest text-red-600" style={{ fontFamily: 'Georgia, serif' }}>YOU DIED</p><p className="text-sm text-zinc-500">Killed by {opponentName}</p></>
                      ) : (
                        <><p className="text-3xl font-black tracking-widest text-green-500" style={{ fontFamily: 'Georgia, serif' }}>KNOCKOUT!</p><p className="text-sm text-zinc-400">You eliminated <span className="font-bold text-white">{opponentName}</span> 💀</p></>
                      )}
                    </div>
                  )
                })()}

                {myMatchIdx < 0 && (
                  <div className={`rounded-xl border ${(displayHp[userId] ?? 0) <= 0 ? 'border-zinc-800 bg-zinc-900' : 'border-amber-800 bg-amber-950/20'} p-6 text-center`}>
                    {(displayHp[userId] ?? 0) <= 0
                      ? <><p className="text-sm text-red-400 font-medium">You have been eliminated</p><p className="text-xs text-zinc-500 mt-1">Spectating remaining matches</p></>
                      : <span className="text-sm text-amber-400">You have a pass this round</span>
                    }
                  </div>
                )}

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
                              <div className="text-center text-[10px] text-red-400 font-bold py-1">
                                {(displayHp[match.player1Id] ?? 0) <= 0
                                  ? `${getPlayer(match.player2Id)?.name} KO'd ${getPlayer(match.player1Id)?.name} 💀`
                                  : `${getPlayer(match.player1Id)?.name} KO'd ${getPlayer(match.player2Id)?.name} 💀`}
                              </div>
                            ) : (
                              <BattleFaceoff faceOff={fo} phase={faceoffPhase} rollElapsed={rollElapsed} large={false}
                                cardFilter={precomputed.flags?.visualEffect} />
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
          {(battlePhase === 'round-end') && precomputed && (() => {
            return (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 animate-[fadeIn_0.5s_ease-out]">
                <h3 className="mb-4 text-lg font-bold text-center">Round {roundNum} Complete</h3>

                {myMatchSkills.length > 0 && (
                  <div className="mb-4 rounded-lg border border-pink-800 bg-pink-950/20 px-4 py-2">
                    {myMatchSkills.map((as, i) => (
                      <div key={i} className="text-sm text-center">
                        <span className="text-white font-medium">{getPlayer(as.activatedBy)?.name}</span>
                        <span className="text-zinc-500"> used </span>
                        <span className="font-bold text-pink-400">{as.skill.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mb-6 space-y-1">
                  {precomputed.matches.map((m, i) => {
                    const fos = m.faceOffs as FaceOffDetail[]
                    const dmg1to2 = fos.reduce((s, fo) => s + fo.damage2, 0)
                    const dmg2to1 = fos.reduce((s, fo) => s + fo.damage1, 0)
                    const p1Knocked = (displayHp[m.player1Id] ?? 0) <= 0
                    const p2Knocked = (displayHp[m.player2Id] ?? 0) <= 0
                    return (
                      <div key={i} className="text-sm text-center space-y-0.5">
                        <div>
                          <span className="text-white font-medium">{getPlayer(m.player1Id)?.name}</span>
                          <span className="text-red-400 font-bold"> {dmg1to2} </span>
                          <span className="text-zinc-600">-</span>
                          <span className="text-red-400 font-bold"> {dmg2to1} </span>
                          <span className="text-white font-medium">{getPlayer(m.player2Id)?.name}</span>
                        </div>
                        {p2Knocked && <div className="text-red-400 font-bold">{getPlayer(m.player1Id)?.name} KO&apos;d {getPlayer(m.player2Id)?.name} 💀</div>}
                        {p1Knocked && <div className="text-red-400 font-bold">{getPlayer(m.player2Id)?.name} KO&apos;d {getPlayer(m.player1Id)?.name} 💀</div>}
                      </div>
                    )
                  })}
                  {precomputed.byePlayerId && (
                    <div className="mt-2 text-xs text-zinc-500 text-center">{getPlayer(precomputed.byePlayerId)?.name} got a pass</div>
                  )}
                </div>

                {/* Your match stats */}
                {(() => {
                  const myMatch = precomputed.matches.find((m) => m.player1Id === userId || m.player2Id === userId)
                  if (!myMatch) return null
                  const imP1 = myMatch.player1Id === userId
                  const oppId = imP1 ? myMatch.player2Id : myMatch.player1Id
                  const oppName = getPlayer(oppId)?.name || 'Opponent'
                  const allFos = myMatch.faceOffs as FaceOffDetail[]
                  let tempOppHp = displayHp[oppId] ?? 0
                  allFos.forEach((fo) => { tempOppHp += (imP1 ? fo.damage2 : fo.damage1) })
                  let tempMyHp = displayHp[userId] ?? 0
                  allFos.forEach((fo) => { tempMyHp += (imP1 ? fo.damage1 : fo.damage2) })
                  const fos: FaceOffDetail[] = []
                  let tempKo = false
                  for (const fo of allFos) {
                    if (tempKo) break
                    fos.push(fo)
                    tempOppHp -= (imP1 ? fo.damage2 : fo.damage1)
                    tempMyHp -= (imP1 ? fo.damage1 : fo.damage2)
                    if (tempOppHp <= 0 || tempMyHp <= 0) tempKo = true
                  }
                  const dmgDealt = fos.reduce((s, fo) => s + (imP1 ? fo.damage2 : fo.damage1), 0)
                  const dmgTaken = fos.reduce((s, fo) => s + (imP1 ? fo.damage1 : fo.damage2), 0)
                  const wins = fos.filter((fo) => imP1 ? fo.damage2 > 0 : fo.damage1 > 0).length
                  const losses = fos.filter((fo) => imP1 ? fo.damage1 > 0 : fo.damage2 > 0).length
                  const ties = fos.length - wins - losses

                  return (
                    <div className="mb-6 border-t border-zinc-800 pt-4">
                      <h4 className="mb-3 text-sm font-medium text-zinc-400 text-center">
                        Your Match vs <span className="text-white">{oppName}</span>
                      </h4>
                      <div className="grid grid-cols-3 gap-3 mb-3 text-center">
                        <div><p className="text-lg font-bold text-red-400">{dmgDealt}</p><p className="text-[10px] text-zinc-500">Damage Dealt</p></div>
                        <div><p className="text-lg font-bold text-zinc-300">{wins}-{losses}{ties > 0 ? `-${ties}` : ''}</p><p className="text-[10px] text-zinc-500">W-L{ties > 0 ? '-T' : ''}</p></div>
                        <div><p className="text-lg font-bold text-amber-400">{dmgTaken}</p><p className="text-[10px] text-zinc-500">Damage Taken</p></div>
                      </div>
                      <div className="space-y-2">
                        {fos.map((fo, i) => {
                          const myCard = imP1 ? fo.card1 : fo.card2
                          const oppCard = imP1 ? fo.card2 : fo.card1
                          const myStar = imP1 ? fo.star1 : fo.star2
                          const oppStar = imP1 ? fo.star2 : fo.star1
                          const myRoll = imP1 ? fo.roll1 : fo.roll2
                          const oppRoll = imP1 ? fo.roll2 : fo.roll1
                          const myEff = imP1 ? fo.effective1 : fo.effective2
                          const oppEff = imP1 ? fo.effective2 : fo.effective1
                          const myDmg = imP1 ? fo.damage2 : fo.damage1
                          const oppDmg = imP1 ? fo.damage1 : fo.damage2
                          const won = myDmg > 0
                          const lost = oppDmg > 0
                          const isKoCard = tempKo && i === fos.length - 1
                          const isMyKo = isKoCard && won
                          const isMyDeath = isKoCard && lost
                          const label = isMyKo ? 'KO' : isMyDeath ? 'YOU DIED' : won ? 'WIN' : lost ? 'LOSE' : 'TIE'
                          return (
                            <div key={i} className={`flex items-center justify-center rounded-lg py-3 px-2 ${won ? 'bg-green-950/30' : lost ? 'bg-red-950/30' : 'bg-zinc-800/50'}`}>
                              <div className={`w-24 flex-shrink-0 ${lost ? 'opacity-50' : ''}`} style={{ transform: 'rotate(5deg)' }}>
                                <CompactCard card={myCard} />
                                <div className="mt-1 text-center">
                                  <span className="text-[10px] text-zinc-400">⭐{myStar}</span>
                                  {myRoll > 0 && <span className="text-[10px] text-amber-400"> +{myRoll}🎲</span>}
                                </div>
                              </div>
                              <div className="w-10 text-center"><span className={`text-lg font-bold ${won ? 'text-green-400' : lost ? 'text-zinc-500' : 'text-zinc-400'}`}>{myEff}</span></div>
                              <div className="flex flex-col items-center mx-2 flex-shrink-0">
                                <span className={`text-sm font-bold ${isMyKo ? 'text-green-400' : isMyDeath ? 'text-red-400' : won ? 'text-green-400' : lost ? 'text-red-400' : 'text-zinc-500'}`}>{label}</span>
                                <span className={`text-xs ${won ? 'text-green-400' : lost ? 'text-red-400' : 'text-zinc-500'}`}>{won ? `-${myDmg} HP` : lost ? `-${oppDmg} HP` : 'No dmg'}</span>
                              </div>
                              <div className="w-10 text-center"><span className={`text-lg font-bold ${lost ? 'text-red-400' : won ? 'text-zinc-500' : 'text-zinc-400'}`}>{oppEff}</span></div>
                              <div className={`w-24 flex-shrink-0 ${won ? 'opacity-50' : ''}`} style={{ transform: 'rotate(-5deg)' }}>
                                <CompactCard card={oppCard} />
                                <div className="mt-1 text-center">
                                  <span className="text-[10px] text-zinc-400">⭐{oppStar}</span>
                                  {oppRoll > 0 && <span className="text-[10px] text-amber-400"> +{oppRoll}🎲</span>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                <div className="text-center">
                  {aliveCount() <= 1 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-500">Final results in <span className="font-bold text-white">{roundEndCountdown}s</span></p>
                      <button onClick={() => {
                        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
                        setPhase('done')
                      }} className="rounded-lg bg-white px-6 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-200">View Results Now</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-500">Next round in <span className="font-bold text-white">{roundEndCountdown}s</span></p>
                      <button onClick={() => {
                        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
                        setRoundNum((r) => r + 1)
                        setBattlePhase('skill-select')
                      }}
                        className="rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-500">Ready Up</button>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

        </div>
      )}

      {/* Done */}
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
          {onBattleEnd && (
            <button onClick={onBattleEnd} className="rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-300 hover:bg-zinc-800">Back</button>
          )}
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  )
}
