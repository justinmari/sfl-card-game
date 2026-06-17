'use client'

// Numbered page controls (Prev / 1 … N / Next) with a windowed set of numbers
// around the current page. Renders nothing for a single page.
export default function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number
  pageCount: number
  onPage: (p: number) => void
}) {
  if (pageCount <= 1) return null

  const win = 2
  const pages: number[] = []
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || (p >= page - win && p <= page + win)) pages.push(p)
  }

  const btn = 'min-w-[2rem] rounded-lg border border-white/10 px-2.5 py-1.5 text-sm transition-colors'

  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5" data-testid="pagination">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={`${btn} text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30`}>
        Prev
      </button>
      {pages.map((p, i) => {
        const prev = pages[i - 1]
        return (
          <span key={p} className="flex items-center gap-1.5">
            {prev && p - prev > 1 && <span className="px-0.5 text-zinc-600">…</span>}
            <button
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`${btn} ${p === page ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold text-white shadow-[0_0_10px_-2px_rgba(167,139,250,0.6)]' : 'text-zinc-300 hover:bg-white/5'}`}
            >
              {p}
            </button>
          </span>
        )
      })}
      <button type="button" disabled={page >= pageCount} onClick={() => onPage(page + 1)} className={`${btn} text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30`}>
        Next
      </button>
    </div>
  )
}
