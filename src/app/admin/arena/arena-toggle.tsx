'use client'

import { useState } from 'react'
import { toggleArena } from './arena-actions'

export default function ArenaToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDisable, setConfirmDisable] = useState(false)

  const handleToggle = async () => {
    if (enabled && !confirmDisable) {
      setConfirmDisable(true)
      return
    }

    setLoading(true)
    setError(null)
    setConfirmDisable(false)

    const newState = !enabled
    const result = await toggleArena(newState)

    if (result.success) {
      setEnabled(newState)
    } else {
      setError(result.error || 'Failed to toggle arena')
    }
    setLoading(false)
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold">Feature Settings</h2>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Arena</h3>
            <p className="mt-1 text-sm text-zinc-400">
              {enabled
                ? 'Players can create and join lobbies.'
                : 'Disabled. All lobbies and sessions have been destroyed.'}
            </p>
          </div>

          <div className={`flex h-10 items-center rounded-full px-4 text-sm font-bold ${enabled ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
            {enabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>

        {confirmDisable && (
          <div className="mt-4 rounded-lg border border-red-800 bg-red-950/30 p-4">
            <p className="text-sm font-medium text-red-400">Are you sure?</p>
            <p className="mt-1 text-xs text-zinc-400">
              This will immediately destroy all active lobbies and sessions. Players currently in a game will be kicked out.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleToggle}
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {loading ? 'Disabling...' : 'Yes, Disable Arena'}
              </button>
              <button
                onClick={() => setConfirmDisable(false)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!confirmDisable && (
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`mt-4 rounded-lg px-6 py-2 text-sm font-bold text-white disabled:opacity-50 ${
              enabled
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            {loading
              ? (enabled ? 'Disabling...' : 'Enabling...')
              : (enabled ? 'Disable Arena' : 'Enable Arena')}
          </button>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}
      </div>
    </div>
  )
}
