import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import Link from 'next/link'

export default async function AdminPage() {
  const profile = await getProfile()

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-zinc-400 hover:text-white">
              &larr; Back
            </Link>
            <h1 className="text-xl font-bold">Admin Panel</h1>
          </div>
          <span className="rounded bg-amber-600 px-2 py-0.5 text-xs font-medium">
            Admin
          </span>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="mb-8 text-2xl font-bold">Manage Your Game</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/admin/cards"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-zinc-600"
          >
            <h3 className="mb-2 text-lg font-semibold">Manage Cards</h3>
            <p className="text-sm text-zinc-400">
              Upload photos, set rarity, and manage your card collection.
            </p>
          </Link>

          <Link
            href="/admin/packs"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-zinc-600"
          >
            <h3 className="mb-2 text-lg font-semibold">Manage Packs</h3>
            <p className="text-sm text-zinc-400">
              Create packs, add cards, and set pull percentages.
            </p>
          </Link>
        </div>
      </main>
    </div>
  )
}
