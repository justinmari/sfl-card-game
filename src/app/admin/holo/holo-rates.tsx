'use client'

import { useState } from 'react'
import { setHoloRates, type HoloRates } from './holo-actions'

const FINISHES: { key: keyof HoloRates; label: string; dot: string; hint: string }[] = [
  { key: 'golden', label: 'Golden', dot: 'bg-amber-400', hint: 'First-tier foil.' },
  { key: 'diamond', label: 'Diamond', dot: 'bg-sky-300', hint: 'Rarer icy foil.' },
  { key: 'galaxy', label: 'Galaxy', dot: 'bg-fuchsia-400', hint: 'The rarest — also craftable.' },
]

export default function HoloRatesEditor({ initial }: { initial: HoloRates }) {
  const [rates, setRates] = useState<HoloRates>(initial)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const sum = rates.golden + rates.diamond + rates.galaxy
  const regular = Math.max(0, 100 - sum)
  const eachValid = (Object.values(rates) as number[]).every((v) => Number.isFinite(v) && v >= 0 && v <= 100)
  const valid = eachValid && sum <= 100
  const dirty = rates.golden !== initial.golden || rates.diamond !== initial.diamond || rates.galaxy !== initial.galaxy

  const update = (key: keyof HoloRates, raw: string) => {
    setMsg(null)
    setRates((r) => ({ ...r, [key]: raw === '' ? 0 : Number(raw) }))
  }

  const save = async () => {
    setSaving(true)
    setMsg(null)
    const res = await setHoloRates(rates)
    setMsg(res.success ? { ok: true, text: 'Rates saved.' } : { ok: false, text: res.error || 'Failed to save' })
    setSaving(false)
  }

  return (
    <div data-testid="holo-rates" className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h3 className="text-lg font-semibold">Pull Rates</h3>
      <p className="mt-1 text-sm text-zinc-400">
        Chance, <span className="font-medium text-zinc-300">per card pulled</span>, that it comes in each holo finish.
        Independent of the card&apos;s rarity. The remainder is a regular (non-holo) card.
      </p>

      <div className="mt-5 space-y-3">
        {FINISHES.map(({ key, label, dot, hint }) => (
          <div key={key} className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
            <div className="w-24 shrink-0">
              <span className="text-sm font-medium text-white">{label}</span>
            </div>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.001}
                value={rates[key]}
                onChange={(e) => update(key, e.target.value)}
                className="w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 pr-7 text-right text-sm text-white focus:border-zinc-500 focus:outline-none"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
            </div>
            <span className="text-xs text-zinc-500">{hint}</span>
          </div>
        ))}

        <div className="flex items-center gap-3 border-t border-zinc-800 pt-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-600" aria-hidden />
          <div className="w-24 shrink-0">
            <span className="text-sm font-medium text-zinc-400">Regular</span>
          </div>
          <span className="w-28 text-right text-sm tabular-nums text-zinc-400">{regular.toFixed(3)}%</span>
          <span className="text-xs text-zinc-500">Everything else.</span>
        </div>
      </div>

      {!valid && (
        <p className="mt-4 text-sm text-amber-400">
          {eachValid ? 'Holo rates add up to more than 100%.' : 'Each rate must be between 0 and 100.'}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !valid || !dirty}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save rates'}
        </button>
        {msg && <p className={`text-sm ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}
      </div>
    </div>
  )
}
