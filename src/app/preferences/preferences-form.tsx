'use client'

import { useEffect, useState } from 'react'
import { usePreferences, isTouchDevice, type AutoRevealSpeed, type CollectionHoloDisplay } from '@/lib/preferences'

const AUTO_REVEAL_OPTIONS: { value: AutoRevealSpeed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
  { value: 'faster', label: 'Faster' },
  { value: 'fastest', label: 'Fastest' },
]

const COLLECTION_HOLO_OPTIONS: { value: CollectionHoloDisplay; label: string }[] = [
  { value: 'rarest', label: 'Rarest holo' },
  { value: 'none', label: 'No holos' },
]

export default function PreferencesForm() {
  const { preferences, setPreference, loaded } = usePreferences()
  const [touch, setTouch] = useState(false)
  useEffect(() => setTouch(isTouchDevice()), [])

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

      <div className="surface rounded-xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">Passive holo animations</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Animate holo (Golden / Diamond / Galaxy) finishes at rest. When off, they only animate while you hover a card.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preferences.passiveHoloAnimations}
            aria-label="Passive holo animations"
            disabled={!loaded}
            onClick={() => setPreference('passiveHoloAnimations', !preferences.passiveHoloAnimations)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              preferences.passiveHoloAnimations ? 'bg-violet-600 shadow-[0_0_10px_-1px_rgba(139,92,246,0.7)]' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                preferences.passiveHoloAnimations ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {touch && preferences.passiveHoloAnimations && (
          <p className="mt-2 text-xs text-amber-400">
            ⚠ On mobile this may degrade performance and battery life.
          </p>
        )}
      </div>

      <div className="surface flex items-center justify-between gap-4 rounded-xl p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Auto-enable holo aura</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Show the glowing aura around holo cards without having to hover them.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={preferences.autoHoloAura}
          aria-label="Auto-enable holo aura"
          disabled={!loaded}
          onClick={() => setPreference('autoHoloAura', !preferences.autoHoloAura)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            preferences.autoHoloAura ? 'bg-violet-600 shadow-[0_0_10px_-1px_rgba(139,92,246,0.7)]' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              preferences.autoHoloAura ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="surface flex items-center justify-between gap-4 rounded-xl p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Auto reveal speed</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            How fast the pack-reveal Auto button flips through cards.
          </p>
        </div>
        <div role="group" aria-label="Auto reveal speed" className="flex flex-shrink-0 rounded-lg bg-zinc-800 p-0.5">
          {AUTO_REVEAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={preferences.autoRevealSpeed === opt.value}
              disabled={!loaded}
              onClick={() => setPreference('autoRevealSpeed', opt.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                preferences.autoRevealSpeed === opt.value
                  ? 'bg-violet-600 text-white shadow-[0_0_10px_-1px_rgba(139,92,246,0.7)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="surface flex items-center justify-between gap-4 rounded-xl p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Collection holos</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Show the rarest holo finish you own on each collection card, or keep them plain. Per-edition counts show either way.
          </p>
        </div>
        <div role="group" aria-label="Collection holos" className="flex flex-shrink-0 rounded-lg bg-zinc-800 p-0.5">
          {COLLECTION_HOLO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={preferences.collectionHoloDisplay === opt.value}
              disabled={!loaded}
              onClick={() => setPreference('collectionHoloDisplay', opt.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                preferences.collectionHoloDisplay === opt.value
                  ? 'bg-violet-600 text-white shadow-[0_0_10px_-1px_rgba(139,92,246,0.7)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
