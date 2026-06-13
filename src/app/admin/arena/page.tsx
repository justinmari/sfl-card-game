import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import AppNavbar from '@/components/app-navbar'
import { getArenaStatus } from './arena-actions'
import ArenaToggle from './arena-toggle'

export default async function AdminArenaPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const enabled = await getArenaStatus()

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Feature Settings" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <ArenaToggle initialEnabled={enabled} />
      </main>
    </div>
  )
}
