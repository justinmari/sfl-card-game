'use client'

import { useEffect, useRef, useState } from 'react'
import CompactCard from './compact-card'
import type { FaceOffDetail } from '@/lib/battle-engine'

type Phase = 'enter' | 'power' | 'rolling' | 'merge' | 'result' | 'done'

export default function BattleFaceoff({
  faceOff,
  onComplete,
  large,
}: {
  faceOff: FaceOffDetail
  onComplete: () => void
  large: boolean
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
      setTimeout(() => setPhase('rolling'), 1000),
      setTimeout(() => setPhase('merge'), 2200),
      setTimeout(() => setPhase('result'), 2800),
      setTimeout(() => { setPhase('done'); onComplete() }, 4200),
    ]

    return () => timers.forEach(clearTimeout)
  }, [faceOff])

  // Canvas animation for dice rolls
  useEffect(() => {
    if (phase !== 'rolling' && phase !== 'merge') {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }

    const startTime = performance.now()
    startTimeRef.current = startTime
    const rollDuration = phase === 'rolling' ? 1200 : 0

    const drawNumber = (
      canvas: HTMLCanvasElement | null,
      finalRoll: number,
      maxRoll: number,
      baseStar: number,
      isLarge: boolean,
    ) => {
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      const elapsed = performance.now() - startTime
      const fontSize = isLarge ? 28 : 18

      if (phase === 'rolling') {
        // Dice roll: starts fast, slows down, lands on final
        const progress = Math.min(elapsed / rollDuration, 1)
        // Easing: slow down toward end
        const speed = 1 - Math.pow(progress, 2.5)
        const shouldChange = speed > 0.02

        let displayRoll: number
        if (progress >= 0.95) {
          displayRoll = finalRoll
        } else if (shouldChange) {
          displayRoll = Math.floor(Math.random() * (maxRoll + 1))
        } else {
          displayRoll = finalRoll
        }

        // Draw roll number
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Shake effect based on speed
        const shakeX = speed * (Math.random() - 0.5) * 4
        const shakeY = speed * (Math.random() - 0.5) * 4

        // Glow when rolling fast
        if (speed > 0.3) {
          ctx.shadowColor = '#fbbf24'
          ctx.shadowBlur = 10 * speed
        } else {
          ctx.shadowBlur = 0
        }

        ctx.fillStyle = progress >= 0.95 ? (displayRoll > 0 ? '#fbbf24' : '#71717a') : '#fde68a'
        ctx.fillText(`+${displayRoll}`, w / 2 + shakeX, h / 2 + shakeY)

        // Draw dice emoji
        ctx.shadowBlur = 0
        ctx.font = `${fontSize * 0.5}px serif`
        ctx.fillText('🎲', w / 2 + fontSize * 1.2 + shakeX, h / 2 + shakeY)

      } else if (phase === 'merge') {
        // Merge: roll number shrinks and moves up into power, power increases
        const mergeProgress = Math.min(elapsed / 600, 1)
        const eased = 1 - Math.pow(1 - mergeProgress, 3)

        // Final combined number
        const finalTotal = baseStar + finalRoll
        const displayTotal = Math.round(baseStar + finalRoll * eased)

        ctx.font = `bold ${fontSize * 1.2}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Glow on the final number
        if (finalRoll > 0) {
          ctx.shadowColor = '#fbbf24'
          ctx.shadowBlur = 8 * (1 - eased) + 2
        }

        ctx.fillStyle = '#e4e4e7'
        ctx.fillText(`${displayTotal}`, w / 2, h / 2)

        // Star emoji
        ctx.shadowBlur = 0
        ctx.font = `${fontSize * 0.6}px serif`
        ctx.fillText('⭐', w / 2 - fontSize * 1, h / 2)
      }
    }

    const animate = () => {
      drawNumber(canvas1Ref.current, fo.roll1, fo.star1 < fo.star2 ? fo.star2 - fo.star1 + 1 : fo.star1 === fo.star2 ? 1 : 0, fo.star1, large)
      drawNumber(canvas2Ref.current, fo.roll2, fo.star2 < fo.star1 ? fo.star1 - fo.star2 + 1 : fo.star1 === fo.star2 ? 1 : 0, fo.star2, large)

      if (phase === 'rolling' || phase === 'merge') {
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
  const canvasW = large ? 140 : 90
  const canvasH = large ? 40 : 28

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-6">
      {/* Player 1 */}
      <div className={`flex flex-col items-center gap-1 transition-all duration-500 ${
        phase === 'enter' ? 'animate-[slideFromLeft_0.4s_ease-out]' : ''
      } ${phase === 'result' || phase === 'done' ? (p2Won ? 'opacity-40 scale-90 translate-x-3' : p1Won ? 'scale-105' : '') : ''}`}>
        <div className={cardSize}><CompactCard card={fo.card1} /></div>

        {/* Base power */}
        {(phase === 'power') && (
          <span className="text-sm text-zinc-300 animate-[fadeIn_0.3s_ease-out]">⭐ {fo.star1}</span>
        )}

        {/* Canvas for roll + merge */}
        {(phase === 'rolling' || phase === 'merge') && (
          <canvas ref={canvas1Ref} width={canvasW} height={canvasH} className="block" />
        )}

        {/* Final number + result */}
        {(phase === 'result' || phase === 'done') && (
          <div className="flex flex-col items-center animate-[fadeIn_0.3s_ease-out]">
            <span className="text-sm font-bold text-zinc-200">⭐ {fo.effective1}</span>
            {p2Won && <span className={`${large ? 'text-lg' : 'text-sm'} font-black text-red-400`}>-{fo.damage1} HP</span>}
            {p1Won && <span className={`${large ? 'text-sm' : 'text-xs'} font-bold text-green-400`}>WIN</span>}
            {tie && <span className="text-xs text-zinc-500">TIE</span>}
          </div>
        )}
      </div>

      {/* VS */}
      <span className={`${large ? 'text-xl' : 'text-sm'} font-black text-zinc-700`}>⚔️</span>

      {/* Player 2 */}
      <div className={`flex flex-col items-center gap-1 transition-all duration-500 ${
        phase === 'enter' ? 'animate-[slideFromRight_0.4s_ease-out]' : ''
      } ${phase === 'result' || phase === 'done' ? (p1Won ? 'opacity-40 scale-90 -translate-x-3' : p2Won ? 'scale-105' : '') : ''}`}>
        <div className={cardSize}><CompactCard card={fo.card2} /></div>

        {(phase === 'power') && (
          <span className="text-sm text-zinc-300 animate-[fadeIn_0.3s_ease-out]">⭐ {fo.star2}</span>
        )}

        {(phase === 'rolling' || phase === 'merge') && (
          <canvas ref={canvas2Ref} width={canvasW} height={canvasH} className="block" />
        )}

        {(phase === 'result' || phase === 'done') && (
          <div className="flex flex-col items-center animate-[fadeIn_0.3s_ease-out]">
            <span className="text-sm font-bold text-zinc-200">⭐ {fo.effective2}</span>
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
      `}</style>
    </div>
  )
}
