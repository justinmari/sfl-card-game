'use server'

import { createClient } from '@/lib/supabase/server'

export async function getArenaStatus(): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'arena_enabled')
    .maybeSingle()

  if (!data) return true
  return data.value === true || data.value === 'true'
}

export async function toggleArena(enable: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { success: false, error: 'Not authorized' }

  if (enable) {
    const { error } = await supabase.rpc('rpc_admin_enable_arena')
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase.rpc('rpc_admin_disable_arena')
    if (error) return { success: false, error: error.message }
  }

  return { success: true }
}
