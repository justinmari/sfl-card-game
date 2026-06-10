import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import Link from 'next/link'
import AppNavbar from '@/components/app-navbar'

export default async function AdminPage() {
  const profile = await getProfile()

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Admin Panel" />

      <main className="mx-auto max-w-5xl px-6 py-10">
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
