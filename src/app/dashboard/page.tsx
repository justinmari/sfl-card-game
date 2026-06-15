import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import { isArenaEnabled, isSuggestionsEnabled } from '@/lib/arena-settings'
import AppNavbar from '@/components/app-navbar'
import DashboardToast from './dashboard-toast'

export default async function DashboardPage() {
  const profile = await getProfile()

  if (!profile) {
    redirect('/login')
  }

  if (!profile.full_name) {
    redirect('/setup')
  }

  // Get active lobby count for arena badge
  const supabase = await createClient()
  const { count: lobbyCount } = await supabase
    .from('arena_lobbies')
    .select('*', { count: 'exact', head: true })
    .in('status', ['waiting', 'active'])

  const arenaEnabled = await isArenaEnabled()
  const suggestionsEnabled = await isSuggestionsEnabled()
  const isAdmin = profile.role === 'admin'

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar />
      <DashboardToast />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="mb-2 text-2xl font-bold">
          Welcome, {profile.full_name}!
        </h2>
        <p className="mb-8 text-zinc-400">
          {isAdmin ? 'Manage your card game below.' : 'Collect cards and open packs!'}
        </p>

        {/* Main */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <a
            href="/shop"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-8 transition-colors hover:border-zinc-600"
          >
            <span className="text-3xl">🛒</span>
            <span className="text-sm font-medium">Shop</span>
          </a>

          <a
            href="/collection"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-8 transition-colors hover:border-zinc-600"
          >
            <span className="text-3xl">🃏</span>
            <span className="text-sm font-medium">Collection</span>
          </a>

          <a
            href="/players"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-8 transition-colors hover:border-zinc-600"
          >
            <span className="text-3xl">👥</span>
            <span className="text-sm font-medium">Friends</span>
          </a>

          <a
            href="/changelog"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-8 transition-colors hover:border-zinc-600"
          >
            <span className="text-3xl">📝</span>
            <span className="text-sm font-medium">Changelog</span>
          </a>

          {suggestionsEnabled ? (
            <a
              href="/suggest"
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-8 transition-colors hover:border-zinc-600"
            >
              <span className="text-3xl">💡</span>
              <span className="text-sm font-medium">Suggest a Card</span>
            </a>
          ) : (
            <div
              className="group relative flex cursor-not-allowed flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 py-8 opacity-50"
            >
              <span className="text-3xl">💡</span>
              <span className="text-sm font-medium">Suggest a Card</span>
              <span className="pointer-events-none absolute -bottom-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100">
                Temporarily disabled
              </span>
            </div>
          )}
        </div>

        {/* Arena */}
        <h3 className="mb-4 mt-10 text-lg font-semibold text-red-400">Arena</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {arenaEnabled ? (
            <a
              href="/arena"
              className="relative flex flex-col items-center justify-center gap-2 rounded-xl border border-red-800 bg-red-950/30 py-8 transition-colors hover:border-red-600"
            >
              <span className="text-3xl">⚔️</span>
              <span className="text-sm font-medium">Arena</span>
              {(lobbyCount ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {lobbyCount}
                </span>
              )}
            </a>
          ) : (
            <div
              className="group relative flex cursor-not-allowed flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 py-8 opacity-50"
            >
              <span className="text-3xl">⚔️</span>
              <span className="text-sm font-medium">Arena</span>
              <span className="pointer-events-none absolute -bottom-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100">
                Temporarily disabled
              </span>
            </div>
          )}

          <a
            href="/decks"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-red-800 bg-red-950/30 py-8 transition-colors hover:border-red-600"
          >
            <span className="text-3xl">📋</span>
            <span className="text-sm font-medium">Decks</span>
          </a>
        </div>

        {isAdmin && (
          <>
            <h3 className="mb-4 mt-10 text-lg font-semibold text-amber-400">Admin</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <a
                href="/admin/cards"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">🖼️</span>
                <span className="text-sm font-medium">Manage Cards</span>
              </a>

              <a
                href="/admin/packs"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">📦</span>
                <span className="text-sm font-medium">Manage Packs</span>
              </a>

              <a
                href="/admin/creatures"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">👾</span>
                <span className="text-sm font-medium">Creatures</span>
              </a>

              <a
                href="/admin/types"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">🏷️</span>
                <span className="text-sm font-medium">Types</span>
              </a>

              <a
                href="/admin/users"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">👥</span>
                <span className="text-sm font-medium">Users</span>
              </a>

              <a
                href="/admin/skills"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">✦</span>
                <span className="text-sm font-medium">Skills</span>
              </a>

              <a
                href="/arena/test"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">🧪</span>
                <span className="text-sm font-medium">Test Arena</span>
              </a>

              <a
                href="/admin/arena"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">⚙️</span>
                <span className="text-sm font-medium">Feature Settings</span>
              </a>

              <a
                href="/admin/suggestions"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">💡</span>
                <span className="text-sm font-medium">Card Suggestions</span>
              </a>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
