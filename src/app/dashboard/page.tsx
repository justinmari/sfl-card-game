import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'

export default async function DashboardPage() {
  const profile = await getProfile()

  if (!profile) {
    redirect('/login')
  }

  if (!profile.full_name) {
    redirect('/setup')
  }

  // Get active lobby count for arena badge
  const supabase = await createClient()
  const { count: lobbyCount } = await supabase
    .from('arena_lobbies')
    .select('*', { count: 'exact', head: true })
    .in('status', ['waiting', 'active'])

  const isAdmin = profile.role === 'admin'

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="mb-2 text-2xl font-bold">
          Welcome, {profile.full_name}!
        </h2>
        <p className="mb-8 text-zinc-400">
          {isAdmin ? 'Manage your card game below.' : 'Collect cards and open packs!'}
        </p>

        {/* Main */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <a
            href="/shop"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-8 transition-colors hover:border-zinc-600"
          >
            <span className="text-3xl">🛒</span>
            <span className="text-sm font-medium">Shop</span>
          </a>

          <a
            href="/collection"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-8 transition-colors hover:border-zinc-600"
          >
            <span className="text-3xl">🃏</span>
            <span className="text-sm font-medium">Collection</span>
          </a>

          <a
            href="/players"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-8 transition-colors hover:border-zinc-600"
          >
            <span className="text-3xl">👥</span>
            <span className="text-sm font-medium">Friends</span>
          </a>
        </div>

        {/* Arena */}
        <h3 className="mb-4 mt-10 text-lg font-semibold text-red-400">Arena</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <a
            href="/arena"
            className="relative flex flex-col items-center justify-center gap-2 rounded-xl border border-red-800 bg-red-950/30 py-8 transition-colors hover:border-red-600"
          >
            <span className="text-3xl">⚔️</span>
            <span className="text-sm font-medium">Arena</span>
            {(lobbyCount ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {lobbyCount}
              </span>
            )}
          </a>

          <a
            href="/decks"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-red-800 bg-red-950/30 py-8 transition-colors hover:border-red-600"
          >
            <span className="text-3xl">📋</span>
            <span className="text-sm font-medium">Decks</span>
          </a>
        </div>

        {/* How to Play */}
        <h3 className="mb-4 mt-10 text-lg font-semibold text-zinc-300">How to Play Arena</h3>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400 space-y-3">
          <div className="flex gap-3">
            <span className="text-lg">1️⃣</span>
            <p><span className="text-white font-medium">Build a Deck</span> — Go to Decks and create a deck with 5 cards. Higher rarity cards have more stars (power).</p>
          </div>
          <div className="flex gap-3">
            <span className="text-lg">2️⃣</span>
            <p><span className="text-white font-medium">Join or Create a Lobby</span> — Head to Arena, create a lobby or join an existing one. The host starts the game when everyone is ready.</p>
          </div>
          <div className="flex gap-3">
            <span className="text-lg">3️⃣</span>
            <p><span className="text-white font-medium">Battle!</span> — Each round, you&apos;re matched against another player. Your 5 cards face off one by one. Higher total (stars + dice roll) wins each face-off and deals damage.</p>
          </div>
          <div className="flex gap-3">
            <span className="text-lg">4️⃣</span>
            <p><span className="text-white font-medium">Use Skills</span> — Secret Rare cards have special skills you can activate before a round. Skills affect both players — use them wisely!</p>
          </div>
          <div className="flex gap-3">
            <span className="text-lg">5️⃣</span>
            <p><span className="text-white font-medium">Last One Standing</span> — Everyone starts with 10 HP. Get KO&apos;d and you&apos;re out. Last player alive wins!</p>
          </div>
        </div>

        {/* Changelog */}
        <h3 className="mb-4 mt-10 text-lg font-semibold text-zinc-300">Changelog</h3>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-amber-400">NEW</span>
              <span className="text-xs text-zinc-500">Arena Update</span>
            </div>
            <ul className="list-disc list-inside text-zinc-400 space-y-1">
              <li>Multi-lobby system — create or join lobbies</li>
              <li>Host controls — the lobby creator starts the game</li>
              <li>Card skills — Secret Rare cards have special abilities</li>
              <li>Spectator mode — join active games as a spectator</li>
              <li>Reconnect support — rejoin if you disconnect</li>
              <li>Server-computed battles — fair and cheat-proof</li>
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-zinc-500">Previous</span>
            </div>
            <ul className="list-disc list-inside text-zinc-400 space-y-1">
              <li>Card collection with pack opening animations</li>
              <li>Daily Gruten claims</li>
              <li>Player profiles and friends page</li>
              <li>Deck builder with 3 deck slots</li>
            </ul>
          </div>
        </div>

        {isAdmin && (
          <>
            <h3 className="mb-4 mt-10 text-lg font-semibold text-amber-400">Admin</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <a
                href="/admin/cards"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">🖼️</span>
                <span className="text-sm font-medium">Manage Cards</span>
              </a>

              <a
                href="/admin/packs"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">📦</span>
                <span className="text-sm font-medium">Manage Packs</span>
              </a>

              <a
                href="/admin/creatures"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">👾</span>
                <span className="text-sm font-medium">Creatures</span>
              </a>

              <a
                href="/admin/users"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">👥</span>
                <span className="text-sm font-medium">Users</span>
              </a>

              <a
                href="/admin/skills"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">✦</span>
                <span className="text-sm font-medium">Skills</span>
              </a>

              <a
                href="/arena/test"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-800 bg-amber-950/30 py-8 transition-colors hover:border-amber-600"
              >
                <span className="text-3xl">🧪</span>
                <span className="text-sm font-medium">Test Arena</span>
              </a>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
