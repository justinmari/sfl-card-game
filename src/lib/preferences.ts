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
  /** Animate holo finishes at rest. When off, holos only animate on hover.
   *  Defaults to true on desktop, false on touch/mobile (perf). */
  passiveHoloAnimations: boolean
  /** Show the holo glow aura without needing to hover. */
  autoHoloAura: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  compactCards: false,
  autoRevealSpeed: 'normal',
  passiveHoloAnimations: true,
  autoHoloAura: false,
}

/** True on touch/coarse-pointer devices (used for perf-sensitive defaults). */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(hover: none), (pointer: coarse)').matches
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
      passiveHoloAnimations:
        typeof obj.passiveHoloAnimations === 'boolean'
          ? obj.passiveHoloAnimations
          : DEFAULT_PREFERENCES.passiveHoloAnimations,
      autoHoloAura:
        typeof obj.autoHoloAura === 'boolean' ? obj.autoHoloAura : DEFAULT_PREFERENCES.autoHoloAura,
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
  const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY)
  const prefs = parsePreferences(raw)
  // First run on this device (no explicit value stored): default passive holo
  // animations off on touch/mobile, on elsewhere.
  let storedPassive: unknown
  try {
    storedPassive = raw ? (JSON.parse(raw) as Record<string, unknown>).passiveHoloAnimations : undefined
  } catch {
    storedPassive = undefined
  }
  if (typeof storedPassive !== 'boolean') {
    prefs.passiveHoloAnimations = !isTouchDevice()
  }
  return prefs
}

/** Fired in the current tab when preferences change (the native `storage` event
 *  only reaches OTHER tabs, so this keeps same-tab listeners in sync). */
export const PREFERENCES_EVENT = 'sfl-preferences-change'

export function savePreferences(prefs: Preferences): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(prefs))
  window.dispatchEvent(new CustomEvent(PREFERENCES_EVENT))
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
    const sync = () => setPreferences(loadPreferences())
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFERENCES_STORAGE_KEY) sync()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(PREFERENCES_EVENT, sync)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(PREFERENCES_EVENT, sync)
    }
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
