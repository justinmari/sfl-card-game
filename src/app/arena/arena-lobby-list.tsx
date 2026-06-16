'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutGrid } from 'lucide-react'
import { listLobbies, createLobby, joinLobby, leaveLobby, closeStaleLobby, type LobbyInfo } from './lobby-actions'
import { useArenaStatus } from '@/hooks/use-arena-status'

type MyLobbyInfo = {
  lobbyId: string
  status: string
  hostId: string
  name: string
} | null

export default function ArenaLobbyList({
  userId,
  userName,
  avatarUrl,
  myLobby: initialMyLobby,
}: {
  userId: string
  userName: string
  avatarUrl: string | null
  myLobby?: MyLobbyInfo
}) {
  const [myLobby, setMyLobby] = useState<MyLobbyInfo>(initialMyLobby ?? null)
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [lobbyName, setLobbyName] = useState('')
  const [joining, setJoining] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshCooldown, setRefreshCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()
  useArenaStatus()

  const fetchLobbies = async () => {
    setLoading(true)
    const data = await listLobbies()
    setLobbies(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchLobbies()
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }
  }, [])

  const handleRefresh = () => {
    if (refreshCooldown > 0) return
    fetchLobbies()
    setRefreshCooldown(10)
    cooldownRef.current = setInterval(() => {
      setRefreshCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) { clearInterval(cooldownRef.current); cooldownRef.current = null }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    const result = await createLobby(lobbyName.trim() || `${userName}'s Lobby`)
    if (result && 'id' in result) {
      // Join our own lobby
      await joinLobby(result.id, userName, avatarUrl)
      router.push(`/arena/lobby/${result.id}`)
    } else if (result && 'error' in result) {
      setError(result.error)
      setCreating(false)
    } else {
      setError('Failed to create lobby')
      setCreating(false)
    }
  }

  const handleJoin = async (lobbyId: string) => {
    setJoining(lobbyId)
    setError(null)
    const result = await joinLobby(lobbyId, userName, avatarUrl)
    if (result && 'success' in result) {
      router.push(`/arena/lobby/${lobbyId}`)
    } else if (result && 'error' in result) {
      setError(result.error)
      setJoining(null)
    } else {
      setError('Failed to join lobby')
      setJoining(null)
    }
  }

  const isStale = (lobby: LobbyInfo) => Date.now() - new Date(lobby.created_at).getTime() > 60 * 60 * 1000

  const handleCloseStaleLobby = async (lobbyId: string) => {
    const result = await closeStaleLobby(lobbyId)
    if (result.closed) fetchLobbies()
    else setError('Cannot close this lobby — it has recent activity')
  }

  const waitingLobbies = lobbies.filter((l) => l.status === 'waiting')
  const activeLobbies = lobbies.filter((l) => l.status === 'active')

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="font-display mb-2 text-2xl font-bold tracking-tight">
          <span className="text-arcade-gradient">Arena</span>
        </h2>
        <p className="text-sm text-zinc-400">Create or join a lobby to battle</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300 text-center">{error}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
      {/* Actions column */}
      <div className="lg:col-span-2">

      {/* Reconnect banner */}
      {myLobby && (
        <div className="mb-6 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-amber-400">You&apos;re in a lobby</h4>
              <p className="mt-1 text-xs text-zinc-400">
                <span className="text-white font-medium">{myLobby.name}</span>
                <span className="ml-2 text-zinc-500">({myLobby.status === 'active' ? 'In Game' : 'Waiting'})</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/arena/lobby/${myLobby.lobbyId}`)}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-500"
              >
                Rejoin
              </button>
              <button
                onClick={async () => {
                  await leaveLobby(myLobby.lobbyId)
                  setMyLobby(null)
                  fetchLobbies()
                }}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create lobby */}
      {!myLobby && <div className="surface mb-8 rounded-xl p-5">
        <h3 className="mb-3 text-sm font-medium text-zinc-400">Create a Lobby</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={lobbyName}
            onChange={(e) => setLobbyName(e.target.value)}
            placeholder={`${userName}'s Lobby`}
            maxLength={30}
            className="input-arcade flex-1 px-4 py-2 text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="btn-arena rounded-lg px-6 py-2 text-sm font-bold"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>}

      {/* Lobby list */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400">Open Lobbies</h3>
        <button
          onClick={handleRefresh}
          disabled={refreshCooldown > 0}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {refreshCooldown > 0 ? `Refresh (${refreshCooldown}s)` : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-zinc-500 animate-pulse">Loading lobbies...</p>
      ) : waitingLobbies.length === 0 && activeLobbies.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">No lobbies yet. Create one!</p>
      ) : (
        <div className="space-y-3">
          {waitingLobbies.map((lobby) => (
            <div key={lobby.id} className="surface rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">{lobby.name}</h4>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                    <span>{lobby.player_count}/{lobby.max_players} players</span>
                    <span className="text-green-400">Waiting</span>
                  </div>
                  {lobby.players.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {lobby.players.map((p) => {
                        const isConnected = lobby.connected_ids.length === 0 || lobby.connected_ids.includes(p.user_id)
                        return (
                          <span key={p.user_id} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${p.user_id === lobby.host_id ? 'bg-amber-900/50 text-amber-400' : 'bg-zinc-800 text-zinc-400'} ${!isConnected ? 'opacity-40' : ''}`}>
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-zinc-600'}`} />
                            {p.user_name}{p.user_id === lobby.host_id ? ' ★' : ''}{p.is_ready ? ' ✓' : ''}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {isStale(lobby) && (
                    <button
                      onClick={() => handleCloseStaleLobby(lobby.id)}
                      className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      Close
                    </button>
                  )}
                  <button
                    onClick={() => handleJoin(lobby.id)}
                    disabled={!!myLobby || joining === lobby.id || lobby.player_count >= lobby.max_players}
                    className="btn-arena rounded-lg px-5 py-2 text-sm font-bold disabled:opacity-30"
                  >
                    {joining === lobby.id ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {activeLobbies.map((lobby) => (
            <div key={lobby.id} className="surface rounded-xl p-4 ring-1 ring-amber-500/25">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">{lobby.name}</h4>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                    <span>{lobby.player_count} players</span>
                    <span className="text-amber-400">In Game</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {isStale(lobby) && (
                    <button
                      onClick={() => handleCloseStaleLobby(lobby.id)}
                      className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      Close
                    </button>
                  )}
                  <button
                    onClick={() => handleJoin(lobby.id)}
                    disabled={!!myLobby || joining === lobby.id}
                    className="rounded-lg border border-white/10 px-5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30"
                  >
                    {joining === lobby.id ? 'Joining...' : 'Spectate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Side rail: how to play + edit decks */}
      <div className="space-y-4">
        <div className="surface rounded-xl p-4 text-xs text-zinc-400">
          <p className="mb-2 text-sm font-medium text-white">How to Play</p>
          <div className="space-y-1">
            <p><span className="text-white">1.</span> Build a 5-card deck in Decks</p>
            <p><span className="text-white">2.</span> Create or join a lobby</p>
            <p><span className="text-white">3.</span> Host starts the game</p>
            <p><span className="text-white">4.</span> Cards face off — higher power wins</p>
            <p><span className="text-white">5.</span> Last player standing wins!</p>
          </div>
        </div>
        <a href="/decks" className="tile-arcade tile-red flex items-center justify-center gap-2 rounded-xl px-6 py-4">
          <LayoutGrid className="h-5 w-5 text-red-300" aria-hidden />
          <span className="text-sm font-medium text-white">Edit Decks</span>
        </a>
      </div>
      </div>
    </div>
  )
}
