import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getProfile } from '@/lib/supabase/get-profile'
import AppNavbar from '@/components/app-navbar'
import ChangePassword from './change-password'

// Section heading shared by all settings groups — add more <SettingsSection>s below.
function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">{title}</h2>
      {children}
    </section>
  )
}

export default async function SettingsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Settings" />

      <main className="mx-auto max-w-2xl space-y-10 px-6 py-10">
        <SettingsSection title="Account">
          <ChangePassword />
        </SettingsSection>

        <SettingsSection title="Display">
          <Link
            href="/preferences"
            className="surface flex items-center justify-between rounded-2xl p-5 transition-colors hover:bg-white/5"
          >
            <div>
              <p className="text-sm font-medium text-white">Display preferences</p>
              <p className="mt-0.5 text-xs text-zinc-400">Compact cards and other view options</p>
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-500" aria-hidden />
          </Link>
        </SettingsSection>
      </main>
    </div>
  )
}
