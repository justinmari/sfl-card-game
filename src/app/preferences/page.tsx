import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import AppNavbar from '@/components/app-navbar'
import PreferencesForm from './preferences-form'

export default async function PreferencesPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Preferences" />

      <main className="mx-auto max-w-md px-6 py-10">
        <PreferencesForm />
      </main>
    </div>
  )
}
