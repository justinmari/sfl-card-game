import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import TradeRoom, { type Session, type FlatCard } from './trade-room'

export default async function TradeRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: session, error } = await supabase.rpc('get_trade_session', { p_session_id: id })
  if (error || !session) redirect('/trades')
  if (session.status === 'cancelled' || session.status === 'expired') redirect('/trades')

  const { data: myCards } = await supabase.rpc('get_my_cards')

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/trades" backLabel="Trades" title="Live Trade" />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <TradeRoom
          sessionId={id}
          meId={profile.id}
          myName={profile.full_name ?? 'A player'}
          initialSession={session as Session}
          myCards={(myCards ?? []) as FlatCard[]}
        />
      </main>
    </div>
  )
}
