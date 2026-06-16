'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OP_REGISTRY, validateOpParams, type ParamSpec } from '@/lib/battle-effects'

type Effect = {
  id: string
  key: string
  name: string
  op: string
  params: Record<string, unknown>
  kind: string[]
  is_active: boolean
}

const OPS = Object.values(OP_REGISTRY).map((o) => ({ id: o.id, label: o.label, params: o.params, defaultKind: o.defaultKind }))

const blankParams = (op: string): Record<string, unknown> => {
  const handler = OP_REGISTRY[op]
  const out: Record<string, unknown> = {}
  for (const p of handler?.params ?? []) out[p.key] = p.default
  return out
}

function ParamField({ spec, value, onChange }: { spec: ParamSpec; value: unknown; onChange: (v: unknown) => void }) {
  if (spec.type === 'number') {
    return (
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-zinc-400">{spec.label}</span>
        <input type="number" value={value as number} min={spec.min} max={spec.max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="input-arcade w-28 px-2 py-1 text-sm" />
      </label>
    )
  }
  if (spec.type === 'rarity') {
    return (
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-zinc-400">{spec.label}</span>
        <select value={value as string} onChange={(e) => onChange(e.target.value)} className="input-arcade px-2 py-1 text-sm">
          {['common', 'uncommon', 'rare', 'ultra_rare', 'legendary', 'secret_rare'].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
    )
  }
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-zinc-400">{spec.label}</span>
      <input type="text" value={value as string} onChange={(e) => onChange(e.target.value)} className="input-arcade w-48 px-2 py-1 text-sm" />
    </label>
  )
}

export default function EffectList({ effects }: { effects: Effect[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<{ key: string; name: string; op: string; params: Record<string, unknown> }>({
    key: '', name: '', op: OPS[0].id, params: blankParams(OPS[0].id),
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reset = () => { setEditingId(null); setCreating(false); setError(null) }

  const startCreate = () => {
    setCreating(true); setEditingId(null); setError(null)
    setForm({ key: '', name: '', op: OPS[0].id, params: blankParams(OPS[0].id) })
  }
  const startEdit = (e: Effect) => {
    setEditingId(e.id); setCreating(false); setError(null)
    setForm({ key: e.key, name: e.name, op: e.op, params: { ...blankParams(e.op), ...(e.params || {}) } })
  }

  const setOp = (op: string) => setForm((f) => ({ ...f, op, params: blankParams(op) }))
  const setParam = (k: string, v: unknown) => setForm((f) => ({ ...f, params: { ...f.params, [k]: v } }))

  const save = async () => {
    setError(null)
    if (!form.key.trim() || !form.name.trim()) { setError('Key and name are required'); return }
    const validationError = validateOpParams(form.op, form.params)
    if (validationError) { setError(validationError); return }
    setSaving(true)
    const supabase = createClient()
    const row = { key: form.key.trim(), name: form.name.trim(), op: form.op, params: form.params, kind: OP_REGISTRY[form.op].defaultKind }
    let res
    if (editingId) res = await supabase.from('battle_effects').update(row).eq('id', editingId)
    else res = await supabase.from('battle_effects').insert(row)
    setSaving(false)
    if (res.error) { setError(res.error.message); return }
    reset(); router.refresh()
  }

  const toggleActive = async (e: Effect) => {
    const supabase = createClient()
    await supabase.from('battle_effects').update({ is_active: !e.is_active }).eq('id', e.id)
    router.refresh()
  }
  const remove = async (e: Effect) => {
    const supabase = createClient()
    await supabase.from('battle_effects').delete().eq('id', e.id)
    router.refresh()
  }

  const renderForm = () => (
    <div className="surface mt-3 rounded-xl p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm"><span className="mb-1 block text-zinc-400">Key (slug)</span>
          <input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} disabled={!!editingId}
            className="input-arcade w-full px-2 py-1 text-sm disabled:opacity-50" placeholder="my-effect" /></label>
        <label className="text-sm"><span className="mb-1 block text-zinc-400">Name</span>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="input-arcade w-full px-2 py-1 text-sm" placeholder="My Effect" /></label>
      </div>
      <label className="mt-3 block text-sm"><span className="mb-1 block text-zinc-400">Operation</span>
        <select value={form.op} onChange={(e) => setOp(e.target.value)} aria-label="Operation" className="input-arcade w-full px-2 py-1 text-sm">
          {OPS.map((o) => <option key={o.id} value={o.id}>{o.label} ({o.id})</option>)}
        </select></label>
      {OP_REGISTRY[form.op].params.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg border border-white/10 p-3">
          {OP_REGISTRY[form.op].params.map((spec) => (
            <ParamField key={spec.key} spec={spec} value={form.params[spec.key]} onChange={(v) => setParam(spec.key, v)} />
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-zinc-500">Visual kind: {OP_REGISTRY[form.op].defaultKind.join(', ')}</p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={saving} className="btn-arcade rounded-lg px-4 py-2 text-sm">{saving ? 'Saving…' : 'Save'}</button>
        <button onClick={reset} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">Cancel</button>
      </div>
    </div>
  )

  return (
    <div data-testid="battle-effects-admin">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Battle Effects</h2>
        <button onClick={startCreate} className="btn-arcade rounded-lg px-4 py-2 text-sm">+ New Effect</button>
      </div>
      {creating && renderForm()}
      <div className="mt-3 space-y-2">
        {effects.map((e) => (
          <div key={e.id} data-testid="effect-row" className="surface rounded-xl p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="font-semibold">{e.name}</span>
                <span className="ml-2 text-xs text-zinc-500">{e.key} · {e.op} · [{e.kind.join(', ')}]</span>
                {!e.is_active && <span className="ml-2 rounded bg-zinc-700 px-1.5 text-[10px] text-zinc-300">inactive</span>}
              </div>
              <div className="flex flex-none gap-2">
                <button onClick={() => toggleActive(e)} className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/5">{e.is_active ? 'Disable' : 'Enable'}</button>
                <button onClick={() => startEdit(e)} className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/5">Edit</button>
                <button onClick={() => remove(e)} className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">Delete</button>
              </div>
            </div>
            {editingId === e.id && renderForm()}
          </div>
        ))}
      </div>
    </div>
  )
}
