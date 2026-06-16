import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'

type SynergyRow = {
  id: string
  name: string
  description: string
  synergy_requirements: { count: number; types: { name: string } | null }[]
  synergy_effects: { scope: string; target: string; battle_effects: { name: string } | null }[]
}

export default async function CodexPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: synergies } = await supabase
    .from('synergies')
    .select('id, name, description, synergy_requirements(count, types(name)), synergy_effects(scope, target, battle_effects(name))')
    .eq('is_active', true)
    .order('name')
  const { data: discovered } = await supabase.from('discovered_synergies').select('synergy_id')
  const discoveredSet = new Set((discovered || []).map((d) => d.synergy_id))

  const list = (synergies || []) as unknown as SynergyRow[]
  const discoveredCount = list.filter((s) => discoveredSet.has(s.id)).length

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Synergy Codex" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="mb-6 text-sm text-zinc-400">
          Discover synergies by bringing the right mix of card types into a battle.{' '}
          <span className="text-zinc-300">{discoveredCount}/{list.length}</span> discovered.
        </p>

        {list.length === 0 ? (
          <p className="py-10 text-center text-zinc-500">No synergies exist yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="codex-list">
            {list.map((s) => {
              const found = discoveredSet.has(s.id)
              if (!found) {
                return (
                  <div key={s.id} data-testid="codex-locked" className="surface rounded-xl p-4 opacity-60">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔒</span>
                      <span className="font-display font-semibold text-zinc-500">Undiscovered synergy</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">Bring the right card types to reveal this.</p>
                  </div>
                )
              }
              const recipe = s.synergy_requirements.map((r) => `${r.count}× ${r.types?.name ?? '?'}`).join(' + ')
              const effects = s.synergy_effects.map((e) => `${e.battle_effects?.name ?? '?'} (${e.scope}/${e.target})`).join(', ')
              return (
                <div key={s.id} data-testid="codex-discovered" className="surface rounded-xl border border-sky-500/20 p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✨</span>
                    <span className="font-display font-semibold text-arcade-gradient">{s.name}</span>
                  </div>
                  {s.description && <p className="mt-1 text-xs text-zinc-400">{s.description}</p>}
                  <p className="mt-2 text-xs text-zinc-300">{recipe || 'no recipe'}</p>
                  <p className="text-xs text-sky-300">{effects || 'no effects'}</p>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
