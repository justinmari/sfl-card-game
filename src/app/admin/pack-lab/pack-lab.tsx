'use client'

import { useEffect, useRef, useState } from 'react'
import SwipeableReveal from '@/components/swipeable-reveal'
import SlicePack, { SLICE_CUTY, SLICE_TOTALH, RARITY_RGB, GOLD_RGB } from '@/components/slice-pack'
import { RARITIES } from '@/lib/rarities'
import { useRip, type Pack, type LabCard } from './pack-lab-shared'

const rarityRank = (r: string) => {
  const i = RARITIES.findIndex((x) => x.value === r)
  return i === -1 ? RARITIES.length : i
}

export default function PackLab({ packs, cards }: { packs: Pack[]; cards: LabCard[] }) {
  const [packId, setPackId] = useState<string>(packs[0]?.id ?? '')
  const pack = packs.find((p) => p.id === packId) ?? packs[0]
  const [open, setOpen] = useState(false)
  const [revealCards, setRevealCards] = useState<LabCard[]>([])

  const openPull = () => {
    if (!cards.length) return
    setRevealCards(Array.from({ length: 5 }, () => cards[Math.floor(Math.random() * cards.length)]).filter(Boolean))
    setOpen(true)
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-400">
        Press <span className="text-white">Open</span> to start a pull — the screen darkens and the pack appears (hover for the tilt). Flick across
        the top to rip it: the top pops off, the bottom drops away, and the cards behind flip into the normal reveal. Uses the same
        animation as the live shop; isolated here for tweaking.
      </p>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-zinc-900/60 p-4 text-sm">
        <button onClick={openPull} disabled={!cards.length} className="btn-arcade rounded-lg px-4 py-2 text-sm disabled:opacity-40">
          Open 5 random cards
        </button>
        <label className="flex items-center gap-2">
          <span className="text-zinc-400">Pack</span>
          <select value={packId} onChange={(e) => setPackId(e.target.value)} className="rounded-md border border-white/10 bg-zinc-800 px-2 py-1">
            {packs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {!cards.length && <span className="text-zinc-500">No sample cards available.</span>}
      </div>

      {open && <PackOpen pack={pack} cards={revealCards} onDone={() => setOpen(false)} />}
    </div>
  )
}

/** The full pull overlay: darkened screen, the pack on top (swipe to rip), and
 *  the real flip/swipe reveal behind it (revealed as the pack tears away). */
function PackOpen({ pack, cards, onDone }: { pack?: Pack; cards: LabCard[]; onDone: () => void }) {
  const rip = useRip()
  const [packGone, setPackGone] = useState(false)
  const rarest = cards.reduce((r, c) => (rarityRank(c.rarity) > rarityRank(r) ? c.rarity : r), cards[0]?.rarity ?? '')
  const packRgb = RARITY_RGB[rarest] ?? GOLD_RGB

  useEffect(() => {
    if (!rip.done) return
    const t = setTimeout(() => setPackGone(true), 480)
    return () => clearTimeout(t)
  }, [rip.done])

  return (
    <div className="fixed inset-0 z-50">
      {/* darken */}
      <div className="absolute inset-0 bg-black/90" />
      {/* cards behind — mounted as the pack rips, revealed as it tears away */}
      {rip.done && <SwipeableReveal coverless cards={cards} cardsPerPack={5} packName={pack?.name} packImage={pack?.image_url} onDone={onDone} />}
      {/* the pack, on top */}
      {!packGone && (
        <div className="absolute inset-0 z-[60] flex touch-none select-none items-center justify-center" style={{ cursor: rip.done ? 'default' : 'grab' }} {...rip.handlers}>
          <TiltPack pack={pack} tear={rip.tear} dir={rip.dir} dragging={rip.dragging} done={rip.done} rgb={packRgb} />
        </div>
      )}

      {/* Soft full-screen-width flash of light at the slice height, on commit */}
      {rip.done && (
        <div
          className="pack-screen-flash pointer-events-none absolute inset-x-0 z-[70]"
          style={{
            top: `calc(50% + ${SLICE_CUTY - SLICE_TOTALH / 2}px)`,
            height: 180,
            background: `linear-gradient(to bottom, transparent 0%, rgba(${packRgb[0]},${packRgb[1]},${packRgb[2]},0.85) 34%, rgba(255,255,250,1) 50%, rgba(${packRgb[0]},${packRgb[1]},${packRgb[2]},0.85) 66%, transparent 100%)`,
            filter: 'blur(2px) brightness(1.5)',
          }}
        />
      )}
    </div>
  )
}

/** Wraps the shared SlicePack with the lab's hover-tilt for preview. */
function TiltPack({ pack, tear, dir, dragging, done, rgb }: { pack?: Pack; tear: number; dir: number; dragging: boolean; done: boolean; rgb: [number, number, number] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  const [hover, setHover] = useState(false)
  const tiltOn = hover && !dragging && !done

  const onMove = (e: React.MouseEvent) => {
    if (!tiltOn || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    setTilt({ rx: (0.5 - y) * 12, ry: (x - 0.5) * 12 })
  }

  const tiltT = tiltOn ? `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(1.03)` : 'rotateX(0deg) rotateY(0deg)'

  return (
    <div ref={ref} style={{ perspective: '1100px' }} onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setTilt({ rx: 0, ry: 0 }) }} onMouseMove={onMove}>
      <div style={{ transformStyle: 'preserve-3d', transform: tiltT, transition: tiltOn ? 'transform 0.1s ease-out' : 'transform 0.4s ease-out' }}>
        <SlicePack name={pack?.name} image={pack?.image_url} price={pack?.price} createdAt={pack?.created_at} rgb={rgb} tear={tear} dir={dir} done={done} />
      </div>
    </div>
  )
}
