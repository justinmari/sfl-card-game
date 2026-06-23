'use client'

import { useEffect } from 'react'
import { usePreferences } from '@/lib/preferences'

/**
 * Reflects holo display preferences onto <html> data attributes so the holo CSS
 * can respond globally (no per-card wiring):
 *   data-holo-passive="off" → pause passive holo animations (resume on hover)
 *   data-holo-aura="on"     → show the holo aura without hovering
 */
export default function HoloPreferences() {
  const { preferences, loaded } = usePreferences()

  useEffect(() => {
    if (!loaded) return
    const el = document.documentElement
    el.dataset.holoPassive = preferences.passiveHoloAnimations ? 'on' : 'off'
    el.dataset.holoAura = preferences.autoHoloAura ? 'on' : 'off'
  }, [loaded, preferences.passiveHoloAnimations, preferences.autoHoloAura])

  return null
}
