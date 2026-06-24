'use server'

import { createClient } from '@/lib/supabase/server'

export type HoloRates = { golden: number; diamond: number; galaxy: number }

const DEFAULTS: HoloRates = { golden: 0.1, diamond: 0.05, galaxy: 0.01 }

export async function getHoloRates(): Promise<HoloRates> {
  const supabase = await createClient()
  const { data } = await supabase.from('holo_rates').select('edition, rate')

  const map = new Map((data ?? []).map((r) => [r.edition, Number(r.rate)]))
  return {
    golden: map.get('golden') ?? DEFAULTS.golden,
    diamond: map.get('diamond') ?? DEFAULTS.diamond,
    galaxy: map.get('galaxy') ?? DEFAULTS.galaxy,
  }
}

export async function setHoloRates(rates: HoloRates): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('rpc_admin_set_holo_rates', {
    p_golden: rates.golden,
    p_diamond: rates.diamond,
    p_galaxy: rates.galaxy,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
