import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import UserList from './user-list'

export default async function AdminUsersPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Manage Users" />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <UserList users={profiles || []} />
      </main>
    </div>
  )
}
