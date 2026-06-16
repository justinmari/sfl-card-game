'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const PRESETS = [500, 1000, 2000]

type Player = { id: string; full_name: string | null }

export default function CarePackageForm({ players }: { players: Player[] }) {
  const [amount, setAmount] = useState(500)
  const [target, setTarget] = useState('') // '' = all players
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const targetName = target ? players.find((p) => p.id === target)?.full_name || 'player' : 'all players'

  const send = async () => {
    setSending(true)
    setError(null)
    setResult(null)
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('admin_send_care_package', {
      p_user_id: target || null,
      p_amount: amount,
    })
    if (rpcError) {
      setError(rpcError.message)
    } else {
      const sent = (data as { sent: number })?.sent ?? 0
      setResult(`Sent ${sent} care package${sent === 1 ? '' : 's'} of ${amount.toLocaleString()} G`)
    }
    setSending(false)
  }

  return (
    <div className="surface rounded-2xl p-6">
      <h2 className="font-display mb-1 text-lg font-semibold">Send a Care Package</h2>
      <p className="mb-5 text-sm text-zinc-400">
        Drop some Gruten into a player&apos;s gift box — they open it from the navbar, like the daily reward.
      </p>

      <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">Amount</label>
      <div className="mb-5 flex gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold transition-all ${
              amount === p ? 'btn-arcade' : 'border border-white/10 text-zinc-300 hover:bg-white/5'
            }`}
          >
            {p.toLocaleString()} G
          </button>
        ))}
      </div>

      <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">Recipient</label>
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        aria-label="Recipient"
        className="input-arcade mb-5 w-full px-4 py-2.5 text-sm"
      >
        <option value="">All players</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>{p.full_name || 'Unknown'}</option>
        ))}
      </select>

      <button onClick={send} disabled={sending} className="btn-arcade w-full rounded-lg px-6 py-3 text-sm">
        {sending ? 'Sending...' : `Send ${amount.toLocaleString()} G to ${targetName}`}
      </button>

      {result && <p className="mt-3 text-center text-sm text-green-400">📦 {result}</p>}
      {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}
    </div>
  )
}
