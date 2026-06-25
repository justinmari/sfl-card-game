import AppNavbar from '@/components/app-navbar'
import DashTile from '@/components/dash-tile'
import { ADMIN_NAV } from '@/components/admin/admin-nav'

// Access is gated by admin/layout.tsx (admins only).
export default function AdminPage() {
  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Admin Panel" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="font-display mb-1 text-2xl font-bold tracking-tight">Admin Panel</h2>
        <p className="mb-8 text-sm text-zinc-400">
          Manage cards, packs, game systems, and players. Jump into any section below.
        </p>

        {ADMIN_NAV.map((group) => (
          <div key={group.label} className="mb-8">
            <h3 className="font-display mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-amber-400">
              <span className="h-px w-6 flex-none bg-gradient-to-r from-amber-500 to-transparent" />
              {group.label}
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {group.items.map((item) => (
                <DashTile key={item.href} href={item.href} icon={item.icon} title={item.label} subtitle={item.subtitle} accent="amber" />
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
