'use client'

import { useRef } from 'react'
import CompactCard from './compact-card'
import type { FaceOffDetail } from '@/lib/battle-engine'

const rarityTextColor: Record<string, string> = {
  common: 'text-zinc-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  ultra_rare: 'text-purple-400',
  legendary: 'text-amber-400',
  secret_rare: 'text-pink-400',
}

type Phase = 'enter' | 'power' | 'rolling' | 'merge' | 'result' | 'done'

type EmojiParticle = { emoji: string; x: number; y: number; vx: number; vy: number; size: number; age: number; rotation: number; rs: number }

export default function BattleFaceoff({
  faceOff,
  phase,
  rollElapsed,
  large,
  vertical,
  p1Name,
  p2Name,
  p1Hp,
  p2Hp,
}: {
  faceOff: FaceOffDetail
  phase: Phase
  rollElapsed: number
  large: boolean
  vertical?: boolean
  p1Name?: string
  p2Name?: string
  p1Hp?: number
  p2Hp?: number
}) {
  const canvas1Ref = useRef<HTMLCanvasElement>(null)
  const canvas2Ref = useRef<HTMLCanvasElement>(null)
  const effectsCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const card1DivRef = useRef<HTMLDivElement>(null)
  const card2DivRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<EmojiParticle[]>([])
  const effectsAnimRef = useRef<number>(0)
  const spawnedRef = useRef(false)
  const setupRef = useRef<Set<string>>(new Set())

  const fo = faceOff

  const p1Won = fo.damage2 > 0
  const p2Won = fo.damage1 > 0
  const tie = fo.damage1 === 0 && fo.damage2 === 0

  const cardSize = large ? 'w-28 sm:w-32' : 'w-16'
  const canvasW = large ? 180 : 120
  const canvasH = large ? 44 : 30
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const fontSize = large ? 24 : 16

  const setupCanvas = (canvas: HTMLCanvasElement | null, id: string) => {
    if (!canvas || setupRef.current.has(id)) return
    canvas.width = canvasW * dpr
    canvas.height = canvasH * dpr
    canvas.style.width = `${canvasW}px`
    canvas.style.height = `${canvasH}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
    setupRef.current.add(id)
  }

  const drawSide = (canvas: HTMLCanvasElement | null, id: string, baseStar: number, finalRoll: number, maxRoll: number, effective: number) => {
    setupCanvas(canvas, id)
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvasW
    const h = canvasH
    ctx.clearRect(0, 0, w, h)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (phase === 'power') {
      ctx.font = `${fontSize * 0.6}px serif`
      ctx.fillText('⭐', w / 2 - fontSize * 0.8, h / 2)
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`
      ctx.fillStyle = '#d4d4d8'
      ctx.fillText(`${baseStar}`, w / 2 + fontSize * 0.5, h / 2)
    }

    if (phase === 'rolling') {
      if (maxRoll === 0) {
        ctx.font = `${fontSize * 0.6}px serif`
        ctx.fillText('⭐', w / 2 - fontSize * 0.8, h / 2)
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`
        ctx.fillStyle = '#e4e4e7'
        ctx.fillText(`${baseStar}`, w / 2 + fontSize * 0.5, h / 2)
      } else {
        const progress = Math.min(rollElapsed / 1200, 1)
        const speed = 1 - Math.pow(progress, 2.5)

        ctx.font = `${fontSize * 0.6}px serif`
        ctx.fillText('⭐', w * 0.2, h / 2)
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`
        ctx.fillStyle = '#a1a1aa'
        ctx.fillText(`${baseStar}`, w * 0.2 + fontSize * 0.7, h / 2)

        ctx.fillStyle = '#71717a'
        ctx.font = `bold ${fontSize * 0.6}px system-ui, sans-serif`
        ctx.fillText('+', w * 0.48, h / 2)

        let displayRoll = progress >= 0.95 ? finalRoll : speed > 0.02 ? Math.floor(Math.random() * (maxRoll + 1)) : finalRoll
        const shakeX = speed * (Math.random() - 0.5) * 3
        const shakeY = speed * (Math.random() - 0.5) * 3

        if (speed > 0.3) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 8 * speed } else { ctx.shadowBlur = 0 }

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
        ctx.font = `${fontSize * 0.6}px serif`
        ctx.fillText('⭐', w / 2 - fontSize * 0.8, h / 2)
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`
        ctx.fillStyle = '#e4e4e7'
        ctx.fillText(`${effective}`, w / 2 + fontSize * 0.5, h / 2)
      } else {
        const mergeProgress = Math.min(rollElapsed / 600, 1)
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
        if (finalRoll > 0) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 6 * (1 - eased) }
        ctx.font = `${fontSize * 0.6}px serif`
        ctx.fillText('⭐', w / 2 - fontSize * 0.8, h / 2)
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`
        ctx.fillStyle = '#e4e4e7'
        ctx.fillText(`${effective}`, w / 2 + fontSize * 0.5, h / 2)
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }
    }

    if (phase === 'result' || phase === 'done') {
      ctx.font = `${fontSize * 0.6}px serif`
      ctx.fillText('⭐', w / 2 - fontSize * 0.8, h / 2)
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`
      ctx.fillStyle = '#e4e4e7'
      ctx.fillText(`${effective}`, w / 2 + fontSize * 0.5, h / 2)
    }
  }

  // Draw canvases
  const maxRoll1 = fo.star1 < fo.star2 ? fo.star2 - fo.star1 + 1 : fo.star1 === fo.star2 ? 1 : 0
  const maxRoll2 = fo.star2 < fo.star1 ? fo.star1 - fo.star2 + 1 : fo.star1 === fo.star2 ? 1 : 0

  if (phase !== 'enter') {
    requestAnimationFrame(() => {
      drawSide(canvas1Ref.current, 'c1', fo.star1, fo.roll1, maxRoll1, fo.effective1)
      drawSide(canvas2Ref.current, 'c2', fo.star2, fo.roll2, maxRoll2, fo.effective2)
    })
  }

  // Reset spawn flag when entering a new faceoff
  if (phase === 'enter') {
    spawnedRef.current = false
    setupRef.current.clear()
  }

  // Spawn particles on result (once)
  if ((phase === 'result') && large && !spawnedRef.current) {
    spawnedRef.current = true
    requestAnimationFrame(() => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()

      const spawn = (cardRef: HTMLDivElement | null, side: 'left' | 'right', isWinner: boolean, damage: number) => {
        let cx: number, cy: number
        if (cardRef) {
          const r = cardRef.getBoundingClientRect()
          cx = r.left - containerRect.left + r.width / 2
          cy = r.top - containerRect.top + r.height / 2
        } else {
          cx = side === 'left' ? containerRect.width * 0.25 : containerRect.width * 0.75
          cy = containerRect.height * 0.4
        }
        const emoji = isWinner ? '🎉' : '💥'
        const count = Math.min(damage * 3, 18)
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.8
          const speed = 0.8 + Math.random() * 1.2
          particlesRef.current.push({
            emoji, x: cx + (Math.random() - 0.5) * 30, y: cy + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.5,
            size: 20 + Math.random() * (10 + damage * 3), age: 0,
            rotation: Math.random() * 360, rs: (Math.random() - 0.5) * 4,
          })
        }
      }

      if (fo.damage2 > 0) { spawn(card1DivRef.current, 'left', true, fo.damage2); spawn(card2DivRef.current, 'right', false, fo.damage2) }
      else if (fo.damage1 > 0) { spawn(card2DivRef.current, 'right', true, fo.damage1); spawn(card1DivRef.current, 'left', false, fo.damage1) }

      if (!effectsAnimRef.current) {
        const animate = () => {
          const canvas = effectsCanvasRef.current
          if (!canvas || !containerRef.current) return
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          const r = containerRef.current.getBoundingClientRect()
          const d = window.devicePixelRatio || 1
          canvas.width = r.width * d; canvas.height = r.height * d
          canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`
          ctx.scale(d, d); ctx.clearRect(0, 0, r.width, r.height)
          const ps = particlesRef.current
          for (let i = ps.length - 1; i >= 0; i--) {
            const p = ps[i]
            p.x += p.vx; p.y += p.vy; p.vy += 0.015; p.vx *= 0.997; p.age++; p.rotation += p.rs
            const alpha = p.age < 40 ? 1 : Math.max(0, 1 - (p.age - 40) / 80)
            if (alpha <= 0) { ps.splice(i, 1); continue }
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rotation * Math.PI) / 180)
            ctx.globalAlpha = alpha; ctx.font = `${p.size}px serif`
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(p.emoji, 0, 0); ctx.restore()
          }
          if (ps.length > 0) { effectsAnimRef.current = requestAnimationFrame(animate) }
          else { effectsAnimRef.current = 0 }
        }
        effectsAnimRef.current = requestAnimationFrame(animate)
      }
    })
  }

  const enterAnim1 = vertical ? 'animate-[slideFromTop_0.4s_ease-out]' : 'animate-[slideFromLeft_0.4s_ease-out]'
  const enterAnim2 = vertical ? 'animate-[slideFromBottom_0.4s_ease-out]' : 'animate-[slideFromRight_0.4s_ease-out]'
  const knockP1 = vertical ? 'opacity-40 scale-90 -translate-y-3' : 'opacity-40 scale-90 translate-x-3'
  const knockP2 = vertical ? 'opacity-40 scale-90 translate-y-3' : 'opacity-40 scale-90 -translate-x-3'

  return (
    <div ref={containerRef} className="relative flex flex-col items-center gap-2">
    <canvas ref={effectsCanvasRef} className="absolute inset-0 pointer-events-none z-10" />
    <div className={`flex items-center justify-center ${vertical ? 'flex-col gap-4' : 'gap-3 sm:gap-6'}`}>
      <div className={`flex ${vertical ? 'flex-row items-center gap-3' : 'flex-col items-center gap-1'} transition-all duration-500 ${
        phase === 'enter' ? enterAnim1 : ''
      } ${phase === 'result' || phase === 'done' ? (p2Won ? knockP1 : p1Won ? 'scale-105' : '') : ''}`}>
        <div ref={card1DivRef} className={`${cardSize} ${large ? 'card-shadow-lg' : 'card-shadow'} ${phase === 'enter' ? (large ? 'animate-[cardEnterLeft_0.5s_ease-out_forwards]' : '') : (large ? 'animate-[wobbleLeft_3s_ease-in-out_infinite]' : '')}`} style={!large ? { transform: 'rotate(2deg)' } : undefined}><CompactCard card={fo.card1} /></div>
        <div className={`flex flex-col ${vertical ? 'items-start' : 'items-center'} gap-1`}>
          <canvas ref={canvas1Ref} className={`block transition-opacity duration-300 ${phase === 'enter' ? 'opacity-0' : 'opacity-100'}`}
            style={{ width: canvasW, height: canvasH }} />
        </div>
      </div>

      <span className={`${large ? 'text-xl' : 'text-sm'} font-black text-zinc-700`}>⚔️</span>

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
      {large && (
        <div className="w-full text-center h-8 flex items-center justify-center">
          {(phase === 'result' || phase === 'done') && (
            <div className="animate-[fadeIn_0.3s_ease-out]">
              {(() => {
                const winnerCard = p1Won ? fo.card1 : p2Won ? fo.card2 : null
                const loserName = p1Won ? (p2Name || 'Player 2') : p2Won ? (p1Name || 'Player 1') : null
                const damage = p1Won ? fo.damage2 : p2Won ? fo.damage1 : 0
                // p1Hp/p2Hp already include current face-off damage (React batches the state updates)
                const loserHpAfter = p1Won ? (p2Hp ?? 10) : p2Won ? (p1Hp ?? 10) : null
                const isKo = loserHpAfter !== null && loserHpAfter <= 0
                const cardNameEl = winnerCard ? <span className={`font-bold ${rarityTextColor[winnerCard.rarity] || 'text-zinc-300'}`}>{winnerCard.name}</span> : null

                if (tie) return <span className="text-sm text-zinc-500">It&apos;s a tie!</span>
                if (isKo) return <span className="text-base">{cardNameEl} <span className="font-black text-red-400">KO&apos;d</span> <span className="font-bold text-white">{loserName}</span>! 💀</span>
                if (damage >= 4) return <span className="text-base">{cardNameEl}<span className="text-zinc-500"> did a massive </span><span className="font-black text-red-400">{damage}</span><span className="text-zinc-500"> damage to </span><span className="font-bold text-white">{loserName}</span>!</span>
                return <span className="text-base">{cardNameEl}<span className="text-zinc-500"> did </span><span className="font-black text-red-400">{damage}</span><span className="text-zinc-500"> damage to </span><span className="font-bold text-white">{loserName}</span></span>
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
