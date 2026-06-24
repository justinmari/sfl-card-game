import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AdminSidebar from '@/components/admin/admin-sidebar'

/**
 * Admin panel shell: a centralized admin gate plus a persistent left sidebar.
 * Every /admin/* tool renders in the content area to the right; the sidebar
 * stays put as you switch sections. (Each tool page keeps its own gate too,
 * as defense-in-depth.)
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { count } = await supabase
    .from('card_suggestions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  return (
    <div className="flex min-h-screen flex-col text-white lg:flex-row">
      <AdminSidebar pendingSuggestions={count ?? 0} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
