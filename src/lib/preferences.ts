import { useCallback, useEffect, useState } from 'react'

/** How fast the pack-reveal "Auto" button flips through cards. */
export type AutoRevealSpeed = 'slow' | 'normal' | 'fast'

const AUTO_REVEAL_SPEEDS: readonly AutoRevealSpeed[] = ['slow', 'normal', 'fast']

/** Per-step delay (ms) for the pack-reveal Auto mode, keyed by speed preference. */
export const AUTO_REVEAL_DELAY_MS: Record<AutoRevealSpeed, number> = {
  slow: 1400,
  normal: 800,
  fast: 400,
}

/** User-level display preferences, persisted per-device in localStorage. */
export type Preferences = {
  /** Show smaller, denser cards when viewing the collection. */
  compactCards: boolean
  /** Pace of the pack-reveal Auto button. */
  autoRevealSpeed: AutoRevealSpeed
}

export const DEFAULT_PREFERENCES: Preferences = {
  compactCards: false,
  autoRevealSpeed: 'normal',
}

export const PREFERENCES_STORAGE_KEY = 'sfl-preferences'

/** Parse stored JSON into a fully-populated Preferences, tolerating null,
 *  malformed JSON, missing keys, and wrong types by falling back to defaults. */
export function parsePreferences(raw: string | null): Preferences {
  if (!raw) return { ...DEFAULT_PREFERENCES }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PREFERENCES }
    const obj = parsed as Record<string, unknown>
    return {
      compactCards:
        typeof obj.compactCards === 'boolean' ? obj.compactCards : DEFAULT_PREFERENCES.compactCards,
      autoRevealSpeed: AUTO_REVEAL_SPEEDS.includes(obj.autoRevealSpeed as AutoRevealSpeed)
        ? (obj.autoRevealSpeed as AutoRevealSpeed)
        : DEFAULT_PREFERENCES.autoRevealSpeed,
    }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function serializePreferences(prefs: Preferences): string {
  return JSON.stringify(prefs)
}

export function loadPreferences(): Preferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES }
  return parsePreferences(window.localStorage.getItem(PREFERENCES_STORAGE_KEY))
}

export function savePreferences(prefs: Preferences): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(prefs))
}

/**
 * React hook for reading/updating preferences. Starts from defaults (matching
 * SSR to avoid hydration mismatch), hydrates from localStorage after mount, and
 * stays in sync across tabs via the `storage` event. `loaded` is false until the
 * stored value has been read.
 */
export function usePreferences(): {
  preferences: Preferences
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  loaded: boolean
} {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setPreferences(loadPreferences())
    setLoaded(true)
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFERENCES_STORAGE_KEY) setPreferences(loadPreferences())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setPreference = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPreferences((prev) => {
        const next = { ...prev, [key]: value }
        savePreferences(next)
        return next
      })
    },
    []
  )

  return { preferences, setPreference, loaded }
}
