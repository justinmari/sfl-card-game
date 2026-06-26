import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import TradesLanding, { type ActiveTrade, type PlayerOption } from './trades-landing'

export default async function TradesPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  await supabase.rpc('cleanup_stale_trade_sessions')

  // At most one open session involves a player (enforced at creation).
  const { data: sessions } = await supabase
    .from('trade_sessions')
    .select('id, initiator_id, partner_id, status')
    .or(`initiator_id.eq.${profile.id},partner_id.eq.${profile.id}`)
    .eq('status', 'open')
  const open = (sessions ?? [])[0] ?? null

  const { data: allPlayers } = await supabase.rpc('get_players')
  const roster = (allPlayers ?? []) as { id: string; full_name: string | null; avatar_url: string | null; role?: string }[]
  const players: PlayerOption[] = roster
    .filter((p) => p.id !== profile.id && p.role !== 'admin')
    .map((p) => ({ id: p.id, full_name: p.full_name, avatar_url: p.avatar_url }))

  let active: ActiveTrade | null = null
  if (open) {
    const partnerId = open.initiator_id === profile.id ? open.partner_id : open.initiator_id
    const pp = roster.find((p) => p.id === partnerId)
    active = {
      id: open.id,
      partnerId,
      partnerName: pp?.full_name ?? 'a player',
      partnerAvatar: pp?.avatar_url ?? null,
      role: open.initiator_id === profile.id ? 'outgoing' : 'incoming',
    }
  }

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Trades" />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <TradesLanding active={active} players={players} myName={profile.full_name ?? 'Someone'} />
      </main>
    </div>
  )
}
