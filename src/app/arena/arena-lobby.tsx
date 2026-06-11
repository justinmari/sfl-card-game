'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

type Player = {
  id: string
  name: string
  avatar_url: string | null
  joined_at: number
  ready: boolean
}

type ChatMessage = {
  id: string
  userId: string
  userName: string
  text: string
  timestamp: number
}

export default function ArenaLobby({
  userId,
  userName,
  avatarUrl,
}: {
  userId: string
  userName: string
  avatarUrl: string | null
}) {
  const [players, setPlayers] = useState<Player[]>([])
  const [connected, setConnected] = useState(false)
  const [myReady, setMyReady] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const joinedAtRef = useRef(Date.now())

  // Use broadcast for ready state instead of presence
  const readyMapRef = useRef<Record<string, boolean>>({})

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
        // Force re-render
        setPlayers((prev) => prev.map((p) =>
          p.id === payload.userId ? { ...p, ready: payload.ready } : p
        ))
      })
      .on('broadcast', { event: 'game-start' }, () => {
        setGameStarted(true)
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string; avatar_url: string | null; joined_at: number }>()
        const playerList: Player[] = []
        for (const [id, presences] of Object.entries(state)) {
          if (presences.length > 0) {
            const p = presences[0]
            playerList.push({
              id,
              name: p.name,
              avatar_url: p.avatar_url,
              joined_at: p.joined_at,
              ready: readyMapRef.current[id] || false,
            })
          }
        }
        playerList.sort((a, b) => a.joined_at - b.joined_at)
        setPlayers(playerList)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            name: userName,
            avatar_url: avatarUrl,
            joined_at: joinedAtRef.current,
          })
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

  // Watch for all ready
  useEffect(() => {
    if (gameStarted || countdown !== null) return
    if (players.length >= 2 && players.every((p) => p.ready)) {
      setCountdown(5)
      let count = 5
      countdownRef.current = setInterval(() => {
        count--
        if (count <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          countdownRef.current = null
          setCountdown(null)
          setGameStarted(true)
          channelRef.current?.send({ type: 'broadcast', event: 'game-start', payload: {} })
        } else {
          setCountdown(count)
        }
      }, 1000)
    }
  }, [players, gameStarted, countdown])

  // Cancel countdown if someone unreadies
  useEffect(() => {
    if (countdown !== null && players.length >= 2 && !players.every((p) => p.ready)) {
      if (countdownRef.current) clearInterval(countdownRef.current)
      countdownRef.current = null
      setCountdown(null)
    }
  }, [players, countdown])

  const toggleReady = () => {
    const newReady = !myReady
    setMyReady(newReady)
    readyMapRef.current[userId] = newReady
    // Update local players immediately
    setPlayers((prev) => prev.map((p) =>
      p.id === userId ? { ...p, ready: newReady } : p
    ))
    // Broadcast to others
    channelRef.current?.send({
      type: 'broadcast',
      event: 'ready-change',
      payload: { userId, ready: newReady },
    })
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !channelRef.current) return
    const msg: ChatMessage = {
      id: `${userId}-${Date.now()}`,
      userId,
      userName,
      text: chatInput.trim(),
      timestamp: Date.now(),
    }
    channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg })
    setMessages((prev) => [...prev.slice(-50), msg])
    setChatInput('')
  }

  const readyCount = players.filter((p) => p.ready).length

  return (
    <div>
      {/* Game started toast */}
      {gameStarted && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-red-700 bg-zinc-900 px-5 py-3 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <div>
              <p className="text-sm font-semibold text-white">Battle Started!</p>
              <p className="text-xs text-red-400">Prepare your cards...</p>
            </div>
          </div>
        </div>
      )}

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <span className="text-8xl font-black text-white animate-pulse">{countdown}</span>
            <span className="text-lg text-zinc-400">Get ready...</span>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-2xl font-bold">Arena Lobby</h2>
        <div className="flex items-center justify-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-zinc-600'}`} />
          <span className="text-sm text-zinc-400">
            {connected ? `${players.length} player${players.length !== 1 ? 's' : ''} connected` : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Player list */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {players.map((player) => {
          const isMe = player.id === userId
          return (
            <div
              key={player.id}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                player.ready
                  ? 'border-green-600 bg-green-950/20'
                  : isMe
                    ? 'border-amber-700 bg-amber-950/20'
                    : 'border-zinc-800 bg-zinc-900'
              }`}
            >
              {player.avatar_url ? (
                <img src={player.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover border-2 border-zinc-700" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 border-2 border-zinc-700 text-lg text-zinc-500">?</div>
              )}
              <span className="text-sm font-medium text-center truncate w-full">
                {player.name}
                {isMe && <span className="text-zinc-500"> (You)</span>}
              </span>
              {player.ready ? (
                <span className="text-xs font-medium text-green-400">✅ Ready</span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                  <span className="text-[10px] text-zinc-500">Not ready</span>
                </span>
              )}
            </div>
          )
        })}

        {/* Empty slots */}
        {Array.from({ length: Math.max(0, 8 - players.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 p-4"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-zinc-700 text-zinc-700">
              ?
            </div>
            <span className="text-xs text-zinc-600">Waiting...</span>
          </div>
        ))}
      </div>

      {/* Chat */}
      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="h-48 overflow-y-auto p-3">
          {messages.length === 0 && (
            <p className="py-8 text-center text-xs text-zinc-600">No messages yet</p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="mb-1.5">
              <span className={`text-xs font-medium ${msg.userId === userId ? 'text-amber-400' : 'text-zinc-300'}`}>
                {msg.userName}
              </span>
              <span className="ml-2 text-xs text-zinc-400">{msg.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={sendMessage} className="flex border-t border-zinc-800">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message..."
            maxLength={200}
            className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!chatInput.trim()}
            className="px-4 text-sm font-medium text-zinc-400 hover:text-white disabled:opacity-30"
          >
            Send
          </button>
        </form>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        {connected && (
          <p className="text-sm text-zinc-500">
            {players.length < 2
              ? 'Need at least 2 players to start'
              : `${readyCount}/${players.length} ready`}
          </p>
        )}
        {connected && (
          <button
            onClick={toggleReady}
            disabled={players.length < 2 || gameStarted}
            className={`rounded-lg px-8 py-3 text-sm font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              myReady
                ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                : 'bg-red-600 text-white hover:bg-red-500'
            }`}
          >
            {myReady ? 'Cancel Ready' : 'Ready Up'}
          </button>
        )}
      </div>
    </div>
  )
}
