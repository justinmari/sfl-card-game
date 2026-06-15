'use client'

import { usePreferences } from '@/lib/preferences'

export default function PreferencesForm() {
  const { preferences, setPreference, loaded } = usePreferences()

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        These preferences are saved on this device.
      </p>

      <div className="surface flex items-center justify-between gap-4 rounded-xl p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Compact cards</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Show smaller, denser cards when viewing your collection.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={preferences.compactCards}
          aria-label="Compact cards"
          disabled={!loaded}
          onClick={() => setPreference('compactCards', !preferences.compactCards)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            preferences.compactCards ? 'bg-violet-600 shadow-[0_0_10px_-1px_rgba(139,92,246,0.7)]' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              preferences.compactCards ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
