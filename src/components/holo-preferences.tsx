'use client'

import { useEffect } from 'react'
import { usePreferences } from '@/lib/preferences'

/**
 * True when the browser is very likely rendering on the CPU (no hardware
 * acceleration) or has explicitly asked for reduced motion — the cases where
 * the heavy holo effects (animated blur/blend) lag. Best-effort heuristic.
 */
function isLowPerfRenderer(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return true // no WebGL at all → almost certainly software/limited
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    if (dbg) {
      const r = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toLowerCase()
      // Chrome's software fallback, Linux software GL, Windows software GDI.
      if (/swiftshader|llvmpipe|software|microsoft basic|basic render/.test(r)) return true
    }
  } catch { /* ignore — treat as capable */ }
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (typeof mem === 'number' && mem > 0 && mem <= 1) return true
  return false
}

/**
 * Reflects holo display preferences onto <html> data attributes so the holo CSS
 * can respond globally (no per-card wiring):
 *   data-holo-passive="off" → pause passive holo animations (resume on hover)
 *   data-holo-aura="on"     → show the holo aura without hovering
 *   data-holo-perf="low"    → drop heavy effects to the cheap static look
 */
export default function HoloPreferences() {
  const { preferences, loaded } = usePreferences()

  useEffect(() => {
    if (!loaded) return
    const el = document.documentElement
    el.dataset.holoPassive = preferences.passiveHoloAnimations ? 'on' : 'off'
    el.dataset.holoAura = preferences.autoHoloAura ? 'on' : 'off'
    const low =
      preferences.holoEffects === 'reduced' ? true
      : preferences.holoEffects === 'full' ? false
      : isLowPerfRenderer() // 'auto'
    el.dataset.holoPerf = low ? 'low' : 'high'
  }, [loaded, preferences.passiveHoloAnimations, preferences.autoHoloAura, preferences.holoEffects])

  return null
}
