import { createClient } from '@/lib/supabase/server'

export async function isArenaEnabled(): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'arena_enabled')
    .maybeSingle()

  if (!data) return true
  return data.value === true || data.value === 'true'
}

// Arena access: enabled for everyone, OR the current user is an admin. Admins
// keep access while the arena is disabled for regular users (for prod testing).
export async function isArenaAccessible(): Promise<boolean> {
  if (await isArenaEnabled()) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return data?.role === 'admin'
}

export async function isSuggestionsEnabled(): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'suggestions_enabled')
    .maybeSingle()

  if (!data) return true
  return data.value === true || data.value === 'true'
}
