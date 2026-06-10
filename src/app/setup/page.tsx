import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import SetupForm from './setup-form'

export default async function SetupPage() {
  const profile = await getProfile()

  if (!profile) redirect('/login')
  if (profile.full_name) redirect('/dashboard')

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <SetupForm />
    </div>
  )
}
