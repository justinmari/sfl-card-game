import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import Navbar from './navbar'

export default async function AppNavbar({
  backHref,
  backLabel,
  title,
}: {
  backHref?: string
  backLabel?: string
  title?: string
}) {
  const profile = await getProfile()

  const todayEST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).toISOString().split('T')[0]
  const canClaimDaily = profile?.role !== 'admin' && profile?.last_daily_claim !== todayEST

  // Unopened care packages waiting for this user.
  let packageCount = 0
  let packageTotal = 0
  if (profile) {
    const supabase = await createClient()
    const { data: pkgs } = await supabase
      .from('gruten_packages')
      .select('amount')
      .eq('user_id', profile.id)
      .is('opened_at', null)
      .gt('expires_at', new Date().toISOString())
    packageCount = pkgs?.length ?? 0
    packageTotal = (pkgs ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0)
  }

  return (
    <Navbar
      avatarUrl={profile?.user_metadata?.avatar_url}
      isAdmin={profile?.role === 'admin'}
      gruten={profile?.gruten}
      canClaimDaily={canClaimDaily}
      packageCount={packageCount}
      packageTotal={packageTotal}
      backHref={backHref}
      backLabel={backLabel}
      title={title}
    />
  )
}
