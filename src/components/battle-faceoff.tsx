'use client'

import { useEffect, useRef, useState } from 'react'
import CompactCard from './compact-card'
import type { FaceOffDetail } from '@/lib/battle-engine'

type Phase = 'enter' | 'power' | 'rolling' | 'merge' | 'result' | 'done'

export default function BattleFaceoff({
  faceOff,
  onComplete,
  large,
  vertical,
}: {
  faceOff: FaceOffDetail
  onComplete: () => void
  large: boolean
  vertical?: boolean
}) {
  const [phase, setPhase] = useState<Phase>('enter')
  const canvas1Ref = useRef<HTMLCanvasElement>(null)
  const canvas2Ref = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const startTimeRef = useRef(0)

  const fo = faceOff

  useEffect(() => {
    setPhase('enter')
    startTimeRef.current = 0

    const timers = [
      setTimeout(() => setPhase('power'), 500),
      setTimeout(() => setPhase('rolling'), 1200),
      setTimeout(() => setPhase('merge'), 2400),
      setTimeout(() => setPhase('result'), 3100),
      setTimeout(() => { setPhase('done'); onComplete() }, 4500),
    ]

    return () => timers.forEach(clearTimeout)
  }, [faceOff])

  // Canvas animation for power, dice rolls, merge, and final
  useEffect(() => {
    if (phase === 'enter' || phase === 'done') {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }

    const startTime = performance.now()
    startTimeRef.current = startTime

    setupCanvas(canvas1Ref.current)
    setupCanvas(canvas2Ref.current)

    const drawSide = (
      canvas: HTMLCanvasElement | null,
      finalRoll: number,
      maxRoll: number,
      baseStar: number,
      effective: number,
      isLarge: boolean,
    ) => {
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const w = canvasW
      const h = canvasH
      ctx.clearRect(0, 0, w, h)

      const fontSize = isLarge ? 24 : 16
      const elapsed = performance.now() - startTime

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      if (phase === 'power') {
        // Show base power: ⭐ 3
        ctx.font = `${fontSize * 0.6}px serif`
        ctx.fillText('⭐', w / 2 - fontSize * 0.8, h / 2)
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`
        ctx.fillStyle = '#d4d4d8'
        ctx.fillText(`${baseStar}`, w / 2 + fontSize * 0.5, h / 2)
      }

      if (phase === 'rolling') {
        if (maxRoll === 0) {
          // Higher power card — just show base power centered, no dice
          ctx.font = `${fontSize * 0.6}px serif`
          ctx.fillText('⭐', w / 2 - fontSize * 0.9, h / 2)
          ctx.font = `bold ${fontSize}px system-ui, sans-serif`
          ctx.fillStyle = '#e4e4e7'
          ctx.fillText(`${baseStar}`, w / 2 + fontSize * 0.5, h / 2)
        } else {
          const rollDuration = 1200
          const progress = Math.min(elapsed / rollDuration, 1)
          const speed = 1 - Math.pow(progress, 2.5)

          // Base power (static, left side)
          ctx.font = `${fontSize * 0.6}px serif`
          ctx.fillText('⭐', w * 0.2, h / 2)
          ctx.font = `bold ${fontSize}px system-ui, sans-serif`
          ctx.fillStyle = '#a1a1aa'
          ctx.fillText(`${baseStar}`, w * 0.2 + fontSize * 0.7, h / 2)

          // Plus sign
          ctx.fillStyle = '#71717a'
          ctx.font = `bold ${fontSize * 0.6}px system-ui, sans-serif`
          ctx.fillText('+', w * 0.48, h / 2)

          // Rolling dice number (right side)
          let displayRoll: number
          if (progress >= 0.95) {
            displayRoll = finalRoll
          } else if (speed > 0.02) {
            displayRoll = Math.floor(Math.random() * (maxRoll + 1))
          } else {
            displayRoll = finalRoll
          }

          const shakeX = speed * (Math.random() - 0.5) * 3
          const shakeY = speed * (Math.random() - 0.5) * 3

          if (speed > 0.3) {
            ctx.shadowColor = '#fbbf24'
            ctx.shadowBlur = 8 * speed
          } else {
            ctx.shadowBlur = 0
          }

          ctx.font = `bold ${fontSize}px system-ui, sans-serif`
          ctx.fillStyle = progress >= 0.95 ? (displayRoll > 0 ? '#fbbf24' : '#71717a') : '#fde68a'
          ctx.fillText(`${displayRoll}`, w * 0.65 + shakeX, h / 2 + shakeY)

          ctx.shadowBlur = 0
          ctx.font = `${fontSize * 0.45}px serif`
          ctx.fillText('🎲', w * 0.82 + shakeX, h / 2 + shakeY)
        }
      }

      if (phase === 'merge') {
        if (maxRoll === 0) {
          // No dice was rolled — just show final number
          ctx.font = `${fontSize * 0.6}px serif`
          ctx.fillText('⭐', w / 2 - fontSize * 0.9, h / 2)
          ctx.font = `bold ${fontSize}px system-ui, sans-serif`
          ctx.fillStyle = '#e4e4e7'
          ctx.fillText(`${effective}`, w / 2 + fontSize * 0.5, h / 2)
        } else {
          const mergeProgress = Math.min(elapsed / 600, 1)
          const eased = 1 - Math.pow(1 - mergeProgress, 3)

          const breakdownAlpha = 1 - eased
          const totalAlpha = eased

          if (breakdownAlpha > 0.05) {
            ctx.globalAlpha = breakdownAlpha
            ctx.font = `${fontSize * 0.6}px serif`
            ctx.fillText('⭐', w * 0.2, h / 2)
            ctx.font = `bold ${fontSize}px system-ui, sans-serif`
            ctx.fillStyle = '#a1a1aa'
            ctx.fillText(`${baseStar}`, w * 0.2 + fontSize * 0.7, h / 2)
            ctx.fillStyle = '#71717a'
            ctx.font = `bold ${fontSize * 0.6}px system-ui, sans-serif`
            ctx.fillText('+', w * 0.48, h / 2)
            ctx.font = `bold ${fontSize}px system-ui, sans-serif`
            ctx.fillStyle = finalRoll > 0 ? '#fbbf24' : '#71717a'
            ctx.fillText(`${finalRoll}`, w * 0.65, h / 2)
            ctx.globalAlpha = 1
          }

          ctx.globalAlpha = totalAlpha
          if (finalRoll > 0) {
            ctx.shadowColor = '#fbbf24'
            ctx.shadowBlur = 6 * (1 - eased)
          }
          ctx.font = `${fontSize * 0.6}px serif`
          ctx.fillText('⭐', w / 2 - fontSize * 0.9, h / 2)
          ctx.font = `bold ${fontSize}px system-ui, sans-serif`
          ctx.fillStyle = '#e4e4e7'
          ctx.fillText(`${effective}`, w / 2 + fontSize * 0.5, h / 2)
          ctx.shadowBlur = 0
          ctx.globalAlpha = 1
        }
      }

      if (phase === 'result') {
        // Final number, big and clear
        ctx.font = `${fontSize * 0.6}px serif`
        ctx.fillText('⭐', w / 2 - fontSize * 0.9, h / 2)
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`
        ctx.fillStyle = '#e4e4e7'
        ctx.fillText(`${effective}`, w / 2 + fontSize * 0.5, h / 2)
      }
    }

    const maxRoll1 = fo.star1 < fo.star2 ? fo.star2 - fo.star1 + 1 : fo.star1 === fo.star2 ? 1 : 0
    const maxRoll2 = fo.star2 < fo.star1 ? fo.star1 - fo.star2 + 1 : fo.star1 === fo.star2 ? 1 : 0

    const animate = () => {
      drawSide(canvas1Ref.current, fo.roll1, maxRoll1, fo.star1, fo.effective1, large)
      drawSide(canvas2Ref.current, fo.roll2, maxRoll2, fo.star2, fo.effective2, large)

      if (phase === 'power' || phase === 'rolling' || phase === 'merge' || phase === 'result') {
        animRef.current = requestAnimationFrame(animate)
      }
    }

    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [phase, fo, large])

  const p1Won = fo.damage2 > 0
  const p2Won = fo.damage1 > 0
  const tie = fo.damage1 === 0 && fo.damage2 === 0

  const cardSize = large ? 'w-20 sm:w-24' : 'w-16'
  const canvasW = large ? 180 : 120
  const canvasH = large ? 44 : 30
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  // Setup canvas for high DPI
  const setupCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return
    if (canvas.dataset.scaled === '1') return
    canvas.width = canvasW * dpr
    canvas.height = canvasH * dpr
    canvas.style.width = `${canvasW}px`
    canvas.style.height = `${canvasH}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
    canvas.dataset.scaled = '1'
  }

  const enterAnim1 = vertical ? 'animate-[slideFromTop_0.4s_ease-out]' : 'animate-[slideFromLeft_0.4s_ease-out]'
  const enterAnim2 = vertical ? 'animate-[slideFromBottom_0.4s_ease-out]' : 'animate-[slideFromRight_0.4s_ease-out]'
  const knockP1 = vertical ? 'opacity-40 scale-90 -translate-y-3' : 'opacity-40 scale-90 translate-x-3'
  const knockP2 = vertical ? 'opacity-40 scale-90 translate-y-3' : 'opacity-40 scale-90 -translate-x-3'

  return (
    <div className={`flex items-center justify-center ${vertical ? 'flex-col gap-4' : 'gap-3 sm:gap-6'}`}>
      {/* Player 1 (opponent on top in vertical) */}
      <div className={`flex flex-col items-center gap-1 transition-all duration-500 ${
        phase === 'enter' ? enterAnim1 : ''
      } ${phase === 'result' || phase === 'done' ? (p2Won ? knockP1 : p1Won ? 'scale-105' : '') : ''}`}>
        <div className={cardSize}><CompactCard card={fo.card1} /></div>

        <canvas ref={canvas1Ref} className={`block transition-opacity duration-300 ${phase === 'enter' ? 'opacity-0' : 'opacity-100'}`}
          style={{ width: canvasW, height: canvasH }} />

        {(phase === 'result' || phase === 'done') && (
          <div className="animate-[fadeIn_0.3s_ease-out]">
            {p2Won && <span className={`${large ? 'text-lg' : 'text-sm'} font-black text-red-400`}>-{fo.damage1} HP</span>}
            {p1Won && <span className={`${large ? 'text-sm' : 'text-xs'} font-bold text-green-400`}>WIN</span>}
            {tie && <span className="text-xs text-zinc-500">TIE</span>}
          </div>
        )}
      </div>

      {/* VS */}
      <span className={`${large ? 'text-xl' : 'text-sm'} font-black text-zinc-700`}>⚔️</span>

      {/* Player 2 (you on bottom in vertical) */}
      <div className={`flex flex-col items-center gap-1 transition-all duration-500 ${
        phase === 'enter' ? enterAnim2 : ''
      } ${phase === 'result' || phase === 'done' ? (p1Won ? knockP2 : p2Won ? 'scale-105' : '') : ''}`}>
        <div className={cardSize}><CompactCard card={fo.card2} /></div>

        <canvas ref={canvas2Ref} className={`block transition-opacity duration-300 ${phase === 'enter' ? 'opacity-0' : 'opacity-100'}`}
          style={{ width: canvasW, height: canvasH }} />

        {(phase === 'result' || phase === 'done') && (
          <div className="animate-[fadeIn_0.3s_ease-out]">
            {p1Won && <span className={`${large ? 'text-lg' : 'text-sm'} font-black text-red-400`}>-{fo.damage2} HP</span>}
            {p2Won && <span className={`${large ? 'text-sm' : 'text-xs'} font-bold text-green-400`}>WIN</span>}
            {tie && <span className="text-xs text-zinc-500">TIE</span>}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideFromLeft { from { transform: translateX(-40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideFromRight { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideFromTop { from { transform: translateY(-40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideFromBottom { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  )
}
