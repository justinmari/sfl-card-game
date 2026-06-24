import { ownedEditionsRarestFirst, EDITION_DOT, EDITION_LABEL, type EditionCounts } from '@/lib/editions'

/**
 * Top-right stack of per-edition owned counts, rarest finish on top. Holo
 * finishes always show when owned; the plain regular count shows only when >1
 * (a lone regular isn't worth a badge). Pointer-events-none so it never blocks
 * clicks on the card beneath.
 */
export default function HoloCountBadges({ counts }: { counts: EditionCounts }) {
  const editions = ownedEditionsRarestFirst(counts).filter(
    (e) => e !== 'regular' || (counts.regular ?? 0) > 1
  )
  if (editions.length === 0) return null

  return (
    <div className="pointer-events-none absolute right-1 top-1 z-10 flex flex-col items-end gap-0.5">
      {editions.map((e) => (
        <span
          key={e}
          title={EDITION_LABEL[e]}
          className="flex items-center gap-1 rounded-full bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${EDITION_DOT[e]}`} aria-hidden />×{counts[e]}
        </span>
      ))}
    </div>
  )
}
