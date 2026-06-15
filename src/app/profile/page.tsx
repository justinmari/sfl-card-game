import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import ProfileForm from './profile-form'

export default async function ProfilePage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: userCards } = await supabase
    .from('user_cards')
    .select('card_id, cards(*, creatures(name), card_types(types(name)))')
    .eq('user_id', profile.id)
    .gt('count', 0)

  const ownedCards = (userCards || []).map((uc) => {
    const c = uc.cards as unknown as { id: string; name: string; description: string | null; image_url: string | null; rarity: string; creatures: { name: string } | null; card_types: { types: { name: string } | null }[] }
    return {
      id: uc.card_id,
      name: c.name,
      description: c.description,
      image_url: c.image_url,
      rarity: c.rarity,
      creature_name: c.creatures?.name || null,
      typeNames: (c.card_types || []).map((ct) => ct.types?.name || '').filter(Boolean),
    }
  })

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Profile" />

      <main className="mx-auto max-w-2xl px-6 py-10">
        <ProfileForm
          fullName={profile.full_name || ''}
          avatarUrl={profile.user_metadata?.avatar_url || profile.avatar_url || null}
          topCardIds={profile.top_cards || []}
          ownedCards={ownedCards}
        />
      </main>
    </div>
  )
}
