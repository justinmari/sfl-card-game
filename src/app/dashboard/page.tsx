import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import SignOutButton from './sign-out-button'

export default async function DashboardPage() {
  const profile = await getProfile()

  if (!profile) {
    redirect('/login')
  }

  const isAdmin = profile.role === 'admin'
  const grutenDisplay = profile.gruten === -1 ? 'Infinite' : profile.gruten.toLocaleString()

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-xl font-bold">SFL TCG</h1>
          <div className="flex items-center gap-4">
            <span className="rounded-lg bg-amber-950/50 px-3 py-1 text-sm font-medium text-amber-400">
              {grutenDisplay} G
            </span>
            {profile.user_metadata?.avatar_url && (
              <img
                src={profile.user_metadata.avatar_url}
                alt="Avatar"
                className="h-8 w-8 rounded-full"
              />
            )}
            <span className="text-sm text-zinc-400">{profile.email}</span>
            {isAdmin && (
              <span className="rounded bg-amber-600 px-2 py-0.5 text-xs font-medium">
                Admin
              </span>
            )}
            <SignOutButton />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="mb-2 text-2xl font-bold">
          Welcome, {profile.full_name}!
        </h2>
        <p className="mb-8 text-zinc-400">
          {isAdmin ? 'Manage your card game below.' : 'Collect cards and open packs!'}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <a
            href="/shop"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-zinc-600"
          >
            <h3 className="mb-2 text-lg font-semibold">Shop</h3>
            <p className="text-sm text-zinc-400">
              Buy and open card packs with Gruten.
            </p>
          </a>

          <a
            href="/collection"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-zinc-600"
          >
            <h3 className="mb-2 text-lg font-semibold">My Collection</h3>
            <p className="text-sm text-zinc-400">
              View all the cards you&apos;ve collected.
            </p>
          </a>

          {isAdmin && (
            <a
              href="/admin"
              className="rounded-xl border border-amber-800 bg-amber-950/30 p-6 transition-colors hover:border-amber-600"
            >
              <h3 className="mb-2 text-lg font-semibold">Admin Panel</h3>
              <p className="text-sm text-zinc-400">
                Upload cards, manage packs, and configure the game.
              </p>
            </a>
          )}
        </div>
      </main>
    </div>
  )
}
