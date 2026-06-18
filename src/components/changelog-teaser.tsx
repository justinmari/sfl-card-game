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
      className="surface group mt-10 block rounded-2xl p-5 transition-colors hover:bg-white/5"
    >
      <div className="mb-2 flex items-center gap-2">
        <ScrollText className="h-4 w-4 flex-none text-violet-400" />
        <span className="font-display text-[11px] font-bold uppercase tracking-widest text-violet-400">
          What&apos;s new
        </span>
        {entry.version && (
          <span className="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
            v{entry.version}
          </span>
        )}
      </div>
      <h3 className="text-sm font-bold text-white">{entry.title}</h3>
      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-zinc-400">{entry.content}</p>
      <span className="mt-3 inline-block text-xs font-medium text-violet-400 group-hover:text-violet-300">
        View full changelog →
      </span>
    </Link>
  )
}
