'use client'

import { useRef, useState, useCallback } from 'react'

type PackWrapperProps = {
  name: string
  imageUrl: string | null
  price: number
}

export default function PackWrapper({ name, imageUrl, price }: PackWrapperProps) {
  const packRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 })
  const [shine, setShine] = useState({ x: 50, y: 50 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = packRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const maxTilt = 12
    setTilt({
      rotateX: (0.5 - y) * maxTilt,
      rotateY: (x - 0.5) * maxTilt,
    })
    setShine({ x: x * 100, y: y * 100 })
  }, [])

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    setTilt({ rotateX: 0, rotateY: 0 })
    setShine({ x: 50, y: 50 })
  }, [])

  return (
    <div className="flex flex-col items-center">
      <div
        ref={packRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative w-[13rem] cursor-pointer"
        style={{ perspective: '800px' }}
      >
        <div
          style={{
            transform: isHovered
              ? `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale(1.04)`
              : 'rotateX(0) rotateY(0) scale(1)',
            transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.4s ease-out',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Top rip edge */}
          <svg viewBox="0 0 208 12" className="w-full" preserveAspectRatio="none">
            <path
              d="M0,12 L8,4 L16,10 L24,2 L32,9 L40,3 L48,10 L56,2 L64,8 L72,3 L80,10 L88,2 L96,9 L104,3 L112,10 L120,2 L128,8 L136,3 L144,10 L152,2 L160,9 L168,3 L176,10 L184,2 L192,8 L200,3 L208,12 Z"
              className="fill-zinc-800"
            />
          </svg>

          {/* Pack body */}
          <div className="relative overflow-hidden bg-zinc-800">
            {/* Foil shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-white/[0.04] pointer-events-none z-10" />

            {/* Mouse-tracking shine */}
            <div
              className="pointer-events-none absolute inset-0 z-20"
              style={{
                background: isHovered
                  ? `radial-gradient(circle at ${shine.x}% ${shine.y}%, rgba(255,255,255,0.15) 0%, transparent 55%)`
                  : 'none',
              }}
            />

            {/* Pack image or default */}
            <div className="relative h-80">
              {imageUrl ? (
                <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-zinc-700 to-zinc-800">
                  <span className="text-6xl opacity-40">🃏</span>
                </div>
              )}

              {/* Gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Pack info overlay */}
              <div className="absolute bottom-0 inset-x-0 px-4 pb-3">
                <h3 className="text-lg font-bold text-white drop-shadow-lg">{name}</h3>
                <span className="text-sm font-semibold text-amber-400">{price} G</span>
              </div>
            </div>

            {/* Horizontal seal line */}
            <div className="h-[2px] bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
          </div>

          {/* Bottom rip edge */}
          <svg viewBox="0 0 208 12" className="w-full rotate-180" preserveAspectRatio="none">
            <path
              d="M0,12 L8,4 L16,10 L24,2 L32,9 L40,3 L48,10 L56,2 L64,8 L72,3 L80,10 L88,2 L96,9 L104,3 L112,10 L120,2 L128,8 L136,3 L144,10 L152,2 L160,9 L168,3 L176,10 L184,2 L192,8 L200,3 L208,12 Z"
              className="fill-zinc-800"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}
