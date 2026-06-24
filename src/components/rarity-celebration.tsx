'use client'

import { useEffect, useRef } from 'react'

const rarityEmojis: Record<string, string[]> = {
  common: [],
  uncommon: ['✨', '⭐', '✨', '⭐', '✨', '⭐', '✨', '⭐'],
  rare: ['✨', '⭐', '💫', '💎', '✨', '⭐', '💫', '💎', '✨', '⭐', '💫', '💎', '✨', '⭐', '💫'],
  ultra_rare: ['✨', '⭐', '💫', '💜', '🔮', '🌟', '💎', '✨', '💜', '⭐', '💫', '🔮', '💜', '🌟', '💎', '✨', '💜', '⭐', '🔮', '💫'],
  legendary: ['🔥', '⭐', '💛', '✨', '🌟', '💫', '🔥', '⭐', '💛', '✨', '🌟', '💫', '🔥', '⭐', '🏆', '👑', '🔥', '✨', '💛', '🌟', '🔥', '⭐', '💛', '🌟', '💫', '👑'],
  secret_rare: ['🎉', '💖', '✨', '🌟', '🎆', '💫', '⭐', '💖', '✨', '🌟', '🎆', '💫', '🎉', '💖', '✨', '🌟', '🎆', '💫', '⭐', '🏆', '💖', '✨', '🌟', '🎆', '💫', '🎉', '💖', '✨', '🌟', '🎆', '💫', '⭐', '🏆', '💖', '✨'],
}

const raritySizeRange: Record<string, [number, number]> = {
  common: [12, 16],
  uncommon: [14, 20],
  rare: [16, 24],
  ultra_rare: [20, 32],
  legendary: [24, 38],
  secret_rare: [28, 44],
}

const rarityRGB: Record<string, [number, number, number]> = {
  common: [161, 161, 170],
  uncommon: [34, 197, 94],
  rare: [59, 130, 246],
  ultra_rare: [168, 85, 247],
  legendary: [245, 158, 11],
  secret_rare: [236, 72, 153],
}

// Holo-finish celebrations layer ON TOP of the rarity burst. A galaxy pull is
// the single biggest spectacle in the game — more (and larger) particles than
// any rarity, secret_rare included.
const editionEmojis: Record<string, string[]> = {
  golden: ['✨', '🌟', '💛', '👑', '🌟', '✨', '💛', '🌟', '✨', '👑', '💛', '🌟', '✨', '💛', '🌟', '✨', '💛', '👑'],
  diamond: ['💎', '💠', '❄️', '✨', '🔷', '💎', '💠', '❄️', '✨', '🔷', '💎', '💠', '❄️', '✨', '🔷', '💎', '💠', '❄️', '✨', '🔷', '💎', '💠', '❄️', '✨'],
  galaxy: ['🌌', '🌠', '💫', '⭐', '🔮', '✨', '🌟', '🪐', '🌌', '🌠', '💫', '⭐', '🔮', '✨', '🌟', '🪐', '🌌', '🌠', '💫', '⭐', '🔮', '✨', '🌟', '🪐', '🌌', '🌠', '💫', '⭐', '🔮', '✨', '🌟', '🪐', '🌌', '🌠', '💫', '⭐', '🔮', '✨', '🌟', '🪐'],
}

const editionSizeRange: Record<string, [number, number]> = {
  golden: [22, 36],
  diamond: [26, 42],
  galaxy: [32, 56],
}

const editionRGB: Record<string, [number, number, number]> = {
  golden: [255, 190, 80],
  diamond: [150, 205, 255],
  galaxy: [168, 85, 247],
}

// Extra screen-flash punch for holo finishes (galaxy hits hardest).
const editionFlashMul: Record<string, number> = { golden: 1.3, diamond: 1.5, galaxy: 1.9 }

type Particle = {
  emoji: string
  x: number
  y: number
  vx: number
  vy: number
  size: number
  age: number
  rotation: number
  rotationSpeed: number
}

const emojiCache = new Map<string, HTMLCanvasElement>()

function getEmojiCanvas(emoji: string, size: number): HTMLCanvasElement {
  const key = `${emoji}_${size}`
  if (emojiCache.has(key)) return emojiCache.get(key)!
  const c = document.createElement('canvas')
  c.width = size * 2
  c.height = size * 2
  const ctx = c.getContext('2d')!
  ctx.font = `${size}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, size, size)
  emojiCache.set(key, c)
  return c
}

export default function RarityCelebration({
  rarity,
  trigger,
  edition,
  auraRarity,
  auraIntensity,
}: {
  rarity: string
  trigger: number
  /** Holo finish of the revealed card, if any — fires an extra, bigger burst. */
  edition?: string | null
  auraRarity?: string | null
  auraIntensity?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animFrameRef = useRef<number>(0)
  const flashRef = useRef<{ age: number; color: [number, number, number]; mul: number } | null>(null)
  const sizedRef = useRef(false)
  // Store latest props in refs so the loop always reads current values
  const auraRarityRef = useRef(auraRarity)
  const auraIntensityRef = useRef(auraIntensity || 0)
  const fadingAuraRef = useRef<{ color: [number, number, number]; opacity: number } | null>(null)
  const prevIntensityRef = useRef(0)

  auraRarityRef.current = auraRarity
  auraIntensityRef.current = auraIntensity || 0

  // Detect drag end — snapshot the aura for fading
  if (prevIntensityRef.current > 0 && auraIntensityRef.current === 0 && auraRarityRef.current) {
    fadingAuraRef.current = {
      color: rarityRGB[auraRarityRef.current] || [161, 161, 170],
      opacity: prevIntensityRef.current,
    }
  }
  prevIntensityRef.current = auraIntensityRef.current

  function ensureCanvasSize() {
    const canvas = canvasRef.current
    if (canvas && !sizedRef.current) {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      sizedRef.current = true
    }
  }

  function drawAura(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const intensity = auraIntensityRef.current
    const fading = fadingAuraRef.current

    // Active drag aura
    if (intensity > 0 && auraRarityRef.current) {
      const [r, g, b] = rarityRGB[auraRarityRef.current] || [161, 161, 170]
      const cx = w / 2
      const cy = h / 2
      const radius = Math.max(w, h) * 0.4
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      gradient.addColorStop(0, `rgba(${r},${g},${b},${intensity * 0.5})`)
      gradient.addColorStop(0.5, `rgba(${r},${g},${b},${intensity * 0.2})`)
      gradient.addColorStop(1, `rgba(${r},${g},${b},0)`)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)
    }

    // Fading aura after release
    if (fading && fading.opacity > 0) {
      const [r, g, b] = fading.color
      const cx = w / 2
      const cy = h / 2
      const radius = Math.max(w, h) * 0.4
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      gradient.addColorStop(0, `rgba(${r},${g},${b},${fading.opacity * 0.5})`)
      gradient.addColorStop(0.5, `rgba(${r},${g},${b},${fading.opacity * 0.2})`)
      gradient.addColorStop(1, `rgba(${r},${g},${b},0)`)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)
      fading.opacity -= 0.02
      if (fading.opacity <= 0) fadingAuraRef.current = null
    }
  }

  function drawParticles(ctx: CanvasRenderingContext2D) {
    const particles = particlesRef.current
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.02
      p.vx *= 0.997
      p.age++
      p.rotation += p.rotationSpeed
      const alpha = p.age < 30 ? 1 : Math.max(0, 1 - (p.age - 30) / 100)
      if (alpha <= 0) { particles.splice(i, 1); continue }
      const cached = getEmojiCanvas(p.emoji, p.size)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.globalAlpha = alpha
      ctx.drawImage(cached, -p.size, -p.size)
      ctx.restore()
    }
  }

  function startLoop() {
    if (animFrameRef.current) return
    const animate = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Flash
      const flash = flashRef.current
      if (flash && flash.age < 30) {
        const [r, g, b] = flash.color
        const a = Math.max(0, 0.3 * flash.mul - flash.age * 0.01)
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        flash.age++
        if (flash.age >= 30) flashRef.current = null
      }

      drawAura(ctx, canvas.width, canvas.height)
      drawParticles(ctx)

      const hasWork =
        particlesRef.current.length > 0 ||
        flashRef.current !== null ||
        auraIntensityRef.current > 0 ||
        (fadingAuraRef.current && fadingAuraRef.current.opacity > 0)

      if (hasWork) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        animFrameRef.current = 0
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    animFrameRef.current = requestAnimationFrame(animate)
  }

  // Start loop when aura is active
  useEffect(() => {
    if ((auraIntensity && auraIntensity > 0) || (fadingAuraRef.current && fadingAuraRef.current.opacity > 0)) {
      ensureCanvasSize()
      startLoop()
    }
  })

  // Spawn particles on trigger — the rarity burst, plus a bigger holo-finish
  // burst layered on top when the revealed card is golden/diamond/galaxy.
  useEffect(() => {
    if (trigger === 0) return
    ensureCanvasSize()

    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    const spawn = (emojis: string[], sizeRange: [number, number], speedBoost: number): Particle[] =>
      emojis.map((emoji, i) => {
        const angle = (i / emojis.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.8
        const speed = 3 + speedBoost + Math.random() * (3 + speedBoost)
        const spawnR = 40 + Math.random() * 60
        const spawnA = Math.random() * Math.PI * 2
        const size = Math.round(sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]))
        getEmojiCanvas(emoji, size)
        return {
          emoji,
          x: cx + Math.cos(spawnA) * spawnR,
          y: cy + Math.sin(spawnA) * spawnR * 0.6,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size,
          age: 0,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 3,
        }
      })

    const newParticles: Particle[] = []
    const rEmojis = rarityEmojis[rarity] || []
    if (rEmojis.length) newParticles.push(...spawn(rEmojis, raritySizeRange[rarity] || [14, 24], 0))

    const isHolo = edition === 'golden' || edition === 'diamond' || edition === 'galaxy'
    if (isHolo) {
      const boost = edition === 'galaxy' ? 3 : edition === 'diamond' ? 1.5 : 0.5
      newParticles.push(...spawn(editionEmojis[edition!], editionSizeRange[edition!], boost))
    }

    if (newParticles.length === 0) return

    // Holo flash overrides the rarity flash with the finish colour + extra punch.
    flashRef.current = isHolo
      ? { age: 0, color: editionRGB[edition!], mul: editionFlashMul[edition!] }
      : { age: 0, color: rarityRGB[rarity] || [0, 0, 0], mul: 1 }

    particlesRef.current = [...particlesRef.current, ...newParticles]
    startLoop()
  }, [trigger, rarity, edition])

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = 0
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[100] pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    />
  )
}
