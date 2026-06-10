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

  return (
    <Navbar
      avatarUrl={profile?.user_metadata?.avatar_url}
      isAdmin={profile?.role === 'admin'}
      gruten={profile?.gruten}
      backHref={backHref}
      backLabel={backLabel}
      title={title}
    />
  )
}
