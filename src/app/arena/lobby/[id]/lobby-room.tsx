'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { BattlePlayer, BattleCard, RoundResult } from '@/lib/battle-engine'
import { resolveSkills, starCount } from '@/lib/battle-engine'
import type { ActiveSkill } from '@/lib/skills'
import { leaveLobby, toggleReady, kickPlayer, startGame } from '@/app/arena/lobby-actions'
import { submitRoundReady, updateSessionHp, endArenaSession, getMatchupPreview, updateConnectedPlayers, checkActiveSession, getSessionHp } from '@/app/arena/actions'
import { useArenaStatus } from '@/hooks/use-arena-status'
import ArenaBattle from '@/components/arena/arena-battle'
import CompactCard from '@/components/compact-card'
import { rarityLabel, rarityBadgeColors } from '@/lib/rarities'

type DeckOption = {
  slot: number
  name: string
  cards: (BattleCard & { dbSkillIds?: string[] })[]
}

type LobbyPlayer = {
  user_id: string
  user_name: string
  avatar_url: string | null
  is_ready: boolean
  deck_cards: any
}

export default function LobbyRoom({
  lobbyId,
  lobbyName,
  hostId: initialHostId,
  lobbyStatus: initialStatus,
  maxPlayers,
  userId,
  userName,
  avatarUrl,
  legalDecks,
  dbSkills,
  activeSession,
}: {
  lobbyId: string
  lobbyName: string
  hostId: string
  lobbyStatus: string
  maxPlayers: number
  userId: string
  userName: string
  avatarUrl: string | null
  legalDecks: DeckOption[]
  dbSkills?: { id: string; name: string; description: string }[]
  activeSession: { sessionId: string; seed: number; players: any[]; hp: Record<string, number> } | null
}) {
  const router = useRouter()
  useArenaStatus()
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [hostId, setHostId] = useState(initialHostId)
  const [selectedDeck, setSelectedDeck] = useState<number | null>(null)
  const [myReady, setMyReady] = useState(false)
  const [messages, setMessages] = useState<{ id: string; userName: string; text: string; userId: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [leaving, setLeaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Battle state
  const [isRejoiningGame, setIsRejoiningGame] = useState(!!activeSession)
  const [battleStarted, setBattleStarted] = useState(false)
  const [battlePlayers, setBattlePlayers] = useState<BattlePlayer[]>([])
  const [battleSessionId, setBattleSessionId] = useState<string | null>(activeSession?.sessionId ?? null)
  const [battleSeed, setBattleSeed] = useState<number | null>(activeSession?.seed ?? null)
  const [initialHp, setInitialHp] = useState<Record<string, number> | null>(activeSession?.hp ?? null)
  const [initialRound, setInitialRound] = useState<RoundResult | null>(null)
  const [initialRoundNum, setInitialRoundNum] = useState<number | null>(null)
  const [initialSkills, setInitialSkills] = useState<ActiveSkill[]>([])

  const channelRef = useRef<RealtimeChannel | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const isHost = userId === hostId

  const attachSkills = (cards: (BattleCard & { dbSkillIds?: string[] })[]): BattleCard[] =>
    cards.map((c) => ({
      ...c,
      skills: c.dbSkillIds && c.dbSkillIds.length > 0 ? resolveSkills(c.dbSkillIds, dbSkills) : undefined,
    }))

  // Set up battle from active session on mount
  useEffect(() => {
    if (!activeSession) return

    const setup = async () => {
      // Fetch fresh HP from round history (server-computed, always accurate)
      const freshHp = await getSessionHp(activeSession.sessionId) || activeSession.hp

      const bp: BattlePlayer[] = activeSession.players.map((p: any) => ({
        id: p.id, name: p.name, avatar_url: p.avatar_url,
        deck: attachSkills(p.deck || []),
        hp: freshHp[p.id] ?? 0,
        eliminated: (freshHp[p.id] ?? 0) <= 0,
      }))
      setBattlePlayers(bp)
      setBattleSessionId(activeSession.sessionId)
      setBattleSeed(activeSession.seed)
      setInitialHp(freshHp)

      // Get latest round
      const supabase = createClient()
      const { data } = await supabase.from('arena_rounds')
        .select('round_num, result, skills_used')
        .eq('session_id', activeSession.sessionId)
        .order('round_num', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) {
        setInitialRoundNum(data.round_num)
        setInitialRound(data.result as RoundResult)
        setInitialSkills((data.skills_used || []) as ActiveSkill[])
      }
      setBattleStarted(true)
      // Broadcast join after a short delay to ensure channel is connected
      setTimeout(() => {
        channelRef.current?.send({
          type: 'broadcast', event: 'player-joined',
          payload: { id: userId, name: userName, avatar_url: avatarUrl, hp: freshHp[userId] ?? 0 },
        })
      }, 2000)
    }

    setup()
  }, [])

  // Realtime channel for lobby
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`arena-lobby-${lobbyId}`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setMessages((prev) => [...prev.slice(-50), payload as any])
      })
      .on('broadcast', { event: 'game-started' }, ({ payload }) => {
        const bp: BattlePlayer[] = payload.players.map((p: any) => ({
          id: p.id, name: p.name, avatar_url: p.avatar_url,
          deck: attachSkills(p.deck || []), hp: 10, eliminated: false,
        }))
        setBattlePlayers(bp)
        setBattleSessionId(payload.sessionId)
        setBattleSeed(payload.seed)
        setInitialHp(payload.hp)
        setIsRejoiningGame(false) // fresh start, not rejoin
        setBattleStarted(true)
      })
      .on('broadcast', { event: 'ready-change' }, () => {
        fetchPlayers()
      })
      .on('broadcast', { event: 'player-joined' }, ({ payload }) => {
        setBattlePlayers((prev) => {
          if (prev.some((p) => p.id === payload.id)) return prev
          return [...prev, {
            id: payload.id, name: payload.name, avatar_url: payload.avatar_url,
            deck: [], hp: payload.hp ?? 0, eliminated: (payload.hp ?? 0) <= 0,
          }]
        })
      })
      .on('broadcast', { event: 'lobby-update' }, ({ payload }) => {
        if (payload.hostId) setHostId(payload.hostId)
        if (payload.kicked === userId) {
          router.push('/arena')
        }
      })
      .on('presence', { event: 'sync' }, () => {
        // Refresh player list from DB
        fetchPlayers()
        // Update connected players during battle
        if (battleSessionId) {
          const state = channel.presenceState()
          const connectedIds = Object.keys(state)
          updateConnectedPlayers(battleSessionId, connectedIds).catch(() => {})
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: userName, avatar_url: avatarUrl })
        }
      })

    channelRef.current = channel
    fetchPlayers()

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [lobbyId, userId])

  const fetchPlayers = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('arena_lobby_players')
      .select('user_id, user_name, avatar_url, is_ready, deck_cards')
      .eq('lobby_id', lobbyId)
      .order('joined_at')
    if (data) setPlayers(data)
  }

  const handleToggleReady = async () => {
    const deck = legalDecks.find((d) => d.slot === selectedDeck)
    if (!deck && !myReady) return
    const newReady = !myReady
    setMyReady(newReady)
    await toggleReady(lobbyId, newReady, selectedDeck ?? undefined, newReady ? deck?.cards : null)
    fetchPlayers()
    channelRef.current?.send({ type: 'broadcast', event: 'ready-change', payload: { userId, ready: newReady } })
  }

  const handleLeave = async () => {
    setLeaving(true)
    await leaveLobby(lobbyId)
    channelRef.current?.send({ type: 'broadcast', event: 'lobby-update', payload: {} })
    router.push('/arena')
  }

  const handleKick = async (targetId: string) => {
    await kickPlayer(lobbyId, targetId)
    channelRef.current?.send({ type: 'broadcast', event: 'lobby-update', payload: { kicked: targetId } })
    fetchPlayers()
  }

  const handleStartGame = async () => {
    if (!selectedDeck) return
    setStarting(true)
    // Save host's deck to DB before starting
    const deck = legalDecks.find((d) => d.slot === selectedDeck)
    if (deck) {
      await toggleReady(lobbyId, true, selectedDeck, deck.cards)
    }
    const result = await startGame(lobbyId)
    if (result && 'sessionId' in result) {
      channelRef.current?.send({
        type: 'broadcast', event: 'game-started',
        payload: { sessionId: result.sessionId, seed: result.seed, players: result.players, hp: result.hp },
      })
      const bp: BattlePlayer[] = (result.players || []).map((p: any) => ({
        id: p.id, name: p.name, avatar_url: p.avatar_url,
        deck: attachSkills(p.deck || []), hp: 10, eliminated: false,
      }))
      setBattlePlayers(bp)
      setBattleSessionId(result.sessionId!)
      setBattleSeed(result.seed!)
      setInitialHp(result.hp ?? null)
      setBattleStarted(true)
    } else {
      setError(result && 'error' in result ? result.error : 'Failed to start game')
      setStarting(false)
    }
  }

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !channelRef.current) return
    const msg = { id: `${userId}-${Date.now()}`, userId, userName, text: chatInput.trim() }
    channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg })
    setMessages((prev) => [...prev.slice(-50), msg])
    setChatInput('')
  }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const secretRareCount = (deck: DeckOption) => deck.cards.filter((c) => c.rarity === 'secret_rare').length
  const othersReady = players.filter((p) => p.user_id !== userId).every((p) => p.is_ready)
  const canStart = isHost && players.length >= 2 && othersReady && selectedDeck !== null

  // === BATTLE VIEW ===
  if (battleStarted && battlePlayers.length > 0 && battleSessionId) {
    return (
      <ArenaBattle
        userId={userId}
        players={battlePlayers}
        sessionId={battleSessionId}
        seed={battleSeed ?? undefined}
        initialRoundNum={initialRoundNum ?? undefined}
        initialRound={initialRound ?? undefined}
        initialHp={initialHp ?? undefined}
        initialSkills={initialSkills.length > 0 ? initialSkills : undefined}
        isRejoining={isRejoiningGame}
        getConnectedIds={() => {
          const state = channelRef.current?.presenceState() || {}
          return Object.keys(state)
        }}
        onGameOver={async () => {
          // Reset lobby status + unready all players
          const supabase = createClient()
          await supabase.from('arena_lobbies').update({ status: 'waiting' }).eq('id', lobbyId)
          await supabase.from('arena_lobby_players').update({ is_ready: false, deck_cards: null }).eq('lobby_id', lobbyId)
        }}
        onBattleEnd={() => {
          setBattleStarted(false)
          setBattlePlayers([])
          setBattleSessionId(null)
          setBattleSeed(null)
          setInitialHp(null)
          setInitialRound(null)
          setInitialRoundNum(null)
          setInitialSkills([])
          setMyReady(false)
          setSelectedDeck(null)
          setStarting(false)
          setIsRejoiningGame(false)
          fetchPlayers()
        }}
      />
    )
  }

  // === LOBBY VIEW ===
  return (
    <div>
      {/* Starting overlay */}
      {starting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <span data-testid="starting-overlay" className="text-4xl font-black text-white animate-pulse">Starting...</span>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300 text-center">{error}</div>
      )}

      {/* Players */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-400">Players ({players.length}/{maxPlayers})</h3>
          {isHost && <span className="rounded bg-amber-900/50 px-2 py-0.5 text-[10px] text-amber-400">You are the host</span>}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {players.map((p) => (
            <div key={p.user_id}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                p.is_ready ? 'border-green-600 bg-green-950/20'
                : p.user_id === userId ? 'border-amber-700 bg-amber-950/20'
                : 'border-zinc-800 bg-zinc-900'
              }`}>
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover border-2 border-zinc-700" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 border-2 border-zinc-700 text-lg text-zinc-500">?</div>
              )}
              <span className="text-sm font-medium text-center truncate w-full">
                {p.user_name}
                {p.user_id === userId && <span className="text-zinc-500"> (You)</span>}
                {p.user_id === hostId && <span className="text-amber-400"> ★</span>}
              </span>
              {p.is_ready ? (
                <span className="text-xs font-medium text-green-400">Ready</span>
              ) : (
                <span className="text-[10px] text-zinc-500">Not ready</span>
              )}
              {isHost && p.user_id !== userId && (
                <button onClick={() => handleKick(p.user_id)} className="text-[10px] text-red-400 hover:text-red-300">Kick</button>
              )}
            </div>
          ))}
          {Array.from({ length: Math.max(0, maxPlayers - players.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-zinc-700 text-zinc-700">?</div>
              <span className="text-xs text-zinc-600">Waiting...</span>
            </div>
          ))}
        </div>
      </div>

      {/* Deck selection */}
      <div className="mb-8">
        <h3 className="mb-3 text-sm font-medium text-zinc-400">Choose Your Deck</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {legalDecks.map((deck) => {
            const isSelected = selectedDeck === deck.slot
            const totalPower = deck.cards.reduce((s, c) => s + (starCount[c.rarity] || 1), 0)
            const avgPower = (totalPower / deck.cards.length).toFixed(1)
            const rarityCounts: Record<string, number> = {}
            deck.cards.forEach((c) => { rarityCounts[c.rarity] = (rarityCounts[c.rarity] || 0) + 1 })
            const illegal = secretRareCount(deck) > 1

            return (
              <button key={deck.slot}
                aria-pressed={isSelected}
                onClick={() => !myReady && !illegal && setSelectedDeck(isSelected ? null : deck.slot)}
                disabled={myReady}
                className={`rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed ${
                  illegal ? 'border-red-800 opacity-50 cursor-not-allowed'
                  : isSelected ? 'border-red-500 bg-red-950/30'
                  : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                }`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">{deck.name}</span>
                  <span className="text-xs text-zinc-500">⭐ {totalPower} ({avgPower} avg)</span>
                </div>
                {illegal && <div className="mb-2 rounded bg-red-900/50 px-2 py-1 text-[10px] text-red-300 text-center">Max 1 Secret Rare per deck</div>}
                <div className="relative h-28 mb-3 flex items-center justify-center">
                  {deck.cards.map((card, i) => (
                    <div key={card.id} className="absolute w-20 transition-all duration-200 hover:!z-50 hover:scale-110 hover:!translate-x-0"
                      style={{ left: `calc(50% + ${(i - 2) * 38}px - 40px)`, top: `${Math.abs(i - 2) * 3}px`, zIndex: i, transform: `rotate(${(i - 2) * 4}deg)` }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'rotate(0deg) scale(1.1)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = `rotate(${(i - 2) * 4}deg)` }}>
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

      {/* Chat */}
      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="h-48 overflow-y-auto p-3">
          {messages.length === 0 && <p className="py-8 text-center text-xs text-zinc-600">No messages yet</p>}
          {messages.map((msg) => (
            <div key={msg.id} className="mb-1.5">
              <span className={`text-xs font-medium ${msg.userId === userId ? 'text-amber-400' : 'text-zinc-300'}`}>{msg.userName}</span>
              <span className="ml-2 text-xs text-zinc-400">{msg.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={sendMessage} className="flex border-t border-zinc-800">
          <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message..." maxLength={200}
            className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none" />
          <button type="submit" disabled={!chatInput.trim()} className="px-4 text-sm font-medium text-zinc-400 hover:text-white disabled:opacity-30">Send</button>
        </form>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        {isHost ? (
          <>
            <button onClick={handleStartGame} disabled={!canStart || starting}
              className="rounded-lg bg-red-600 px-8 py-3 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed">
              {starting ? 'Starting...' : canStart ? 'Start Game' : !selectedDeck ? 'Select a deck first' : players.length < 2 ? 'Need 2+ players' : 'Waiting for players to ready up'}
            </button>
            <button onClick={handleLeave} disabled={leaving}
              className="rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-400 hover:bg-zinc-800 disabled:opacity-50">
              {leaving ? 'Leaving...' : 'Close Lobby'}
            </button>
          </>
        ) : (
          <>
            <button onClick={handleToggleReady} disabled={!selectedDeck}
              className={`rounded-lg px-8 py-3 text-sm font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                myReady ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600' : 'bg-red-600 text-white hover:bg-red-500'
              }`}>
              {!selectedDeck ? 'Select a deck first' : myReady ? 'Cancel Ready' : 'Ready Up'}
            </button>
            <button onClick={handleLeave} disabled={leaving}
              className="rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-400 hover:bg-zinc-800 disabled:opacity-50">
              {leaving ? 'Leaving...' : 'Leave Lobby'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
