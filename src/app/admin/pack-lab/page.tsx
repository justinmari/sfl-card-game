import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import PackLab from './pack-lab'

export default async function AdminPackLabPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: packs }, { data: cards }] = await Promise.all([
    supabase.from('packs').select('id, name, image_url, price, created_at').order('created_at', { ascending: false }),
    supabase
      .from('cards')
      .select('id, name, image_url, rarity, creatures(name)')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const sampleCards = (cards || []).map((c) => {
    const card = c as unknown as { id: string; name: string; image_url: string | null; rarity: string; creatures: { name: string } | null }
    return {
      id: card.id,
      name: card.name,
      image_url: card.image_url,
      rarity: card.rarity,
      creature_name: card.creatures?.name || null,
    }
  })

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Pack Lab" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="font-display mb-1 text-2xl font-bold tracking-tight">Pack-Opening Lab</h2>
        <p className="mb-6 text-sm text-zinc-400">
          Prototyping the pack-open: flick across the top to slice the edge off. This screen is
          isolated — nothing here touches the live shop.
        </p>
        <PackLab packs={(packs as { id: string; name: string; image_url: string | null; price?: number; created_at?: string }[]) || []} cards={sampleCards} />
      </main>
    </div>
  )
}
