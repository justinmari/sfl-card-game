import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import AppNavbar from '@/components/app-navbar'
import { getArenaStatus, getSuggestionsStatus } from './arena-actions'
import ArenaToggle from './arena-toggle'
import FeatureToggle from './feature-toggle'

export default async function AdminArenaPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const arenaEnabled = await getArenaStatus()
  const suggestionsEnabled = await getSuggestionsStatus()

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Feature Settings" />
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <ArenaToggle initialEnabled={arenaEnabled} />
        <FeatureToggle
          featureKey="suggestions"
          label="Card Suggestions"
          enabledDescription="Players can submit card suggestions."
          disabledDescription="Card suggestions are disabled."
          initialEnabled={suggestionsEnabled}
        />
      </main>
    </div>
  )
}
