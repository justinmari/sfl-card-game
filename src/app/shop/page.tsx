import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PackShop from './pack-shop'

export default async function ShopPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: packs } = await supabase
    .from('packs')
    .select('*, pack_cards(count)')
    .eq('is_active', true)
    .order('price')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-zinc-400 hover:text-white">
              &larr; Back
            </Link>
            <h1 className="text-xl font-bold">Shop</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-amber-950/50 px-3 py-1 text-sm font-medium text-amber-400">
              {profile.gruten === -1 ? 'Infinite' : profile.gruten.toLocaleString()} G
            </span>
            {profile.user_metadata?.avatar_url && (
              <img
                src={profile.user_metadata.avatar_url}
                alt="Avatar"
                className="h-8 w-8 rounded-full"
              />
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <PackShop
          packs={packs || []}
          gruten={profile.gruten}
        />
      </main>
    </div>
  )
}
