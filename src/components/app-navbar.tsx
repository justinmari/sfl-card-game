import { getProfile } from '@/lib/supabase/get-profile'
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

  return (
    <Navbar
      avatarUrl={profile?.user_metadata?.avatar_url}
      isAdmin={profile?.role === 'admin'}
      gruten={profile?.gruten}
      canClaimDaily={canClaimDaily}
      backHref={backHref}
      backLabel={backLabel}
      title={title}
    />
  )
}
