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
