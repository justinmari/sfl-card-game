import { createClient } from './server'

export async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile) {
    return { ...profile, email: user.email, user_metadata: user.user_metadata }
  }

  // Profile doesn't exist — create one
  await supabase.from('profiles').upsert({
    id: user.id,
    full_name: user.user_metadata?.full_name || null,
    avatar_url: user.user_metadata?.avatar_url || null,
  }, { onConflict: 'id', ignoreDuplicates: true })

  const { data: newProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return newProfile ? { ...newProfile, email: user.email, user_metadata: user.user_metadata } : null
}
