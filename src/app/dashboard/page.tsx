import { redirect } from 'next/navigation'
import {
  ShoppingBag, Library, Users, ScrollText, Lightbulb,
  Swords, LayoutGrid,
  Images, Package, Ghost, Tags, Sparkles, FlaskConical, Settings, Inbox, Gift, Zap, Combine, Receipt,
} from 'lucide-react'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import { isArenaEnabled, isSuggestionsEnabled } from '@/lib/arena-settings'
import AppNavbar from '@/components/app-navbar'
import DashTile from '@/components/dash-tile'
import ChangelogTeaser from '@/components/changelog-teaser'
import DashboardToast from './dashboard-toast'

export default async function DashboardPage() {
  const profile = await getProfile()

  if (!profile) {
    redirect('/login')
  }

  if (!profile.full_name) {
    redirect('/setup')
  }

  // Get active lobby count for arena badge. Close stale lobbies first so the
  // badge reflects only live ones (no manual "close" action anywhere).
  const supabase = await createClient()
  await supabase.rpc('rpc_cleanup_stale_lobbies')
  const { count: lobbyCount } = await supabase
    .from('arena_lobbies')
    .select('*', { count: 'exact', head: true })
    .in('status', ['waiting', 'active'])

  const arenaEnabled = await isArenaEnabled()
  const suggestionsEnabled = await isSuggestionsEnabled()
  const isAdmin = profile.role === 'admin'

  // Latest changelog entry for the dashboard "what's new" teaser.
  const { data: latestChangelog } = await supabase
    .from('changelogs')
    .select('version, title, content, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Pending card-suggestion count for the admin notification badge.
  let pendingSuggestions = 0
  if (isAdmin) {
    const { count } = await supabase
      .from('card_suggestions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
    pendingSuggestions = count ?? 0
  }

  const countBadge = (n: number) =>
    n > 0 ? (
      <span data-testid="notif-badge" className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-red-300/40 bg-red-500 px-1 text-[10px] font-bold text-white shadow-[0_0_10px_-1px_rgba(239,68,68,0.9)]">
        {n}
      </span>
    ) : null

  const lobbyBadge = countBadge(lobbyCount ?? 0)

  return (
    <div className="min-h-screen text-white">
      <AppNavbar />
      <DashboardToast />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="font-display mb-2 text-3xl font-bold tracking-tight">
          Welcome, <span className="text-arcade-gradient">{profile.full_name}</span>!
        </h2>
        <p className="mb-8 text-zinc-400">
          {isAdmin ? 'Manage your card game below.' : 'Collect cards and open packs!'}
        </p>

        {/* Main — bento grid: Shop hero + four standard tiles */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:auto-rows-[8.5rem]">
          <DashTile
            href="/shop"
            icon={ShoppingBag}
            title="Shop"
            subtitle="Open card packs"
            hero
            className="col-span-2 sm:row-span-2"
          />
          <DashTile href="/collection" icon={Library} title="Collection" subtitle="Browse your cards" />
          <DashTile href="/players" icon={Users} title="Friends" subtitle="See other players" />
          <DashTile href="/changelog" icon={ScrollText} title="Changelog" subtitle="What's new" />
          {suggestionsEnabled ? (
            <DashTile href="/suggest" icon={Lightbulb} title="Suggest a Card" subtitle="Share an idea" />
          ) : (
            <DashTile
              icon={Lightbulb}
              title="Suggest a Card"
              subtitle="Temporarily off"
              disabled
              tooltip="Temporarily disabled"
            />
          )}
        </div>

        {/* Arena — two feature tiles */}
        <h3 className="font-display mb-4 mt-10 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-red-400">
          <span className="h-px w-6 flex-none bg-gradient-to-r from-red-500 to-transparent" />Arena
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:auto-rows-[9rem]">
          {arenaEnabled || isAdmin ? (
            <DashTile
              href="/arena"
              icon={Swords}
              title="Arena"
              subtitle={arenaEnabled ? '8-player auto-battler' : 'Disabled for users (admin access)'}
              accent="red"
              hero
              badge={lobbyBadge}
            />
          ) : (
            <DashTile
              icon={Swords}
              title="Arena"
              subtitle="Temporarily off"
              accent="red"
              hero
              disabled
              tooltip="Temporarily disabled"
              testId="arena-tile-disabled"
            />
          )}

          <DashTile href="/decks" icon={LayoutGrid} title="Decks" subtitle="5 cards per loadout" accent="red" hero />
        </div>

        {isAdmin && (
          <>
            <h3 className="font-display mb-4 mt-10 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-amber-400">
              <span className="h-px w-6 flex-none bg-gradient-to-r from-amber-500 to-transparent" />Admin
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <DashTile href="/admin/cards" icon={Images} title="Manage Cards" subtitle="Upload & edit cards" accent="amber" />
              <DashTile href="/admin/packs" icon={Package} title="Manage Packs" subtitle="Configure packs" accent="amber" />
              <DashTile href="/admin/creatures" icon={Ghost} title="Creatures" subtitle="Card characters" accent="amber" />
              <DashTile href="/admin/types" icon={Tags} title="Types" subtitle="Manage type labels" accent="amber" />
              <DashTile href="/admin/users" icon={Users} title="Users" subtitle="Manage accounts" accent="amber" />
              <DashTile href="/admin/skills" icon={Sparkles} title="Skills" subtitle="Card abilities" accent="amber" />
              <DashTile href="/admin/battle-effects" icon={Zap} title="Battle Effects" subtitle="Compose effects" accent="amber" />
              <DashTile href="/admin/synergies" icon={Combine} title="Synergies" subtitle="Deck-type combos" accent="amber" />
              <DashTile href="/arena/test" icon={FlaskConical} title="Test Arena" subtitle="Simulate battles" accent="amber" />
              <DashTile href="/admin/arena" icon={Settings} title="Feature Settings" subtitle="Toggle features" accent="amber" />
              <DashTile href="/admin/suggestions" icon={Inbox} title="Card Suggestions" subtitle="Review ideas" accent="amber" badge={countBadge(pendingSuggestions)} />
              <DashTile href="/admin/care-packages" icon={Gift} title="Care Packages" subtitle="Send Gruten gifts" accent="amber" />
              <DashTile href="/admin/transactions" icon={Receipt} title="Gruten Logs" subtitle="Transaction history" accent="amber" />
            </div>
          </>
        )}

        {latestChangelog && <ChangelogTeaser entry={latestChangelog} />}
      </main>
    </div>
  )
}
