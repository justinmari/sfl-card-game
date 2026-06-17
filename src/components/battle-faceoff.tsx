'use client'

import { useRef, useState, useEffect } from 'react'
import CompactCard from './compact-card'
import type { FaceOffDetail } from '@/lib/battle-engine'
import { type EffectKind } from '@/lib/skill-visuals'
import { rarityLabel } from '@/lib/rarities'
import { type DieInfo, buildSideDice } from '@/lib/dice-display'

const rarityTextColor: Record<string, string> = {
  common: 'text-zinc-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  ultra_rare: 'text-purple-400',
  legendary: 'text-amber-400',
  secret_rare: 'text-pink-400',
}

type Phase = 'enter' | 'power' | 'rolling' | 'merge' | 'result' | 'done'

// Visual treatment per effect kind shown during a face-off. `glow` is the rgb
// used for the card aura + chip glow; `shake` flags kinds that jolt the screen.
const KIND_META: Record<EffectKind, { emoji: string; tint: string; glow: string; shake?: boolean }> = {
  deck:      { emoji: '🔀', tint: 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100', glow: '99,102,241' },
  rarity:    { emoji: '💎', tint: 'border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-100', glow: '217,70,239' },
  power:     { emoji: '⭐', tint: 'border-sky-400/50 bg-sky-500/15 text-sky-100', glow: '56,189,248' },
  dice:      { emoji: '🎲', tint: 'border-amber-400/50 bg-amber-500/15 text-amber-100', glow: '251,191,36' },
  extraDice: { emoji: '🎲', tint: 'border-amber-400/50 bg-amber-500/15 text-amber-100', glow: '251,191,36' },
  total:     { emoji: '⚡', tint: 'border-violet-400/50 bg-violet-500/15 text-violet-100', glow: '167,139,250' },
  damage:    { emoji: '💥', tint: 'border-red-400/50 bg-red-500/15 text-red-100', glow: '248,113,113', shake: true },
  heal:      { emoji: '💚', tint: 'border-green-400/50 bg-green-500/15 text-green-100', glow: '74,222,128' },
  visual:    { emoji: '🎨', tint: 'border-zinc-400/50 bg-zinc-500/15 text-zinc-100', glow: '161,161,170' },
}

// Which face-off phase each changed field becomes visible at.
const FIELD_PHASE: Record<string, Phase> = { star: 'power', rarity: 'power', roll: 'rolling', bonusRoll: 'rolling', effective: 'merge', damage: 'result' }

// Each changed field maps directly to one effect kind. (Rarity and power are
// now distinct fields, so there's no ambiguity to resolve.)
const FIELD_KIND: Record<string, EffectKind> = { star: 'power', rarity: 'rarity', roll: 'dice', bonusRoll: 'extraDice', effective: 'total', damage: 'damage' }

// A number that counts from `from` to `to` when it mounts — used to show a
// total/power/dice/damage value growing or shrinking as a skill applies.
function CountTo({ from, to, className }: { from: number; to: number; className?: string }) {
  const [val, setVal] = useState(from)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / 480, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(from + (to - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [from, to])
  return <span className={className}>{val}</span>
}

type EmojiParticle = { emoji: string; x: number; y: number; vx: number; vy: number; size: number; age: number; rotation: number; rs: number }


// DOM breakdown of ⭐ power + each 🎲 die → total. Dice reveal one at a time as
// effects are stepped (the newest spins with its source label, e.g. "Underdog
// 0-10" / "Egg Roll 0-1"; synergies in cyan). Replaces the old canvas; particles
// stay on canvas.
function DiceBreakdown({ phase, rollElapsed, star, dice, effective, large }: {
  phase: Phase; rollElapsed: number; star: number; dice: DieInfo[]; effective: number; large: boolean
}) {
  const [, setTick] = useState(0)
  const rolling = phase === 'rolling'
  useEffect(() => {
    if (!rolling) return
    const iv = setInterval(() => setTick((t) => t + 1), 80) // slot-machine flicker for the spinning die
    return () => clearInterval(iv)
  }, [rolling, dice.length])

  const n = large ? 'text-xl' : 'text-sm'
  const e = large ? 'text-sm' : 'text-[10px]'
  const wrap = `flex flex-col items-center justify-center ${large ? 'min-h-[44px]' : 'min-h-[30px]'}`
  const row = 'flex items-center justify-center gap-1 font-bold tabular-nums'
  const dieColor = (d: DieInfo) => (d.isSynergy ? 'text-cyan-400' : 'text-amber-400')

  if (phase === 'enter') return <div className={wrap} />
  if (phase === 'power' || (phase === 'rolling' && dice.length === 0)) {
    return <div className={wrap}><div className={row}><span className={e}>⭐</span><span className={`${n} text-zinc-300`}>{star}</span></div></div>
  }
  if (phase === 'rolling') {
    const lastIdx = dice.length - 1
    const current = dice[lastIdx]
    return (
      <div className={wrap}>
        <div className={row}>
          <span className={e}>⭐</span><span className={`${n} text-zinc-400`}>{star}</span>
          {dice.map((d, i) => {
            const isCurrent = i === lastIdx
            const shown = isCurrent ? Math.floor(Math.random() * ((d.spinMax || 1) + 1)) : d.value
            return (
              <span key={i} className="flex items-center gap-0.5">
                <span className={`${e} text-zinc-500`}>+</span>
                <span className={e}>🎲</span>
                <span className={`${n} ${dieColor(d)} ${isCurrent ? 'animate-pulse' : ''}`}>{shown}</span>
              </span>
            )
          })}
        </div>
        {dice.filter((d) => d.label).map((d, i) => (
          <div key={i} data-testid="skill-effect" data-kind={d.isBase ? 'dice' : 'extraDice'} data-skill={d.label} data-synergy={d.isSynergy ? 'true' : 'false'}
            className={`${e} mt-0.5 font-semibold ${d.isSynergy ? 'text-cyan-300' : 'text-amber-300'} ${d === current ? 'animate-pulse' : ''}`}>
            🎲 {d.label}{d.range ? ` ${d.range}` : ''}
          </div>
        ))}
      </div>
    )
  }
  // merge / result / done → the combined total, with a small caption of which
  // dice effects contributed (persistent, so it reads after the roll settles).
  const labeled = dice.filter((d) => d.label)
  return (
    <div className={wrap}>
      <div className={row}><span className={e}>⭐</span><span key={effective} className={`${n} text-zinc-100 animate-[skillPop_0.4s_ease-out]`}>{effective}</span></div>
      {labeled.map((d, i) => (
        <div key={i} data-testid="skill-effect" data-kind={d.isBase ? 'dice' : 'extraDice'} data-skill={d.label} data-synergy={d.isSynergy ? 'true' : 'false'}
          className={`${e} ${d.isSynergy ? 'text-cyan-300' : 'text-amber-300'}`}>
          🎲 {d.label}{d.range ? ` ${d.range}` : ''}
        </div>
      ))}
    </div>
  )
}


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
  cardFilter,
  playerNames,
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
  cardFilter?: string
  playerNames?: Record<string, string>
}) {
  const effectsCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const card1DivRef = useRef<HTMLDivElement>(null)
  const card2DivRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<EmojiParticle[]>([])
  const effectsAnimRef = useRef<number>(0)
  const spawnedRef = useRef(false)
  const setupRef = useRef<Set<string>>(new Set())
  const skillFiredRef = useRef<Set<string>>(new Set())

  const fo = faceOff

  const p1Won = fo.damage2 > 0
  const p2Won = fo.damage1 > 0
  const tie = fo.damage1 === 0 && fo.damage2 === 0

  const cardSize = large ? 'w-28 sm:w-32' : 'w-16'

  // Ordered dice per side (base/underdog roll + any extra dice), derived from
  // the step-sliced activations so dice appear as effects are revealed.
  const diceFor = (side: 1 | 2): DieInfo[] => buildSideDice(fo, side)

  // Reset spawn flags when entering a new faceoff
  if (phase === 'enter') {
    spawnedRef.current = false
    setupRef.current.clear()
    skillFiredRef.current.clear()
  }

  // Shared particle render loop — used by both result bursts and skill sparkles.
  const ensureLoop = () => {
    if (effectsAnimRef.current) return
    const animate = () => {
      const canvas = effectsCanvasRef.current
      if (!canvas || !containerRef.current) { effectsAnimRef.current = 0; return }
      const ctx = canvas.getContext('2d')
      if (!ctx) { effectsAnimRef.current = 0; return }
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
      if (ps.length > 0) effectsAnimRef.current = requestAnimationFrame(animate)
      else effectsAnimRef.current = 0
    }
    effectsAnimRef.current = requestAnimationFrame(animate)
  }

  // Emit a small ring of particles centered on a card.
  const burst = (cardRef: HTMLDivElement | null, side: 'left' | 'right', emoji: string, count: number, baseSize: number, spread: number) => {
    if (!containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    let cx: number, cy: number
    if (cardRef) {
      const r = cardRef.getBoundingClientRect()
      cx = r.left - containerRect.left + r.width / 2
      cy = r.top - containerRect.top + r.height / 2
    } else {
      cx = side === 'left' ? containerRect.width * 0.25 : containerRect.width * 0.75
      cy = containerRect.height * 0.4
    }
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.8
      const speed = 0.7 + Math.random() * spread
      particlesRef.current.push({
        emoji, x: cx + (Math.random() - 0.5) * 28, y: cy + (Math.random() - 0.5) * 22,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.5,
        size: baseSize + Math.random() * 8, age: 0,
        rotation: Math.random() * 360, rs: (Math.random() - 0.5) * 5,
      })
    }
  }

  // Spawn celebration/impact particles on result (once)
  if ((phase === 'result') && large && !spawnedRef.current) {
    spawnedRef.current = true
    requestAnimationFrame(() => {
      const win = (cardRef: HTMLDivElement | null, side: 'left' | 'right', damage: number) =>
        burst(cardRef, side, '🎉', Math.min(damage * 3, 18), 20, 1.2)
      const hit = (cardRef: HTMLDivElement | null, side: 'left' | 'right', damage: number) =>
        burst(cardRef, side, '💥', Math.min(damage * 3, 18), 20, 1.2)
      if (fo.damage2 > 0) { win(card1DivRef.current, 'left', fo.damage2); hit(card2DivRef.current, 'right', fo.damage2) }
      else if (fo.damage1 > 0) { win(card2DivRef.current, 'right', fo.damage1); hit(card1DivRef.current, 'left', fo.damage1) }
      ensureLoop()
    })
  }

  // Spawn skill-fire sparkles when a traced skill change applies at its phase.
  if (large && faceOff.activations && faceOff.activations.length > 0) {
    for (const a of faceOff.activations) {
      for (const ch of a.changes) {
        if (FIELD_PHASE[ch.field] !== phase) continue
        const key = `${ch.side}:${ch.field}:${a.effectId}`
        if (skillFiredRef.current.has(key)) continue
        skillFiredRef.current.add(key)
        const emoji = KIND_META[FIELD_KIND[ch.field]]?.emoji ?? '✨'
        const cardRef = ch.side === 1 ? card1DivRef.current : card2DivRef.current
        const sideStr = ch.side === 1 ? 'left' : 'right'
        requestAnimationFrame(() => { burst(cardRef, sideStr, emoji, 16, 18, 1.3); ensureLoop() })
      }
    }
  }

  const enterAnim1 = vertical ? 'animate-[slideFromTop_0.4s_ease-out]' : 'animate-[slideFromLeft_0.4s_ease-out]'
  const enterAnim2 = vertical ? 'animate-[slideFromBottom_0.4s_ease-out]' : 'animate-[slideFromRight_0.4s_ease-out]'
  const knockP1 = vertical ? 'opacity-40 scale-90 -translate-y-3' : 'opacity-40 scale-90 translate-x-3'
  const knockP2 = vertical ? 'opacity-40 scale-90 translate-y-3' : 'opacity-40 scale-90 -translate-x-3'

  const PHASE_ORDER: Phase[] = ['enter', 'power', 'rolling', 'merge', 'result', 'done']
  const phaseReached = (target: Phase) => PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf(target)

  const rarityChip = (rarity: string) => (
    <span className={rarityTextColor[rarity] ?? 'text-zinc-300'}>{rarityLabel[rarity] ?? rarity}</span>
  )

  // Effect kinds that have fired on a side so far — drives the card aura + shake.
  const firedKinds = (side: 1 | 2): EffectKind[] => {
    const acts = faceOff.activations
    if (!large || !acts) return []
    const out: EffectKind[] = []
    for (const a of acts) for (const ch of a.changes) {
      if (ch.side !== side || !phaseReached(FIELD_PHASE[ch.field])) continue
      out.push(FIELD_KIND[ch.field])
    }
    return out
  }
  const auraStyle = (side: 1 | 2): { boxShadow?: string } => {
    const kinds = firedKinds(side)
    if (kinds.length === 0) return {}
    return { boxShadow: `0 0 22px 3px rgba(${KIND_META[kinds[kinds.length - 1]].glow}, 0.55)` }
  }
  // A damage-kind effect jolts the whole face-off.
  const shouldShake = ([1, 2] as const).some((s) => firedKinds(s).some((k) => KIND_META[k].shake))

  // Floating skill-effect labels above a card, derived from the activation trace:
  // each change shows its skill name + value transition, appearing at its phase.
  // Cyan treatment for synergies, matching the card Type chips.
  const SYNERGY_TINT = 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100'
  const SYNERGY_GLOW = '34,211,238'

  const renderEffects = (side: 1 | 2) => {
    const acts = faceOff.activations
    if (!large || !acts || acts.length === 0) return null
    type Entry = { key: string; name: string; label: string; isSynergy: boolean; kind: EffectKind; phase: Phase; before: number | string; after: number | string }
    const entries: Entry[] = []
    for (const a of acts) {
      const isSynergy = a.skillId.startsWith('synergy:')
      // "Egg Roll in effect" for synergies; "Player used Double Edge" for skills.
      const who = a.activatedBy ? (playerNames?.[a.activatedBy] ?? '') : ''
      const label = isSynergy ? `${a.skillName} in effect` : who ? `${who} used ${a.skillName}` : `${a.skillName}`
      for (const ch of a.changes) {
        if (ch.side !== side) continue
        // Dice and extra dice are shown inline in DiceBreakdown (with labels), so
        // don't duplicate them as floating chips.
        if (ch.field === 'roll' || ch.field === 'bonusRoll') continue
        entries.push({ key: `${a.effectId}:${ch.field}`, name: a.skillName, label, isSynergy, kind: FIELD_KIND[ch.field], phase: FIELD_PHASE[ch.field], before: ch.before, after: ch.after })
      }
    }
    const shown = entries.filter((e) => phaseReached(e.phase))
    if (shown.length === 0) return null
    return (
      <div className="pointer-events-none absolute left-1/2 top-0 z-20 flex w-max -translate-x-1/2 -translate-y-[calc(100%+0.25rem)] flex-col items-center gap-1">
        {shown.map((e, i) => {
          const tint = e.isSynergy ? SYNERGY_TINT : KIND_META[e.kind].tint
          const glow = e.isSynergy ? SYNERGY_GLOW : KIND_META[e.kind].glow
          const emoji = e.isSynergy ? '🔗' : KIND_META[e.kind].emoji
          return (
          <span key={e.key} data-testid="skill-effect" data-skill={e.name} data-kind={e.kind} data-synergy={e.isSynergy ? 'true' : 'false'}
            style={{ animationDelay: `${i * 70}ms`, boxShadow: `0 0 16px -2px rgba(${glow}, 0.7)` }}
            className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm animate-[skillPop_0.45s_cubic-bezier(0.34,1.56,0.64,1)_both] ${tint}`}>
            <span>{emoji} {e.label}</span>
            {e.kind === 'rarity' ? (
              <span className="font-normal">{rarityChip(e.before as string)} → {rarityChip(e.after as string)}</span>
            ) : (
              <span className="font-mono"><span className="opacity-50">{e.before}</span>→<CountTo from={e.before as number} to={e.after as number} className={(e.after as number) >= (e.before as number) ? 'text-green-300' : 'text-red-300'} /></span>
            )}
          </span>
          )
        })}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative flex flex-col items-center gap-2 ${shouldShake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
    <canvas ref={effectsCanvasRef} className="absolute inset-0 pointer-events-none z-10" />
    <div className={`flex justify-center ${vertical ? 'flex-col items-center gap-4' : 'items-start gap-3 sm:gap-6'}`}>
      <div className={`relative flex ${vertical ? 'flex-row items-center gap-3' : 'flex-col items-center gap-1'} transition-all duration-500 ${
        phase === 'enter' ? enterAnim1 : ''
      } ${phase === 'result' || phase === 'done' ? (p2Won ? knockP1 : p1Won ? 'scale-105' : '') : ''}`}>
        {renderEffects(1)}
        <div ref={card1DivRef} className={`${cardSize} rounded-xl transition-shadow duration-300 ${large ? 'card-shadow-lg' : 'card-shadow'} ${phase === 'enter' ? (large ? 'animate-[cardEnterLeft_0.5s_ease-out_forwards]' : '') : (large ? 'animate-[wobbleLeft_3s_ease-in-out_infinite]' : '')}`} style={{ ...(!large ? { transform: 'rotate(2deg)' } : {}), ...(cardFilter ? { filter: cardFilter } : {}), ...auraStyle(1) }}><CompactCard card={fo.card1} /></div>
        <div className={`flex flex-col ${vertical ? 'items-start' : 'items-center'} gap-1 transition-opacity duration-300 ${phase === 'enter' ? 'opacity-0' : 'opacity-100'}`}>
          <DiceBreakdown phase={phase} rollElapsed={rollElapsed} star={fo.star1} dice={diceFor(1)} effective={fo.effective1} large={large} />
        </div>
      </div>

      {/* Box matches the card's height (aspect-3/4 → width×4/3) so the sword
          stays centered on the cards while the row is top-aligned and the
          per-card roll captions grow downward without shifting anything. */}
      <div className={`flex shrink-0 items-center justify-center ${vertical ? '' : large ? 'h-[149px] sm:h-[170px]' : 'h-[85px]'}`}>
        <span className={`${large ? 'text-xl' : 'text-sm'} font-black text-zinc-700`}>⚔️</span>
      </div>

      <div className={`relative flex ${vertical ? 'flex-row items-center gap-3' : 'flex-col items-center gap-1'} transition-all duration-500 ${
        phase === 'enter' ? enterAnim2 : ''
      } ${phase === 'result' || phase === 'done' ? (p1Won ? knockP2 : p2Won ? 'scale-105' : '') : ''}`}>
        {renderEffects(2)}
        <div ref={card2DivRef} className={`${cardSize} rounded-xl transition-shadow duration-300 ${large ? 'card-shadow-lg' : 'card-shadow'} ${phase === 'enter' ? (large ? 'animate-[cardEnterRight_0.5s_ease-out_forwards]' : '') : (large ? 'animate-[wobbleRight_3s_ease-in-out_infinite]' : '')}`} style={{ ...(!large ? { transform: 'rotate(-2deg)' } : {}), ...(cardFilter ? { filter: cardFilter } : {}), ...auraStyle(2) }}><CompactCard card={fo.card2} /></div>
        <div className={`flex flex-col ${vertical ? 'items-start' : 'items-center'} gap-1 transition-opacity duration-300 ${phase === 'enter' ? 'opacity-0' : 'opacity-100'}`}>
          <DiceBreakdown phase={phase} rollElapsed={rollElapsed} star={fo.star2} dice={diceFor(2)} effective={fo.effective2} large={large} />
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
        @keyframes skillPop { 0% { transform: translateY(6px) scale(0.6); opacity: 0; } 60% { transform: translateY(-2px) scale(1.08); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
      `}</style>
    </div>
  )
}
