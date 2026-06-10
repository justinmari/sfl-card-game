import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import AppNavbar from '@/components/app-navbar'

export default async function DashboardPage() {
  const profile = await getProfile()

  if (!profile) {
    redirect('/login')
  }

  const isAdmin = profile.role === 'admin'

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="mb-2 text-2xl font-bold">
          Welcome, {profile.full_name}!
        </h2>
        <p className="mb-8 text-zinc-400">
          {isAdmin ? 'Manage your card game below.' : 'Collect cards and open packs!'}
        </p>

        <div className="flex flex-wrap gap-6">
          <a
            href="/shop"
            className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-8 py-6 transition-colors hover:border-zinc-600"
          >
            <span className="text-3xl">🛒</span>
            <span className="text-sm font-medium">Shop</span>
          </a>

          <a
            href="/collection"
            className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-8 py-6 transition-colors hover:border-zinc-600"
          >
            <span className="text-3xl">🃏</span>
            <span className="text-sm font-medium">Collection</span>
          </a>

          {isAdmin && (
            <a
              href="/admin"
              className="flex flex-col items-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 px-8 py-6 transition-colors hover:border-amber-600"
            >
              <span className="text-3xl">⚙️</span>
              <span className="text-sm font-medium">Admin</span>
            </a>
          )}
        </div>
      </main>
    </div>
  )
}
