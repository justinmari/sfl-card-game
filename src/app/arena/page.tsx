import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import AppNavbar from '@/components/app-navbar'
import ArenaLobby from './arena-lobby'

export default async function ArenaPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Arena" />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <ArenaLobby
          userId={profile.id}
          userName={profile.full_name || 'Unknown'}
          avatarUrl={profile.avatar_url || profile.user_metadata?.avatar_url || null}
        />
      </main>
    </div>
  )
}
