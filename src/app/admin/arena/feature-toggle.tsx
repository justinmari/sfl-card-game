'use client'

import { useState } from 'react'
import { toggleSuggestions } from './arena-actions'

const toggleFns: Record<string, (enable: boolean) => Promise<{ success: boolean; error?: string }>> = {
  suggestions: toggleSuggestions,
}

export default function FeatureToggle({
  featureKey,
  label,
  enabledDescription,
  disabledDescription,
  initialEnabled,
}: {
  featureKey: string
  label: string
  enabledDescription: string
  disabledDescription: string
  initialEnabled: boolean
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async () => {
    setLoading(true)
    setError(null)
    const fn = toggleFns[featureKey]
    if (!fn) { setError('Unknown feature'); setLoading(false); return }
    const result = await fn(!enabled)
    if (result.success) {
      setEnabled(!enabled)
    } else {
      setError(result.error || 'Failed to toggle')
    }
    setLoading(false)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{label}</h3>
          <p className="mt-1 text-sm text-zinc-400">
            {enabled ? enabledDescription : disabledDescription}
          </p>
        </div>
        <div className={`flex h-10 items-center rounded-full px-4 text-sm font-bold ${enabled ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
          {enabled ? 'Enabled' : 'Disabled'}
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`mt-4 rounded-lg px-6 py-2 text-sm font-bold text-white disabled:opacity-50 ${
          enabled ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'
        }`}
      >
        {loading
          ? (enabled ? 'Disabling...' : 'Enabling...')
          : (enabled ? `Disable ${label}` : `Enable ${label}`)}
      </button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  )
}
