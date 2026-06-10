import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import PlayerGrid from './player-grid'

export default async function PlayersPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: players } = await supabase.rpc('get_players')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Friends" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <PlayerGrid players={players || []} currentUserId={profile.id} />
      </main>
    </div>
  )
}
