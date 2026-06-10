import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import AppNavbar from '@/components/app-navbar'
import ChangePassword from './change-password'

export default async function SettingsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Settings" />

      <main className="mx-auto max-w-md px-6 py-10">
        <ChangePassword />
      </main>
    </div>
  )
}
