import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import { isArenaAccessible } from '@/lib/arena-settings'
import AppNavbar from '@/components/app-navbar'
import Link from 'next/link'
import { Lock, Swords } from 'lucide-react'
import { getMyLobby } from './lobby-actions'
import ArenaLobbyList from './arena-lobby-list'

export default async function ArenaPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const arenaEnabled = await isArenaAccessible()
  if (!arenaEnabled) {
    return (
      <div className="min-h-screen text-white">
        <AppNavbar backHref="/dashboard" title="Arena" />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="flex flex-col items-center justify-center py-20">
            <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-500/20 to-zinc-700/10 text-zinc-400 ring-1 ring-white/10">
              <Lock className="h-8 w-8" aria-hidden />
            </span>
            <h2 className="font-display mb-2 text-xl font-bold">Arena Disabled</h2>
            <p className="mb-6 text-sm text-zinc-400 text-center">
              The arena has been temporarily disabled by an admin.
            </p>
            <Link href="/dashboard" className="rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/5">
              Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    )
  }

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
      <div className="min-h-screen text-white">
        <AppNavbar backHref="/dashboard" title="Arena" />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="flex flex-col items-center justify-center py-20">
            <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/25 to-orange-500/15 text-red-200 ring-1 ring-red-400/30">
              <Swords className="h-8 w-8" aria-hidden />
            </span>
            <h2 className="font-display mb-2 text-xl font-bold">No Battle Deck</h2>
            <p className="mb-6 text-sm text-zinc-400 text-center">
              You need at least one deck with 5 cards to enter the Arena.
            </p>
            <Link href="/decks" className="btn-arena rounded-lg px-6 py-3 text-sm font-medium">
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
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Arena" />
      <main className="mx-auto max-w-5xl px-6 py-10">
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
