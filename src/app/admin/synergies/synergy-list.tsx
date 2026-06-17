'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OP_REGISTRY } from '@/lib/battle-effects'

type Req = { type_id: string; count: number }
type Eff = { battle_effect_id: string; scope: string; target: string }
type Synergy = {
  id: string
  name: string
  description: string
  is_active: boolean
  synergy_requirements: { id: string; type_id: string; count: number }[]
  synergy_effects: { id: string; battle_effect_id: string; scope: string; target: string; ordinal: number }[]
}
type TypeOption = { id: string; name: string }
type EffectOption = { id: string; key: string; name: string; op: string }

const SCOPES = ['synergy_cards', 'non_synergy_cards', 'own', 'matchup', 'arena']
const TARGETS = ['allies', 'enemies', 'everyone']
// Friendlier labels — the stored values stay allies/enemies/everyone. Arena is a
// free-for-all (no teams), so "allies" really just means the synergy owner's own
// cards in the round's 1v1 face-off.
const TARGET_LABEL: Record<string, string> = {
  allies: 'Self (your cards)',
  enemies: 'Opponent',
  everyone: 'Everyone',
}

export default function SynergyList({ synergies, types, effects }: { synergies: Synergy[]; types: TypeOption[]; effects: EffectOption[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [reqs, setReqs] = useState<Req[]>([])
  const [effs, setEffs] = useState<Eff[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reset = () => { setEditingId(null); setCreating(false); setError(null) }
  const startCreate = () => { reset(); setCreating(true); setName(''); setDesc(''); setReqs([]); setEffs([]) }
  const startEdit = (s: Synergy) => {
    setEditingId(s.id); setCreating(false); setError(null)
    setName(s.name); setDesc(s.description)
    setReqs(s.synergy_requirements.map((r) => ({ type_id: r.type_id, count: r.count })))
    setEffs([...s.synergy_effects].sort((a, b) => a.ordinal - b.ordinal).map((e) => ({ battle_effect_id: e.battle_effect_id, scope: e.scope, target: e.target })))
  }

  const save = async () => {
    setError(null)
    if (!name.trim()) { setError('Name is required'); return }
    if (reqs.length === 0) { setError('Add at least one type requirement'); return }
    if (reqs.some((r) => !r.type_id)) { setError('Pick a type for every requirement'); return }
    if (effs.some((e) => !e.battle_effect_id)) { setError('Pick an effect for every effect row'); return }
    setSaving(true)
    const supabase = createClient()

    let synergyId = editingId
    if (editingId) {
      await supabase.from('synergies').update({ name: name.trim(), description: desc.trim() }).eq('id', editingId)
      await supabase.from('synergy_requirements').delete().eq('synergy_id', editingId)
      await supabase.from('synergy_effects').delete().eq('synergy_id', editingId)
    } else {
      const { data, error: insErr } = await supabase.from('synergies').insert({ name: name.trim(), description: desc.trim() }).select('id').single()
      if (insErr || !data) { setError(insErr?.message ?? 'Insert failed'); setSaving(false); return }
      synergyId = data.id
    }
    if (reqs.length > 0) {
      await supabase.from('synergy_requirements').insert(reqs.map((r) => ({ synergy_id: synergyId, type_id: r.type_id, count: r.count })))
    }
    if (effs.length > 0) {
      await supabase.from('synergy_effects').insert(effs.map((e, ordinal) => ({ synergy_id: synergyId, battle_effect_id: e.battle_effect_id, scope: e.scope, target: e.target, ordinal })))
    }
    setSaving(false); reset(); router.refresh()
  }

  const toggleActive = async (s: Synergy) => {
    const supabase = createClient()
    await supabase.from('synergies').update({ is_active: !s.is_active }).eq('id', s.id)
    router.refresh()
  }
  const remove = async (s: Synergy) => {
    const supabase = createClient()
    await supabase.from('synergies').delete().eq('id', s.id)
    router.refresh()
  }

  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? '?'
  const effectName = (id: string) => effects.find((e) => e.id === id)?.name ?? '?'

  const renderForm = () => (
    <div className="surface mt-3 rounded-xl p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm"><span className="mb-1 block text-zinc-400">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-arcade w-full px-2 py-1 text-sm" placeholder="Egg Roll" /></label>
        <label className="text-sm"><span className="mb-1 block text-zinc-400">Description</span>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} className="input-arcade w-full px-2 py-1 text-sm" placeholder="3 Egg cards…" /></label>
      </div>

      {/* Recipe */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Recipe (all required)</span>
          <button onClick={() => setReqs((r) => [...r, { type_id: types[0]?.id ?? '', count: 1 }])} className="text-xs text-sky-400 hover:underline">+ requirement</button>
        </div>
        {reqs.map((r, i) => (
          <div key={i} className="mb-1 flex items-center gap-2">
            <input type="number" min={1} value={r.count} onChange={(e) => setReqs((prev) => prev.map((x, j) => j === i ? { ...x, count: Number(e.target.value) } : x))} className="input-arcade w-16 px-2 py-1 text-sm" />
            <span className="text-zinc-500">×</span>
            <select aria-label="Requirement type" value={r.type_id} onChange={(e) => setReqs((prev) => prev.map((x, j) => j === i ? { ...x, type_id: e.target.value } : x))} className="input-arcade flex-1 px-2 py-1 text-sm">
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={() => setReqs((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300">×</button>
          </div>
        ))}
      </div>

      {/* Effects */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Effects</span>
          <button onClick={() => setEffs((e) => [...e, { battle_effect_id: effects[0]?.id ?? '', scope: 'own', target: 'allies' }])} className="text-xs text-sky-400 hover:underline">+ effect</button>
        </div>
        {effs.map((e, i) => {
          const fx = effects.find((o) => o.id === e.battle_effect_id)
          const isRoundOp = fx ? OP_REGISTRY[fx.op]?.phase === 'round' : false
          return (
          <div key={i} className="mb-1 flex items-center gap-2">
            <select aria-label="Effect" value={e.battle_effect_id} onChange={(ev) => setEffs((prev) => prev.map((x, j) => {
              if (j !== i) return x
              const picked = effects.find((o) => o.id === ev.target.value)
              const round = picked ? OP_REGISTRY[picked.op]?.phase === 'round' : false
              return { ...x, battle_effect_id: ev.target.value, scope: round ? 'arena' : x.scope }
            }))} className="input-arcade flex-1 px-2 py-1 text-sm">
              {effects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <select aria-label="Scope" value={isRoundOp ? 'arena' : e.scope} disabled={isRoundOp} title={isRoundOp ? 'Round-level effects are always arena-wide' : undefined} onChange={(ev) => setEffs((prev) => prev.map((x, j) => j === i ? { ...x, scope: ev.target.value } : x))} className="input-arcade px-2 py-1 text-sm disabled:opacity-50">
              {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="Target" value={e.target} onChange={(ev) => setEffs((prev) => prev.map((x, j) => j === i ? { ...x, target: ev.target.value } : x))} className="input-arcade px-2 py-1 text-sm">
              {TARGETS.map((t) => <option key={t} value={t}>{TARGET_LABEL[t] ?? t}</option>)}
            </select>
            <button onClick={() => setEffs((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300">×</button>
          </div>
          )
        })}
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={saving} className="btn-arcade rounded-lg px-4 py-2 text-sm">{saving ? 'Saving…' : 'Save'}</button>
        <button onClick={reset} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">Cancel</button>
      </div>
    </div>
  )

  return (
    <div data-testid="synergies-admin">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Synergies</h2>
        <button onClick={startCreate} className="btn-arcade rounded-lg px-4 py-2 text-sm">+ New Synergy</button>
      </div>
      {types.length === 0 && <p className="mb-3 text-sm text-amber-400">Define some card Types first.</p>}
      {creating && renderForm()}
      <div className="mt-3 space-y-2">
        {synergies.map((s) => (
          <div key={s.id} data-testid="synergy-row" className="surface rounded-xl p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-semibold">{s.name}</span>
                {!s.is_active && <span className="ml-2 rounded bg-zinc-700 px-1.5 text-[10px] text-zinc-300">inactive</span>}
                <p className="text-xs text-zinc-500">{s.description}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {s.synergy_requirements.map((r) => `${r.count}× ${typeName(r.type_id)}`).join(' + ') || 'no recipe'}
                  {' → '}
                  {s.synergy_effects.map((e) => `${effectName(e.battle_effect_id)} (${e.scope}/${TARGET_LABEL[e.target] ?? e.target})`).join(', ') || 'no effects'}
                </p>
              </div>
              <div className="flex flex-none gap-2">
                <button onClick={() => toggleActive(s)} className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/5">{s.is_active ? 'Disable' : 'Enable'}</button>
                <button onClick={() => startEdit(s)} className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/5">Edit</button>
                <button onClick={() => remove(s)} className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">Delete</button>
              </div>
            </div>
            {editingId === s.id && renderForm()}
          </div>
        ))}
      </div>
    </div>
  )
}
