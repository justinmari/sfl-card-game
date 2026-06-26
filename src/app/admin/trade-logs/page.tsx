import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import TradeLog from './trade-log'

export default async function AdminTradeLogsPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: players } = await supabase
    .from('profiles')
    .select('id, full_name')
    .order('full_name')

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Trade Logs" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <TradeLog players={players || []} />
      </main>
    </div>
  )
}
