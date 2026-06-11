import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import ArenaLobby from './arena-lobby'
import Link from 'next/link'

export default async function ArenaPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: decks } = await supabase
    .from('decks')
    .select('slot, card_ids')
    .eq('user_id', profile.id)

  // Check if any deck has exactly 5 cards
  const hasLegalDeck = (decks || []).some((d) => d.card_ids?.length === 5)

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Arena" />

      <main className="mx-auto max-w-3xl px-6 py-10">
        {hasLegalDeck ? (
          <ArenaLobby
            userId={profile.id}
            userName={profile.full_name || 'Unknown'}
            avatarUrl={profile.avatar_url || profile.user_metadata?.avatar_url || null}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="mb-6 text-5xl">⚔️</span>
            <h2 className="mb-2 text-xl font-bold">No Battle Deck</h2>
            <p className="mb-6 text-sm text-zinc-400 text-center">
              You need at least one deck with 5 cards to enter the Arena.
            </p>
            <Link
              href="/decks"
              className="rounded-lg bg-red-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-red-500"
            >
              Build a Deck
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
