'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid } from 'lucide-react'
import { ADMIN_NAV } from './admin-nav'

/**
 * Persistent left nav for the admin panel: a sticky left rail on lg+ screens.
 * Hidden on mobile — there the admin landing page's bento grid is the hub, so a
 * stacked sidebar would just duplicate it (and sit awkwardly above the navbar).
 */
export default function AdminSidebar({ pendingSuggestions = 0 }: { pendingSuggestions?: number }) {
  const pathname = usePathname()

  return (
    <aside className="hidden shrink-0 border-r border-white/10 bg-zinc-950/40 lg:block lg:w-60" data-testid="admin-sidebar">
      <div className="sticky top-0 max-h-screen overflow-y-auto p-4">
        <Link
          href="/admin"
          className={`mb-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-bold transition-colors ${
            pathname === '/admin' ? 'text-amber-400' : 'text-white hover:text-amber-300'
          }`}
        >
          <LayoutGrid className="h-4 w-4" /> Admin Panel
        </Link>

        {ADMIN_NAV.map((group) => (
          <div key={group.label} className="mb-4">
            <h3 className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{group.label}</h3>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                      active ? 'bg-amber-500/15 font-medium text-amber-300' : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                    {item.href === '/admin/suggestions' && pendingSuggestions > 0 && (
                      <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-black">{pendingSuggestions}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
