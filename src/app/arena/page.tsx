import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import Link from 'next/link'
import { getMyLobby } from './lobby-actions'
import ArenaLobbyList from './arena-lobby-list'

export default async function ArenaPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  // Check for legal decks
  const { data: decks } = await supabase
    .from('decks')
    .select('slot, name, card_ids')
    .eq('user_id', profile.id)
    .order('slot')

  const hasLegalDeck = (decks || []).some((d) => d.card_ids?.length === 5)

  if (!hasLegalDeck) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <AppNavbar backHref="/dashboard" title="Arena" />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="flex flex-col items-center justify-center py-20">
            <span className="mb-6 text-5xl">⚔️</span>
            <h2 className="mb-2 text-xl font-bold">No Battle Deck</h2>
            <p className="mb-6 text-sm text-zinc-400 text-center">
              You need at least one deck with 5 cards to enter the Arena.
            </p>
            <Link href="/decks" className="rounded-lg bg-red-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-red-500">
              Build a Deck
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // Check if already in a lobby (don't auto-redirect, show reconnect option)
  const myLobby = await getMyLobby()

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Arena" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <ArenaLobbyList
          userId={profile.id}
          userName={profile.full_name || 'Unknown'}
          avatarUrl={profile.avatar_url || profile.user_metadata?.avatar_url || null}
          myLobby={myLobby}
        />
      </main>
    </div>
  )
}
