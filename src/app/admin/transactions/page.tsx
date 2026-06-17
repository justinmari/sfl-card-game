import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import AppNavbar from '@/components/app-navbar'
import TransactionLog from './transaction-log'

export default async function AdminTransactionsPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Gruten Logs" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <TransactionLog />
      </main>
    </div>
  )
}
