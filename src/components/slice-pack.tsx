'use client'

// A booster pack that's sliced open: a glowing spark travels the cut leaving a
// trail, rays fan out from along the rip, particles rise from it, and on commit
// the top crimp pops up while the body drops away. Used by the shop reveal.
// Drive it with `tear` 0→1 (the swipe) and `done` (commit).

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** Rarity → ray/glow colour. Rarest card in a pack tints the whole effect. */
export const RARITY_RGB: Record<string, [number, number, number]> = {
  common: [219, 222, 232],
  uncommon: [74, 222, 128],
  rare: [96, 165, 250],
  ultra_rare: [150, 80, 255], // blue-violet
  legendary: [255, 190, 80],
  secret_rare: [255, 45, 120], // hot magenta-pink
}
export const GOLD_RGB: [number, number, number] = [255, 205, 95]

/** Holo finish → solid ray colour. Galaxy uses a rainbow spectrum (below). */
const HOLO_SOLID: Record<string, [number, number, number]> = {
  golden: [255, 205, 95], // gold
  diamond: [80, 165, 255], // azure-blue
}
/** Galaxy ray spectrum, red → violet, cycled across the burst rays. */
const GALAXY_SPECTRUM: [number, number, number][] = [
  [255, 70, 70], // red
  [255, 150, 40], // orange
  [255, 230, 70], // yellow
  [80, 220, 100], // green
  [80, 150, 255], // blue
  [180, 100, 255], // violet
]

/** Aura-bloom backgrounds: a single symmetric radial glow per finish (galaxy is
 *  a concentric rainbow halo). Centred — not the card's off-centre nebula. */
const AURA_FLASH_BG: Record<string, string> = {
  golden: 'radial-gradient(circle, rgba(255,228,150,0.95), rgba(255,195,80,0.55) 42%, transparent 70%)',
  diamond: 'radial-gradient(circle, rgba(200,228,255,0.95), rgba(70,150,255,0.6) 42%, transparent 70%)',
  galaxy:
    'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(180,100,255,0.7) 16%, rgba(80,150,255,0.6) 32%, rgba(80,220,100,0.55) 48%, rgba(255,230,70,0.55) 63%, rgba(255,150,40,0.5) 78%, rgba(255,70,70,0.45) 90%, transparent 100%)',
}

export const SLICE_PACKW = 340
const IMGH = 524
const ZIGH = Math.round((SLICE_PACKW * 12) / 208)
export const SLICE_TOTALH = ZIGH * 2 + IMGH + 2
export const SLICE_CUTY = ZIGH + 46 // top crimp that pops off
const ZIG =
  'M0,12 L8,4 L16,10 L24,2 L32,9 L40,3 L48,10 L56,2 L64,8 L72,3 L80,10 L88,2 L96,9 L104,3 L112,10 L120,2 L128,8 L136,3 L144,10 L152,2 L160,9 L168,3 L176,10 L184,2 L192,8 L200,3 L208,12 Z'

// Sparkler orbs that fly off the spark head.
const SPARK_BITS = Array.from({ length: 9 }, (_, i) => {
  const a = (i / 9) * Math.PI * 2 + 0.3
  const dist = 18 + (i % 3) * 10
  return { tx: Math.round(Math.cos(a) * dist), ty: Math.round(Math.sin(a) * dist + 8), dur: 0.42 + (i % 3) * 0.16, delay: i * 0.05 }
})

// Rays whose origins span the rip; each leans outward, lighting up as the cut reaches it.
const RAY_COUNT = 22
const RAYS = Array.from({ length: RAY_COUNT }, (_, i) => {
  const fx = i / (RAY_COUNT - 1)
  return { x: 8 + fx * (SLICE_PACKW - 16), angle: (fx - 0.5) * 54, len: 250 + (i % 4) * 60 }
})

// Radial burst of holo rays fired the instant the pack pops open — a long full
// 360° sunburst from the centre of the pack, sitting behind it alongside an
// aura bloom. Lengths vary for a spiky spread; for galaxy each ray takes the
// next spectrum colour (count is a multiple of 6).
const HOLO_RAY_COUNT = 12
const HOLO_RAYS = Array.from({ length: HOLO_RAY_COUNT }, (_, i) => ({
  angle: (i / HOLO_RAY_COUNT) * 360,
  len: 560 + (i % 4) * 120,
  delay: (i % 3) * 0.03,
}))

// Particles that emerge along the cut as the spark passes over them.
const PART_COUNT = 22
const PARTS = Array.from({ length: PART_COUNT }, (_, i) => ({
  x: 10 + (i / (PART_COUNT - 1)) * (SLICE_PACKW - 20),
  dur: 0.85 + (i % 4) * 0.28,
  delay: (i * 0.11) % 1.2,
  drift: ((i % 5) - 2) * 13,
}))

/** The PackWrapper-styled pack face: serrated edges, art, NEW badge, name/price/date. */
function PackContent({ name, image, price, createdAt }: { name?: string; image?: string | null; price?: number | null; createdAt?: string | null }) {
  const isNew = createdAt ? Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000 : false
  return (
    <div style={{ width: SLICE_PACKW }}>
      <svg viewBox="0 0 208 12" className="w-full" preserveAspectRatio="none" aria-hidden>
        <path d={ZIG} className="fill-zinc-800" />
      </svg>
      <div className="relative overflow-hidden bg-zinc-800">
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-white/[0.06] via-transparent to-white/[0.04]" />
        <div className="relative" style={{ height: IMGH }}>
          {image ? (
            <img src={image} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-zinc-700 to-zinc-800 text-7xl opacity-40">🃏</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          {isNew && <div className="absolute right-3 top-3 z-20 rounded bg-red-500 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-lg">New!</div>}
          <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
            <h3 className="font-display text-2xl font-bold text-white drop-shadow-lg">{name}</h3>
            <div className="flex items-center gap-2">
              {price != null && <span className="text-lg font-semibold text-amber-400">{price} G</span>}
              {createdAt && <span className="text-xs text-zinc-300">{new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
            </div>
          </div>
        </div>
        <div className="h-[2px] bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
      </div>
      <svg viewBox="0 0 208 12" className="w-full rotate-180" preserveAspectRatio="none" aria-hidden>
        <path d={ZIG} className="fill-zinc-800" />
      </svg>
    </div>
  )
}

export default function SlicePack({
  name,
  image,
  price,
  createdAt,
  tear,
  dir,
  done,
  rgb = GOLD_RGB,
  holo = null,
}: {
  name?: string
  image?: string | null
  price?: number | null
  createdAt?: string | null
  tear: number
  dir: number
  done: boolean
  /** Ray/glow tint — set from the rarest card in the pack. */
  rgb?: [number, number, number]
  /** Highest holo finish in the pack — fires an extra coloured ray burst on open. */
  holo?: 'golden' | 'diamond' | 'galaxy' | null
}) {
  const topT = done ? `translateY(-${SLICE_CUTY + 110}px) rotate(${dir * 5}deg)` : 'translateY(0px)'
  const botT = done ? `translateY(${SLICE_TOTALH + 90}px)` : 'translateY(0px)'
  const sparkX = dir >= 0 ? tear * SLICE_PACKW : SLICE_PACKW - tear * SLICE_PACKW
  const cut = tear * SLICE_PACKW
  const [cr, cg, cb] = rgb
  const glow = (a: number) => `rgba(${cr},${cg},${cb},${a})`

  return (
    <div className="relative" style={{ width: SLICE_PACKW, height: SLICE_TOTALH, filter: 'drop-shadow(0 22px 34px rgba(0,0,0,0.55))' }}>
      {/* body that drops away */}
      <div
        className="absolute overflow-hidden"
        style={{ left: 0, top: SLICE_CUTY, width: SLICE_PACKW, height: SLICE_TOTALH - SLICE_CUTY, transform: botT, opacity: done ? 0 : 1, transition: done ? 'transform 0.45s cubic-bezier(0.4,0,0.6,1), opacity 0.45s ease-in' : 'transform 0.25s ease-out', zIndex: 1 }}
      >
        <div style={{ position: 'absolute', top: -SLICE_CUTY, left: 0 }}>
          <PackContent name={name} image={image} price={price} createdAt={createdAt} />
        </div>
      </div>

      {/* top crimp that pops off */}
      <div
        className="absolute overflow-hidden"
        style={{ left: 0, top: 0, width: SLICE_PACKW, height: SLICE_CUTY, transform: topT, opacity: done ? 0 : 1, transition: done ? 'transform 0.3s ease-out, opacity 0.3s ease-out' : 'transform 0.25s ease-out', zIndex: 2 }}
      >
        <PackContent name={name} image={image} price={price} createdAt={createdAt} />
      </div>

      {/* Rays fan up from along the rip; particles emerge as the spark passes */}
      {tear > 0 && (
        <div className="pointer-events-none absolute inset-0" style={{ zIndex: 4 }}>
          {RAYS.map((r, i) => {
            const passed = dir >= 0 ? clamp01((cut - r.x) / 28) : clamp01((r.x - (SLICE_PACKW - cut)) / 28)
            return (
              <div
                key={`ray-${i}`}
                style={{
                  position: 'absolute',
                  left: r.x,
                  top: SLICE_CUTY,
                  width: 18,
                  height: r.len,
                  transformOrigin: 'bottom center',
                  transform: `translate(-50%, -100%) rotate(${r.angle}deg)`,
                  background: `linear-gradient(to top, rgba(255,253,245,1), ${glow(0.72)} 40%, transparent)`,
                  filter: 'blur(2px) brightness(1.45)',
                  opacity: done ? 0 : passed,
                  transition: 'opacity 0.16s ease-out',
                }}
              />
            )
          })}
          {PARTS.map((p, i) => {
            const passed = dir >= 0 ? clamp01((cut - p.x) / 26) : clamp01((p.x - (SLICE_PACKW - cut)) / 26)
            return (
              <div key={`part-${i}`} style={{ position: 'absolute', left: p.x, top: SLICE_CUTY, opacity: done ? 0 : passed, transition: 'opacity 0.15s ease-out' }}>
                <span
                  className="pack-part"
                  style={
                    {
                      position: 'absolute',
                      height: 7,
                      width: 7,
                      borderRadius: '9999px',
                      background: '#fff',
                      boxShadow: `0 0 9px 3px ${glow(0.95)}`,
                      ['--dur' as string]: `${p.dur}s`,
                      ['--drift' as string]: `${p.drift}px`,
                      animationDelay: `${p.delay}s`,
                    } as React.CSSProperties
                  }
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Holo flash: a soft aura bloom + a few long rays directly behind the
          pack's centre, revealed as it splits open and fading fast. Coloured by
          the rarest holo finish in the pack (gold / azure / galaxy rainbow). */}
      {done && holo && (
        <div className="pointer-events-none absolute" style={{ left: SLICE_PACKW / 2, top: SLICE_TOTALH / 2, zIndex: 0 }}>
          <div
            className="pack-aura-flash"
            style={{ left: 0, top: 0, width: 860, height: 860, background: AURA_FLASH_BG[holo] }}
          />
          {HOLO_RAYS.map((r, i) => {
            const [hr, hg, hb] = holo === 'galaxy' ? GALAXY_SPECTRUM[i % GALAXY_SPECTRUM.length] : HOLO_SOLID[holo]
            return (
              <div key={`holo-ray-${i}`} style={{ position: 'absolute', left: 0, top: 0, transform: `rotate(${r.angle}deg)` }}>
                <div
                  className="holo-ray"
                  style={{
                    position: 'absolute',
                    left: -22,
                    bottom: 0,
                    width: 44,
                    height: r.len,
                    transformOrigin: 'bottom center',
                    background: `linear-gradient(to top, rgba(255,255,255,0.95), rgba(${hr},${hg},${hb},0.85) 38%, transparent)`,
                    filter: 'blur(1.5px) brightness(1.5)',
                    animationDelay: `${r.delay}s`,
                  }}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Blazing trail behind the spark; flares then vanishes fast on commit */}
      {tear > 0 && (
        <div
          className={`pointer-events-none absolute ${done ? 'tear-flash' : ''}`}
          style={{
            top: SLICE_CUTY - 2.5,
            [dir >= 0 ? 'left' : 'right']: 0,
            width: done ? SLICE_PACKW : tear * SLICE_PACKW,
            height: 5,
            background: `linear-gradient(${dir >= 0 ? 'to right' : 'to left'}, rgba(255,252,240,0.7), #ffffff)`,
            boxShadow: `0 0 28px 9px rgba(255,250,235,1), 0 0 60px 22px ${glow(0.92)}, 0 0 90px 36px ${glow(0.5)}`,
            borderRadius: 3,
            zIndex: 3,
          }}
        />
      )}
      {/* Sparkler head + flying orbs; fades fast once swipe commits */}
      {tear > 0 && (
        <div className="pointer-events-none absolute" style={{ top: SLICE_CUTY, left: sparkX, zIndex: 5, opacity: done ? 0 : 1, transition: 'opacity 0.15s ease-out', filter: 'brightness(1.3)' }}>
          <div
            className="tear-spark absolute left-0 top-0"
            style={{ height: 26, width: 26, borderRadius: '9999px', background: 'radial-gradient(circle, #fff 0%, #fff 32%, #fff0b0 56%, transparent 72%)', boxShadow: `0 0 34px 16px rgba(255,255,245,1), 0 0 70px 30px ${glow(0.95)}, 0 0 110px 48px ${glow(0.5)}` }}
          />
          {SPARK_BITS.map((b, i) => (
            <span
              key={i}
              className="pack-spark-bit absolute left-0 top-0 h-2 w-2 rounded-full bg-white"
              style={
                {
                  boxShadow: `0 0 14px 5px rgba(255,244,180,1), 0 0 24px 9px ${glow(0.8)}`,
                  ['--tx' as string]: `${b.tx}px`,
                  ['--ty' as string]: `${b.ty}px`,
                  ['--dur' as string]: `${b.dur}s`,
                  animationDelay: `${b.delay}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
