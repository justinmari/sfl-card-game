'use client'

import { useRef, useState } from 'react'

export type Pack = { id: string; name: string; image_url: string | null; price?: number; created_at?: string }
export type LabCard = { id: string; name: string; image_url: string | null; rarity: string; creature_name?: string | null }

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Booster footprint (px).
export const PW = 240
export const PH = 380

/**
 * Swipe gesture shared by the lab. Returns the live progress (0→1), the swipe
 * direction, and pointer handlers to spread on the stage. A swipe past ~45% —
 * or a quick flick — commits (`done`); otherwise it snaps back.
 */
export function useRip() {
  const [tear, setTear] = useState(0)
  const [dir, setDir] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [done, setDone] = useState(false)
  const drag = useRef({ active: false, startX: 0, lastX: 0, lastT: 0, vel: 0 })

  const reset = () => {
    setTear(0)
    setDone(false)
    setDragging(false)
    drag.current.active = false
  }

  const onDown = (x: number) => {
    if (done) return
    drag.current = { active: true, startX: x, lastX: x, lastT: performance.now(), vel: 0 }
    setDragging(true)
  }
  const onMove = (x: number) => {
    const d = drag.current
    if (!d.active) return
    const dx = x - d.startX
    setDir(dx >= 0 ? 1 : -1)
    setTear(clamp01(Math.abs(dx) / 150))
    const now = performance.now()
    const dt = now - d.lastT
    if (dt > 0) d.vel = (x - d.lastX) / dt
    d.lastX = x
    d.lastT = now
  }
  const onUp = () => {
    const d = drag.current
    if (!d.active) return
    d.active = false
    setDragging(false)
    const flick = Math.abs(d.vel) > 0.5
    if (tear > 0.45 || flick) {
      setTear(1)
      setDone(true)
    } else {
      setTear(0)
    }
  }

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      onDown(e.clientX)
    },
    onPointerMove: (e: React.PointerEvent) => onMove(e.clientX),
    onPointerUp: onUp,
    onPointerCancel: onUp,
  }

  return { tear, dir, dragging, done, setTear, setDone, reset, handlers }
}
