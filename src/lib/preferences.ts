import { useCallback, useEffect, useRef, useState } from 'react'

/** How fast the pack-reveal "Auto" button flips through cards. */
export type AutoRevealSpeed = 'slow' | 'normal' | 'fast' | 'faster' | 'fastest'

const AUTO_REVEAL_SPEEDS: readonly AutoRevealSpeed[] = ['slow', 'normal', 'fast', 'faster', 'fastest']

/** How holo finishes appear on collection tiles. */
export type CollectionHoloDisplay = 'rarest' | 'none'

const COLLECTION_HOLO_DISPLAYS: readonly CollectionHoloDisplay[] = ['rarest', 'none']

/** Card-effect quality tier. 'auto' detects software-rendering (no-GPU)
 *  browsers and drops to the cheap static look; 'full'/'reduced' force it. */
export type HoloEffects = 'auto' | 'full' | 'reduced'

const HOLO_EFFECTS: readonly HoloEffects[] = ['auto', 'full', 'reduced']

/** Per-step delay (ms) for the pack-reveal Auto mode, keyed by speed preference. */
export const AUTO_REVEAL_DELAY_MS: Record<AutoRevealSpeed, number> = {
  slow: 1400,
  normal: 800,
  fast: 400,
  faster: 200,
  fastest: 80,
}

/** User-level display preferences, persisted per-device in localStorage. */
export type Preferences = {
  /** Show smaller, denser cards when viewing the collection. */
  compactCards: boolean
  /** Pace of the pack-reveal Auto button. */
  autoRevealSpeed: AutoRevealSpeed
  /** Animate holo finishes at rest. When off, holos only animate on hover.
   *  Defaults off (perf) — opt in via preferences. */
  passiveHoloAnimations: boolean
  /** Show the holo glow aura without needing to hover. */
  autoHoloAura: boolean
  /** How holo finishes show on collection tiles: the rarest finish you own of
   *  each card, or plain (no holo). Per-edition counts show regardless. */
  collectionHoloDisplay: CollectionHoloDisplay
  /** Card-effect quality. 'auto' = downgrade on no-GPU browsers automatically. */
  holoEffects: HoloEffects
}

export const DEFAULT_PREFERENCES: Preferences = {
  compactCards: false,
  autoRevealSpeed: 'normal',
  passiveHoloAnimations: false,
  autoHoloAura: false,
  collectionHoloDisplay: 'rarest',
  holoEffects: 'auto',
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
      collectionHoloDisplay: COLLECTION_HOLO_DISPLAYS.includes(obj.collectionHoloDisplay as CollectionHoloDisplay)
        ? (obj.collectionHoloDisplay as CollectionHoloDisplay)
        : DEFAULT_PREFERENCES.collectionHoloDisplay,
      holoEffects: HOLO_EFFECTS.includes(obj.holoEffects as HoloEffects)
        ? (obj.holoEffects as HoloEffects)
        : DEFAULT_PREFERENCES.holoEffects,
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
  // Passive holo animations now default off everywhere (perf); an explicit
  // stored value is honoured by parsePreferences, otherwise it falls to false.
  return parsePreferences(raw)
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
  // Latest committed value, so setPreference can derive the next state without a
  // functional updater (which would run — and broadcast — during render).
  const prefsRef = useRef(preferences)
  prefsRef.current = preferences

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
      // Runs in an event handler (onClick), so persisting + broadcasting here is
      // safe — savePreferences synchronously notifies other usePreferences
      // consumers, which must not happen inside a render-phase state updater.
      const next = { ...prefsRef.current, [key]: value }
      setPreferences(next)
      savePreferences(next)
    },
    []
  )

  return { preferences, setPreference, loaded }
}
