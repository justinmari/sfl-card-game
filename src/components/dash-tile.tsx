import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

type Accent = 'violet' | 'red' | 'amber'

// Icon-chip gradient + ring per accent
const chipClasses: Record<Accent, string> = {
  violet: 'from-violet-500/25 to-fuchsia-500/15 text-violet-200 ring-violet-400/30',
  red: 'from-red-500/25 to-orange-500/15 text-red-200 ring-red-400/30',
  amber: 'from-amber-500/25 to-orange-500/15 text-amber-200 ring-amber-400/30',
}

// Hover glow per accent (defined in globals.css)
const hoverClasses: Record<Accent, string> = {
  violet: 'tile-arcade',
  red: 'tile-arcade tile-red',
  amber: 'tile-arcade tile-amber',
}

export default function DashTile({
  href,
  icon: Icon,
  title,
  subtitle,
  accent = 'violet',
  hero = false,
  disabled = false,
  tooltip,
  badge,
  testId,
  className = '',
}: {
  href?: string
  icon: LucideIcon
  title: string
  subtitle?: string
  accent?: Accent
  hero?: boolean
  disabled?: boolean
  tooltip?: string
  badge?: React.ReactNode
  testId?: string
  className?: string
}) {
  const base = `group relative flex h-full flex-col rounded-2xl ${
    hero ? 'justify-between gap-4 p-6' : 'gap-3 p-5'
  } ${disabled ? 'tile-arcade cursor-not-allowed opacity-40' : hoverClasses[accent]} ${className}`

  const content = (
    <>
      <span
        className={`relative flex items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ${
          hero ? 'h-14 w-14' : 'h-11 w-11'
        } ${chipClasses[accent]}`}
      >
        <Icon className={hero ? 'h-7 w-7' : 'h-5 w-5'} strokeWidth={2} aria-hidden />
        {badge}
      </span>

      <div className="min-w-0">
        <p className={`font-display font-semibold leading-tight ${hero ? 'text-xl' : 'text-sm'}`}>{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-zinc-400">{subtitle}</p>}
      </div>

      {hero && !disabled && (
        <span
          aria-hidden
          className="absolute right-5 top-5 text-lg text-zinc-500 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-200"
        >
          →
        </span>
      )}

      {tooltip && (
        <span className="pointer-events-none absolute -bottom-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100">
          {tooltip}
        </span>
      )}
    </>
  )

  if (disabled || !href) {
    return (
      <div data-testid={testId} className={base}>
        {content}
      </div>
    )
  }

  return (
    <Link href={href} data-testid={testId} className={base}>
      {content}
    </Link>
  )
}
