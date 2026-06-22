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
  // Titles of the player's suggested cards that were added + rewarded but not
  // yet announced — drives a one-time celebratory toast. Skipped for unlimited
  // (gruten = -1) accounts since they aren't actually credited.
  let suggestionRewards: string[] = []
  // The titleless (home) navbar shows the app version, sourced from the latest
  // changelog entry so it always tracks what's actually been shipped.
  let version: string | null = null
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

    if (profile.gruten !== -1) {
      const { data: rewards } = await supabase
        .from('card_suggestions')
        .select('title')
        .eq('user_id', profile.id)
        .eq('status', 'added')
        .eq('reward_paid', true)
        .eq('reward_seen', false)
      suggestionRewards = (rewards ?? []).map((r) => r.title)
    }

    if (!title) {
      const { data: latest } = await supabase
        .from('changelogs')
        .select('version')
        .not('version', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      version = latest?.version ?? null
    }
  }

  return (
    <Navbar
      avatarUrl={profile?.user_metadata?.avatar_url}
      isAdmin={profile?.role === 'admin'}
      gruten={profile?.gruten}
      canClaimDaily={canClaimDaily}
      packageCount={packageCount}
      packageTotal={packageTotal}
      suggestionRewards={suggestionRewards}
      backHref={backHref}
      backLabel={backLabel}
      title={title}
      version={version}
    />
  )
}
