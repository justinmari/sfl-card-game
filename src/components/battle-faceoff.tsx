'use client'

import { useEffect, useRef, useState } from 'react'
import CompactCard from './compact-card'
import type { FaceOffDetail } from '@/lib/battle-engine'

type Phase = 'enter' | 'power' | 'rolling' | 'merge' | 'result' | 'done'

export default function BattleFaceoff({
  faceOff,
  onResult,
  onComplete,
  large,
  vertical,
  p1Name,
  p2Name,
  p1Hp,
  p2Hp,
}: {
  faceOff: FaceOffDetail
  onResult?: () => void
  onComplete: () => void
  large: boolean
  vertical?: boolean
  p1Name?: string
  p2Name?: string
  p1Hp?: number
  p2Hp?: number
}) {
  const [phase, setPhase] = useState<Phase>('enter')
  const canvas1Ref = useRef<HTMLCanvasElement>(null)
  const canvas2Ref = useRef<HTMLCanvasElement>(null)
  const effectsCanvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const effectsAnimRef = useRef<number>(0)
  const startTimeRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const fo = faceOff
  const calledRef = useRef({ result: false, complete: false })

  type EmojiParticle = { emoji: string; x: number; y: number; vx: number; vy: number; size: number; age: number; rotation: number; rs: number }
  const particlesRef = useRef<EmojiParticle[]>([])

  const card1DivRef = useRef<HTMLDivElement>(null)
  const card2DivRef = useRef<HTMLDivElement>(null)

  const spawnParticles = (side: 'left' | 'right', isWinner: boolean, damage: number) => {
    if (!containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const cardRef = side === 'left' ? card1DivRef.current : card2DivRef.current
    let cx: number, cy: number
    if (cardRef) {
      const cardRect = cardRef.getBoundingClientRect()
      cx = cardRect.left - containerRect.left + cardRect.width / 2
      cy = cardRect.top - containerRect.top + cardRect.height / 2
    } else {
      cx = side === 'left' ? containerRect.width * 0.25 : containerRect.width * 0.75
      cy = containerRect.height * 0.4
    }

    const emoji = isWinner ? '🎉' : '💥'
    const count = Math.min(3 + damage * 2, 12)

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.8
      const speed = 0.8 + Math.random() * 1.2
      particlesRef.current.push({
        emoji,
        x: cx + (Math.random() - 0.5) * 30,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        size: 20 + Math.random() * (10 + damage * 3),
        age: 0,
        rotation: Math.random() * 360,
        rs: (Math.random() - 0.5) * 4,
      })
    }

    if (!effectsAnimRef.current) {
      const animate = () => {
        const canvas = effectsCanvasRef.current
        if (!canvas || !containerRef.current) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const r = containerRef.current.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        canvas.width = r.width * dpr
        canvas.height = r.height * dpr
        canvas.style.width = `${r.width}px`
        canvas.style.height = `${r.height}px`
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, r.width, r.height)

        const ps = particlesRef.current
        for (let i = ps.length - 1; i >= 0; i--) {
          const p = ps[i]
          p.x += p.vx; p.y += p.vy; p.vy += 0.015; p.vx *= 0.997; p.age++; p.rotation += p.rs
          const alpha = p.age < 40 ? 1 : Math.max(0, 1 - (p.age - 40) / 80)
          if (alpha <= 0) { ps.splice(i, 1); continue }
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate((p.rotation * Math.PI) / 180)
          ctx.globalAlpha = alpha
          ctx.font = `${p.size}px serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(p.emoji, 0, 0)
          ctx.restore()
        }

        if (ps.length > 0) {
          effectsAnimRef.current = requestAnimationFrame(animate)
        } else {
          effectsAnimRef.current = 0
          ctx.clearRect(0, 0, r.width, r.height)
        }
      }
      effectsAnimRef.current = requestAnimationFrame(animate)
    }
  }

  useEffect(() => {
    setPhase('enter')
    startTimeRef.current = 0
    particlesRef.current = []
    calledRef.current = { result: false, complete: false }

    const timers = [
      setTimeout(() => setPhase('power'), 500),
      setTimeout(() => setPhase('rolling'), 1200),
      setTimeout(() => setPhase('merge'), 2400),
      setTimeout(() => {
        setPhase('result')
        if (!calledRef.current.result) {
          calledRef.current.result = true
          onResult?.()
        }
        if (large) {
          if (fo.damage2 > 0) { spawnParticles('left', true, fo.damage2); spawnParticles('right', false, fo.damage2) }
          else if (fo.damage1 > 0) { spawnParticles('right', true, fo.damage1); spawnParticles('left', false, fo.damage1) }
        }
      }, 3100),
      setTimeout(() => {
        setPhase('done')
        if (!calledRef.current.complete) {
          calledRef.current.complete = true
          onComplete()
        }
      }, 4500),
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
    <div ref={containerRef} className="relative flex flex-col items-center gap-2">
    <canvas ref={effectsCanvasRef} className="absolute inset-0 pointer-events-none z-10" />
    <div className={`flex items-center justify-center ${vertical ? 'flex-col gap-4' : 'gap-3 sm:gap-6'}`}>
      {/* Player 1 */}
      <div className={`flex ${vertical ? 'flex-row items-center gap-3' : 'flex-col items-center gap-1'} transition-all duration-500 ${
        phase === 'enter' ? enterAnim1 : ''
      } ${phase === 'result' || phase === 'done' ? (p2Won ? knockP1 : p1Won ? 'scale-105' : '') : ''}`}>
        <div ref={card1DivRef} className={`${cardSize} ${large ? 'card-shadow-lg' : 'card-shadow'} ${phase === 'enter' ? (large ? 'animate-[cardEnterLeft_0.5s_ease-out_forwards]' : '') : (large ? 'animate-[wobbleLeft_3s_ease-in-out_infinite]' : '')}`} style={!large ? { transform: 'rotate(2deg)' } : undefined}><CompactCard card={fo.card1} /></div>

        <div className={`flex flex-col ${vertical ? 'items-start' : 'items-center'} gap-1`}>
          <canvas ref={canvas1Ref} className={`block transition-opacity duration-300 ${phase === 'enter' ? 'opacity-0' : 'opacity-100'}`}
            style={{ width: canvasW, height: canvasH }} />
        </div>
      </div>

      {/* VS */}
      <span className={`${large ? 'text-xl' : 'text-sm'} font-black text-zinc-700`}>⚔️</span>

      {/* Player 2 */}
      <div className={`flex ${vertical ? 'flex-row items-center gap-3' : 'flex-col items-center gap-1'} transition-all duration-500 ${
        phase === 'enter' ? enterAnim2 : ''
      } ${phase === 'result' || phase === 'done' ? (p1Won ? knockP2 : p2Won ? 'scale-105' : '') : ''}`}>
        <div ref={card2DivRef} className={`${cardSize} ${large ? 'card-shadow-lg' : 'card-shadow'} ${phase === 'enter' ? (large ? 'animate-[cardEnterRight_0.5s_ease-out_forwards]' : '') : (large ? 'animate-[wobbleRight_3s_ease-in-out_infinite]' : '')}`} style={!large ? { transform: 'rotate(-2deg)' } : undefined}><CompactCard card={fo.card2} /></div>

        <div className={`flex flex-col ${vertical ? 'items-start' : 'items-center'} gap-1`}>
          <canvas ref={canvas2Ref} className={`block transition-opacity duration-300 ${phase === 'enter' ? 'opacity-0' : 'opacity-100'}`}
            style={{ width: canvasW, height: canvasH }} />
        </div>
      </div>

      </div>
      {/* Result text — always reserve space */}
      {large && (
        <div className="w-full text-center h-8 flex items-center justify-center">
          {(phase === 'result' || phase === 'done') && (
            <div className="animate-[fadeIn_0.3s_ease-out]">
              {(() => {
                const winnerName = p1Won ? (p1Name || 'Player 1') : p2Won ? (p2Name || 'Player 2') : null
                const loserName = p1Won ? (p2Name || 'Player 2') : p2Won ? (p1Name || 'Player 1') : null
                const damage = p1Won ? fo.damage2 : p2Won ? fo.damage1 : 0
                const loserHpAfter = p1Won ? Math.max(0, (p2Hp ?? 10) - fo.damage2) : p2Won ? Math.max(0, (p1Hp ?? 10) - fo.damage1) : null
                const isKo = loserHpAfter !== null && loserHpAfter <= 0

                if (tie) return <span className="text-sm text-zinc-500">It&apos;s a tie!</span>
                if (isKo) return <span className="text-base"><span className="font-bold text-white">{winnerName}</span> <span className="font-black text-red-400">KO&apos;d</span> <span className="font-bold text-white">{loserName}</span>! 💀</span>
                if (damage >= 4) return <span className="text-base"><span className="font-bold text-white">{winnerName}</span> did a massive <span className="font-black text-red-400">{damage}</span> damage to <span className="font-bold text-white">{loserName}</span>!</span>
                return <span className="text-base"><span className="font-bold text-white">{winnerName}</span> did <span className="font-black text-red-400">{damage}</span> damage to <span className="font-bold text-white">{loserName}</span></span>
              })()}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideFromLeft { from { transform: translateX(-40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideFromRight { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideFromTop { from { transform: translateY(-40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideFromBottom { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes cardEnterLeft { from { transform: rotate(-10deg); } to { transform: rotate(7deg); } }
        @keyframes cardEnterRight { from { transform: rotate(10deg); } to { transform: rotate(-7deg); } }
        @keyframes wobbleLeft { 0%, 100% { transform: rotate(7deg); } 50% { transform: rotate(4deg); } }
        @keyframes wobbleRight { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(-4deg); } }
      `}</style>
    </div>
  )
}
