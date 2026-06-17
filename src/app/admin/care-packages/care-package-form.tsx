'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const PRESETS = [500, 1000, 2000]
const ALL = '__all__'

type Player = { id: string; full_name: string | null; avatar_url: string | null; gruten: number }

export default function CarePackageForm({ players }: { players: Player[] }) {
  const [amount, setAmount] = useState(500)
  const [target, setTarget] = useState('') // '' = nothing chosen yet (must pick)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedPlayer = target && target !== ALL ? players.find((p) => p.id === target) ?? null : null
  const targetName = target === ALL ? 'all players' : selectedPlayer?.full_name || 'player'
  const canSend = target !== '' // must explicitly choose a recipient

  const send = async () => {
    if (!canSend) return
    setSending(true)
    setError(null)
    setResult(null)
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('admin_send_care_package', {
      p_user_id: target === ALL ? null : target,
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
        className="input-arcade mb-3 w-full px-4 py-2.5 text-sm"
      >
        <option value="">Select a player…</option>
        <option value={ALL}>All players</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>{p.full_name || 'Unknown'}</option>
        ))}
      </select>

      {/* Confirm exactly who the gift is going to. */}
      {selectedPlayer && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
          {selectedPlayer.avatar_url ? (
            <img src={selectedPlayer.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-sm text-zinc-500">?</div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{selectedPlayer.full_name || 'Unknown'}</p>
            <p className="text-xs text-amber-400">{selectedPlayer.gruten === -1 ? 'Infinite' : selectedPlayer.gruten.toLocaleString()} G</p>
          </div>
        </div>
      )}
      {!selectedPlayer && <div className="mb-5" />}

      <button onClick={send} disabled={sending || !canSend} className="btn-arcade w-full rounded-lg px-6 py-3 text-sm disabled:opacity-40">
        {sending ? 'Sending...' : !canSend ? 'Select a recipient' : `Send ${amount.toLocaleString()} G to ${targetName}`}
      </button>

      {result && <p className="mt-3 text-center text-sm text-green-400">📦 {result}</p>}
      {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}
    </div>
  )
}
