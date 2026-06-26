import Link from 'next/link'
import { ScrollText } from 'lucide-react'

type ChangelogEntry = {
  version: string | null
  title: string
  content: string
  created_at: string
}

/** Dashboard "what's new" teaser: shows the latest changelog entry with a
 *  truncated snippet and a link to the full changelog. */
export default function ChangelogTeaser({ entry }: { entry: ChangelogEntry }) {
  return (
    <Link
      href="/changelog"
      data-testid="changelog-teaser"
      className="surface group block rounded-xl px-4 py-3 transition-colors hover:bg-white/5"
    >
      <div className="flex items-center gap-2">
        <ScrollText className="h-3.5 w-3.5 flex-none text-violet-400" />
        <span className="font-display text-[10px] font-bold uppercase tracking-widest text-violet-400">
          What&apos;s new
        </span>
        {entry.version && (
          <span className="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
            v{entry.version}
          </span>
        )}
      </div>
      <h3 className="mt-1 flex items-center gap-1.5 text-sm font-bold text-white">
        <span className="truncate">{entry.title}</span>
        <span className="flex-none text-violet-400 transition-transform group-hover:translate-x-0.5">→</span>
      </h3>
    </Link>
  )
}
