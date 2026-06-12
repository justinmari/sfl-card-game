'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { listLobbies, createLobby, joinLobby, leaveLobby, type LobbyInfo } from './lobby-actions'

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

  const waitingLobbies = lobbies.filter((l) => l.status === 'waiting')
  const activeLobbies = lobbies.filter((l) => l.status === 'active')

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-2xl font-bold">Arena</h2>
        <p className="text-sm text-zinc-400">Create or join a lobby to battle</p>
      </div>

      {/* How to Play + Edit Decks */}
      <div className="mb-8 flex gap-4">
        <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-400">
          <p className="mb-2 text-sm font-medium text-white">How to Play</p>
          <div className="space-y-1">
            <p><span className="text-white">1.</span> Build a 5-card deck in Decks</p>
            <p><span className="text-white">2.</span> Create or join a lobby</p>
            <p><span className="text-white">3.</span> Host starts the game</p>
            <p><span className="text-white">4.</span> Cards face off — higher power wins</p>
            <p><span className="text-white">5.</span> Last player standing wins!</p>
          </div>
        </div>
        <a href="/decks" className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-6 transition-colors hover:border-zinc-600">
          <span className="text-2xl">📋</span>
          <span className="text-xs font-medium text-white">Edit Decks</span>
        </a>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300 text-center">{error}</div>
      )}

      {/* Reconnect banner */}
      {myLobby && (
        <div className="mb-6 rounded-xl border border-amber-800 bg-amber-950/20 p-4">
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
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create lobby */}
      {!myLobby && <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="mb-3 text-sm font-medium text-zinc-400">Create a Lobby</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={lobbyName}
            onChange={(e) => setLobbyName(e.target.value)}
            placeholder={`${userName}'s Lobby`}
            maxLength={30}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
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
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
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
            <div key={lobby.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">{lobby.name}</h4>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                    <span>{lobby.player_count}/{lobby.max_players} players</span>
                    <span className="text-green-400">Waiting</span>
                  </div>
                  {lobby.players.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {lobby.players.map((p) => (
                        <span key={p.user_id} className={`rounded-full px-2 py-0.5 text-[10px] ${p.user_id === lobby.host_id ? 'bg-amber-900/50 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>
                          {p.user_name}{p.user_id === lobby.host_id ? ' (Host)' : ''}{p.is_ready ? ' ✓' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleJoin(lobby.id)}
                  disabled={!!myLobby || joining === lobby.id || lobby.player_count >= lobby.max_players}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-30"
                >
                  {joining === lobby.id ? 'Joining...' : 'Join'}
                </button>
              </div>
            </div>
          ))}

          {activeLobbies.map((lobby) => (
            <div key={lobby.id} className="rounded-xl border border-amber-800/50 bg-zinc-900 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">{lobby.name}</h4>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                    <span>{lobby.player_count} players</span>
                    <span className="text-amber-400">In Game</span>
                  </div>
                </div>
                <button
                  onClick={() => handleJoin(lobby.id)}
                  disabled={!!myLobby || joining === lobby.id}
                  className="rounded-lg border border-zinc-700 px-5 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
                >
                  {joining === lobby.id ? 'Joining...' : 'Spectate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
