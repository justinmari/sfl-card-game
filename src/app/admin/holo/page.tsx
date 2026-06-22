import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import HoloPreview from './holo-preview'

export default async function AdminHoloPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: cards } = await supabase
    .from('cards')
    .select('id, name, description, image_url, rarity, creatures(name), card_types(types(name))')
    .order('created_at', { ascending: false })

  const previewCards = (cards || []).map((c) => {
    const card = c as unknown as {
      id: string; name: string; description: string | null; image_url: string | null
      rarity: string; creatures: { name: string } | null
      card_types: { types: { name: string } | null }[]
    }
    return {
      id: card.id,
      name: card.name,
      description: card.description,
      image_url: card.image_url,
      rarity: card.rarity,
      creature_name: card.creatures?.name || null,
      typeNames: (card.card_types || []).map((ct) => ct.types?.name || '').filter(Boolean),
    }
  })

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Holo Preview" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="font-display mb-1 text-2xl font-bold tracking-tight">Holo Editions Preview</h2>
        <p className="mb-6 text-sm text-zinc-400">
          Cosmetic finishes applied to a real card. Hover any card to see the pointer-reactive shimmer.
        </p>
        <HoloPreview cards={previewCards} />
      </main>
    </div>
  )
}
