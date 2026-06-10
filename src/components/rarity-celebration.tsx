'use client'

import { useEffect, useState } from 'react'

const rarityEmojis: Record<string, string[]> = {
  common: [],
  uncommon: ['✨', '✨', '⭐', '✨', '⭐', '✨'],
  rare: ['✨', '⭐', '💫', '✨', '⭐', '💎', '✨', '💫', '⭐', '✨', '💎', '⭐'],
  ultra_rare: ['✨', '⭐', '💫', '💜', '🔮', '✨', '⭐', '💫', '💜', '✨', '🌟', '💎', '🔮', '💜', '✨', '⭐', '💫', '🔮', '💜', '✨', '🌟', '💎', '💜', '✨', '⭐'],
  legendary: ['🔥', '⭐', '💛', '✨', '🌟', '💫', '🔥', '⭐', '💛', '✨', '🌟', '💫', '🔥', '⭐', '🏆', '👑', '🔥', '✨', '💛', '🌟', '🔥', '⭐', '💛', '✨', '🌟', '💫', '🔥', '👑', '🏆', '💛', '✨', '🌟', '🔥', '⭐', '💫'],
  secret_rare: ['🎉', '💖', '✨', '🌟', '🎆', '💫', '⭐', '💖', '✨', '🌟', '🎆', '💫', '🎉', '💖', '✨', '🌟', '🎆', '💫', '⭐', '🏆', '💖', '✨', '🌟', '🎆', '💫', '🎉', '💖', '✨', '🌟', '🎆', '💫', '⭐', '💖', '✨', '🌟', '🎆', '💫', '🎉', '🏆', '💖', '✨', '🌟', '🎆', '💫', '⭐'],
}

const raritySizeRange: Record<string, [number, number]> = {
  common: [12, 16],
  uncommon: [14, 20],
  rare: [16, 24],
  ultra_rare: [20, 32],
  legendary: [24, 38],
  secret_rare: [28, 44],
}

const rarityFlashColor: Record<string, string> = {
  common: 'transparent',
  uncommon: 'rgba(34,197,94,0.2)',
  rare: 'rgba(59,130,246,0.3)',
  ultra_rare: 'rgba(168,85,247,0.35)',
  legendary: 'rgba(245,158,11,0.4)',
  secret_rare: 'rgba(236,72,153,0.45)',
}

const rarityShake: Record<string, boolean> = {
  ultra_rare: true,
  legendary: true,
  secret_rare: true,
}

type Particle = {
  id: number
  emoji: string
  startX: number
  startY: number
  endX: number
  endY: number
  size: number
  duration: number
  delay: number
  spin: number
}

export default function RarityCelebration({ rarity, trigger }: { rarity: string; trigger: number }) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [flash, setFlash] = useState(false)
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    if (trigger === 0) return

    const emojis = rarityEmojis[rarity] || []
    if (emojis.length === 0) return

    // Flash
    setFlash(true)
    setTimeout(() => setFlash(false), 500)

    // Shake
    if (rarityShake[rarity]) {
      setShaking(true)
      setTimeout(() => setShaking(false), 600)
    }

    // Create particles exploding from center to all edges
    const newParticles: Particle[] = emojis.map((emoji, i) => {
      const angle = (i / emojis.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.8
      const distance = 120 + Math.random() * 150
      // Spawn scattered around center, not dead center
      const spawnRadius = 8 + Math.random() * 12
      const spawnAngle = Math.random() * Math.PI * 2
      return {
        id: Date.now() + i,
        emoji,
        startX: 50 + Math.cos(spawnAngle) * spawnRadius,
        startY: 45 + Math.sin(spawnAngle) * spawnRadius * 0.6,
        endX: 50 + Math.cos(angle) * (distance / 4),
        endY: 50 + Math.sin(angle) * (distance / 5),
        size: (raritySizeRange[rarity]?.[0] || 14) + Math.random() * ((raritySizeRange[rarity]?.[1] || 24) - (raritySizeRange[rarity]?.[0] || 14)),
        duration: 2000 + Math.random() * 500,
        delay: Math.random() * 100,
        spin: (Math.random() - 0.5) * 720,
      }
    })

    setParticles((prev) => [...prev, ...newParticles])
    const ids = newParticles.map((p) => p.id)
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !ids.includes(p.id)))
    }, 2500)
  }, [trigger, rarity])

  return (
    <>
      {/* Screen flash — behind cards (z-40, cards are z-50) */}
      {flash && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 45,
            background: `radial-gradient(circle at 50% 50%, ${rarityFlashColor[rarity] || 'transparent'} 0%, transparent 70%)`,
            animation: 'celebFlash 0.5s ease-out forwards',
          }}
        />
      )}

      {/* Screen shake */}
      {shaking && (
        <style>{`
          body { animation: celebShake ${rarity === 'secret_rare' ? '0.6s' : '0.4s'} ease-in-out; }
        `}</style>
      )}

      {/* Emoji particles — on top of everything */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="fixed pointer-events-none"
          style={{
            zIndex: 200,
            left: `${p.startX}%`,
            top: `${p.startY}%`,
            fontSize: `${p.size}px`,
            animation: `celebParticle ${p.duration}ms cubic-bezier(0.2, 0.8, 0.3, 1) ${p.delay}ms forwards`,
            '--end-x': `${p.endX - p.startX}vw`,
            '--end-y': `${p.endY - p.startY}vh`,
            '--spin': `${p.spin}deg`,
          } as React.CSSProperties}
        >
          {p.emoji}
        </div>
      ))}

      <style>{`
        @keyframes celebFlash {
          0% { opacity: 0; }
          15% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes celebParticle {
          0% {
            transform: translate(-50%, -50%) scale(0.5) rotate(0deg);
            opacity: 1;
          }
          15% {
            transform: translate(calc(-50% + var(--end-x) * 0.6), calc(-50% + var(--end-y) * 0.6)) scale(1.4) rotate(calc(var(--spin) * 0.4));
            opacity: 1;
          }
          40% {
            transform: translate(calc(-50% + var(--end-x) * 0.85), calc(-50% + var(--end-y) * 0.85)) scale(1.8) rotate(calc(var(--spin) * 0.7));
            opacity: 0.7;
          }
          100% {
            transform: translate(calc(-50% + var(--end-x)), calc(-50% + var(--end-y))) scale(2) rotate(var(--spin));
            opacity: 0;
          }
        }
        @keyframes celebShake {
          0%, 100% { transform: translate(0, 0) rotate(0); }
          10% { transform: translate(-6px, -2px) rotate(-0.5deg); }
          20% { transform: translate(6px, 2px) rotate(0.5deg); }
          30% { transform: translate(-5px, 1px) rotate(-0.4deg); }
          40% { transform: translate(5px, -1px) rotate(0.4deg); }
          50% { transform: translate(-4px, 2px) rotate(-0.3deg); }
          60% { transform: translate(4px, -2px) rotate(0.3deg); }
          70% { transform: translate(-2px, 1px) rotate(-0.1deg); }
          80% { transform: translate(2px, -1px) rotate(0.1deg); }
          90% { transform: translate(-1px, 0px) rotate(0); }
        }
      `}</style>
    </>
  )
}
