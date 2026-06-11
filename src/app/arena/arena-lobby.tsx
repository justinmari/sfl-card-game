'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

type Player = {
  id: string
  name: string
  avatar_url: string | null
  joined_at: number
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase.channel('arena-lobby', {
      config: {
        presence: {
          key: userId,
        },
      },
    })

    channel
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setMessages((prev) => [...prev.slice(-50), payload as ChatMessage])
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
            joined_at: Date.now(),
          })
          setConnected(true)
        }
      })

    channelRef.current = channel

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [userId, userName, avatarUrl])

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

  return (
    <div>
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
        {players.map((player) => (
          <div
            key={player.id}
            className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
              player.id === userId
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
              {player.id === userId && <span className="text-zinc-500"> (You)</span>}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-zinc-500">Online</span>
            </span>
          </div>
        ))}

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
        <p className="text-sm text-zinc-500">
          {players.length < 2
            ? 'Need at least 2 players to start'
            : `${players.length} players ready!`}
        </p>
        <button
          disabled={players.length < 2}
          className="rounded-lg bg-red-600 px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Start Battle ({players.length}/8)
        </button>
      </div>
    </div>
  )
}
