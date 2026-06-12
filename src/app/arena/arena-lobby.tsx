'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { BattlePlayer, BattleCard } from '@/lib/battle-engine'
import { resolveSkills, starCount } from '@/lib/battle-engine'
import { createArenaSession, cleanupArenaSession, updateConnectedPlayers } from './actions'
import ArenaBattle from '@/components/arena/arena-battle'
import CompactCard from '@/components/compact-card'
import { rarityLabel, rarityBadgeColors } from '@/lib/rarities'

type LobbyPlayer = {
  id: string
  name: string
  avatar_url: string | null
  joined_at: number
  ready: boolean
  selectedDeckSlot: number | null
  deck?: (BattleCard & { dbSkillIds?: string[] })[]
}

type ChatMessage = {
  id: string
  userId: string
  userName: string
  text: string
  timestamp: number
}

type DeckOption = {
  slot: number
  name: string
  cards: (BattleCard & { dbSkillIds?: string[] })[]
}

export default function ArenaLobby({
  userId,
  userName,
  avatarUrl,
  legalDecks,
  dbSkills,
}: {
  userId: string
  userName: string
  avatarUrl: string | null
  legalDecks: DeckOption[]
  dbSkills?: { id: string; name: string; description: string }[]
}) {
  // === Lobby state ===
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([])
  const [connected, setConnected] = useState(false)
  const [selectedDeck, setSelectedDeck] = useState<number | null>(null)
  const [myReady, setMyReady] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')

  // === Battle state ===
  const [starting, setStarting] = useState(false)
  const [battleStarted, setBattleStarted] = useState(false)
  const [battlePlayers, setBattlePlayers] = useState<BattlePlayer[]>([])
  const [battleSessionId, setBattleSessionId] = useState<string | null>(null)
  const [battleSeed, setBattleSeed] = useState<number | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const battleSessionRef = useRef<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const joinedAtRef = useRef(Date.now())
  const readyMapRef = useRef<Record<string, boolean>>({})
  const deckMapRef = useRef<Record<string, number | null>>({})
  const deckDataRef = useRef<Record<string, (BattleCard & { dbSkillIds?: string[] })[]>>({})

  const attachSkills = (cards: (BattleCard & { dbSkillIds?: string[] })[]): BattleCard[] =>
    cards.map((c) => ({
      ...c,
      skills: c.dbSkillIds && c.dbSkillIds.length > 0 ? resolveSkills(c.dbSkillIds, dbSkills) : undefined,
    }))

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('arena-lobby', {
      config: { presence: { key: userId } },
    })

    channel
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setMessages((prev) => [...prev.slice(-50), payload as ChatMessage])
      })
      .on('broadcast', { event: 'ready-change' }, ({ payload }) => {
        readyMapRef.current[payload.userId] = payload.ready
        deckMapRef.current[payload.userId] = payload.deckSlot
        if (payload.deck) deckDataRef.current[payload.userId] = payload.deck
        setLobbyPlayers((prev) => prev.map((p) =>
          p.id === payload.userId ? { ...p, ready: payload.ready, selectedDeckSlot: payload.deckSlot, deck: payload.deck || p.deck } : p
        ))
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string; avatar_url: string | null; joined_at: number }>()
        const playerList: LobbyPlayer[] = []
        for (const [id, presences] of Object.entries(state)) {
          if (presences.length > 0) {
            const p = presences[0]
            playerList.push({
              id, name: p.name, avatar_url: p.avatar_url, joined_at: p.joined_at,
              ready: readyMapRef.current[id] || false,
              selectedDeckSlot: deckMapRef.current[id] ?? null,
            })
          }
        }
        playerList.sort((a, b) => a.joined_at - b.joined_at)
        setLobbyPlayers(playerList)
        // Sync connected players to DB during battle
        if (battleSessionRef.current) {
          const connectedIds = playerList.map((p) => p.id)
          updateConnectedPlayers(battleSessionRef.current, connectedIds).catch(() => {})
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: userName, avatar_url: avatarUrl, joined_at: joinedAtRef.current })
          setConnected(true)
        }
      })

    channelRef.current = channel
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [userId, userName, avatarUrl])

  // Start session via server action — ALL clients call this
  const startSession = async () => {
    setStarting(true)
    const gamePlayers = lobbyPlayers.map((lp) => ({
      id: lp.id,
      name: lp.name,
      avatar_url: lp.avatar_url,
      deck: deckDataRef.current[lp.id] || [],
    }))

    const result = await createArenaSession('arena-lobby', gamePlayers)
    if (!result) return

    const players: BattlePlayer[] = (result.players as typeof gamePlayers).map((p) => ({
      id: p.id, name: p.name, avatar_url: p.avatar_url,
      deck: attachSkills(p.deck), hp: 10, eliminated: false,
    }))

    setBattlePlayers(players)
    setBattleSessionId(result.sessionId)
    battleSessionRef.current = result.sessionId
    setBattleSeed(result.seed)
    setBattleStarted(true)
    // Initial connected players sync
    updateConnectedPlayers(result.sessionId, lobbyPlayers.map((p) => p.id)).catch(() => {})
  }

  // Watch for all ready → countdown → start session
  useEffect(() => {
    if (battleStarted || countdown !== null) return
    if (lobbyPlayers.length >= 2 && lobbyPlayers.every((p) => p.ready)) {
      setCountdown(5)
      let count = 5
      countdownRef.current = setInterval(() => {
        count--
        if (count <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          countdownRef.current = null
          setCountdown(null)
          startSession()
        } else {
          setCountdown(count)
        }
      }, 1000)
    }
  }, [lobbyPlayers, battleStarted, countdown])

  // Cancel countdown if someone unreadies
  useEffect(() => {
    if (countdown !== null && lobbyPlayers.length >= 2 && !lobbyPlayers.every((p) => p.ready)) {
      if (countdownRef.current) clearInterval(countdownRef.current)
      countdownRef.current = null
      setCountdown(null)
    }
  }, [lobbyPlayers, countdown])

  const toggleReady = () => {
    const newReady = !myReady
    setMyReady(newReady)
    readyMapRef.current[userId] = newReady
    deckMapRef.current[userId] = selectedDeck
    const myDeck = legalDecks.find((d) => d.slot === selectedDeck)?.cards || []
    deckDataRef.current[userId] = myDeck
    setLobbyPlayers((prev) => prev.map((p) =>
      p.id === userId ? { ...p, ready: newReady, selectedDeckSlot: selectedDeck, deck: myDeck } : p
    ))
    channelRef.current?.send({
      type: 'broadcast', event: 'ready-change',
      payload: { userId, ready: newReady, deckSlot: selectedDeck, deck: newReady ? myDeck : undefined },
    })
  }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !channelRef.current) return
    const msg: ChatMessage = { id: `${userId}-${Date.now()}`, userId, userName, text: chatInput.trim(), timestamp: Date.now() }
    channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg })
    setMessages((prev) => [...prev.slice(-50), msg])
    setChatInput('')
  }

  // === BATTLE VIEW ===
  if (battleStarted && battlePlayers.length > 0 && battleSessionId) {
    return (
      <ArenaBattle
        userId={userId}
        players={battlePlayers}
        sessionId={battleSessionId}
        seed={battleSeed ?? undefined}
        onBattleEnd={() => {
          setBattleStarted(false)
          setStarting(false)
          setBattlePlayers([])
          setBattleSessionId(null)
          battleSessionRef.current = null
          setBattleSeed(null)
          setMyReady(false)
          setSelectedDeck(null)
          readyMapRef.current = {}
          deckMapRef.current = {}
          deckDataRef.current = {}
          setCountdown(null)
          setLobbyPlayers((prev) => prev.map((p) => ({ ...p, ready: false, selectedDeckSlot: null })))
          channelRef.current?.send({ type: 'broadcast', event: 'ready-change', payload: { userId, ready: false, deckSlot: null } })
          cleanupArenaSession('arena-lobby').catch(() => {})
        }}
      />
    )
  }

  // === LOBBY VIEW ===
  const readyCount = lobbyPlayers.filter((p) => p.ready).length
  const secretRareCount = (deck: DeckOption) => deck.cards.filter((c) => c.rarity === 'secret_rare').length

  return (
    <div>
      {/* Countdown / Starting overlay */}
      {(countdown !== null || starting) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-4">
            {starting ? (
              <>
                <span className="text-4xl font-black text-white animate-pulse">Starting...</span>
              </>
            ) : (
              <>
                <span className="text-8xl font-black text-white animate-pulse">{countdown}</span>
                <span className="text-lg text-zinc-400">Get ready...</span>
                <button onClick={() => {
                  if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
                  setCountdown(null)
                  setMyReady(false)
                  readyMapRef.current[userId] = false
                  setLobbyPlayers((prev) => prev.map((p) => p.id === userId ? { ...p, ready: false } : p))
                  channelRef.current?.send({ type: 'broadcast', event: 'ready-change', payload: { userId, ready: false, deckSlot: selectedDeck } })
                }} className="rounded-lg border border-zinc-500 px-6 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800">
                  Hold On
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Status */}
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-2xl font-bold">Arena Lobby</h2>
        <div className="flex items-center justify-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-zinc-600'}`} />
          <span className="text-sm text-zinc-400">
            {connected ? `${lobbyPlayers.length} player${lobbyPlayers.length !== 1 ? 's' : ''} connected` : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Player list */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {lobbyPlayers.map((player) => {
          const isMe = player.id === userId
          return (
            <div key={player.id}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                player.ready ? 'border-green-600 bg-green-950/20' : isMe ? 'border-amber-700 bg-amber-950/20' : 'border-zinc-800 bg-zinc-900'
              }`}>
              {player.avatar_url ? (
                <img src={player.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover border-2 border-zinc-700" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 border-2 border-zinc-700 text-lg text-zinc-500">?</div>
              )}
              <span className="text-sm font-medium text-center truncate w-full">
                {player.name}{isMe && <span className="text-zinc-500"> (You)</span>}
              </span>
              {player.ready ? <span className="text-xs font-medium text-green-400">Ready</span> : (
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /><span className="text-[10px] text-zinc-500">Not ready</span></span>
              )}
            </div>
          )
        })}
        {Array.from({ length: Math.max(0, 8 - lobbyPlayers.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-zinc-700 text-zinc-700">?</div>
            <span className="text-xs text-zinc-600">Waiting...</span>
          </div>
        ))}
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
                onClick={() => !myReady && !illegal && setSelectedDeck(isSelected ? null : deck.slot)}
                disabled={myReady}
                className={`rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed ${
                  illegal ? 'border-red-800 opacity-50 cursor-not-allowed'
                  : isSelected ? 'border-red-500 bg-red-950/30' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
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
        {connected && (
          <p className="text-sm text-zinc-500">
            {!selectedDeck ? 'Select a deck to ready up'
              : lobbyPlayers.length < 2 ? 'Need at least 2 players to start'
              : `${readyCount}/${lobbyPlayers.length} ready`}
          </p>
        )}
        {connected && (
          <button onClick={toggleReady}
            disabled={lobbyPlayers.length < 2 || battleStarted || !selectedDeck}
            className={`rounded-lg px-8 py-3 text-sm font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              myReady ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600' : 'bg-red-600 text-white hover:bg-red-500'
            }`}>
            {myReady ? 'Cancel Ready' : 'Ready Up'}
          </button>
        )}
      </div>
    </div>
  )
}
