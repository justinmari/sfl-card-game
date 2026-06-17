import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import CarePackageForm from './care-package-form'

export default async function AdminCarePackagesPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: players } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, gruten')
    .neq('role', 'admin')
    .order('full_name')

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Care Packages" />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <CarePackageForm players={players || []} />
      </main>
    </div>
  )
}
