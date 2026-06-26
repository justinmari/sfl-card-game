'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { notifyPlayer } from '@/lib/trade-notify'

export type PlayerOption = { id: string; full_name: string | null; avatar_url: string | null }
export type ActiveTrade = {
  id: string
  partnerId: string
  partnerName: string
  partnerAvatar: string | null
  role: 'incoming' | 'outgoing'
}

function Avatar({ url }: { url: string | null }) {
  return url
    ? <img src={url} alt="" className="h-9 w-9 rounded-full object-cover" />
    : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-sm">?</span>
}

export default function TradesLanding({ active, players, myName }: { active: ActiveTrade | null; players: PlayerOption[]; myName: string }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // You can only be in one trade at a time, so an active session takes over the page.
  if (active) {
    const cancel = async () => {
      setBusy(true)
      const supabase = createClient()
      await supabase.rpc('cancel_trade_session', { p_session_id: active.id })
      await notifyPlayer(active.partnerId, 'cancelled', { fromName: myName })
      setBusy(false)
      router.refresh()
    }
    return (
      <div className="surface rounded-2xl border border-white/10 p-6 text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <Avatar url={active.partnerAvatar} />
          <div className="text-left">
            <p className="text-xs text-zinc-500">{active.role === 'incoming' ? 'Trade invite from' : 'Live trade with'}</p>
            <p className="font-medium">{active.partnerName}</p>
          </div>
        </div>
        <div className="flex justify-center gap-3">
          <Link href={`/trades/${active.id}`} className="btn-arcade rounded-lg px-6 py-2.5 text-sm">
            {active.role === 'incoming' ? 'Join trade' : 'Open trade'}
          </Link>
          <button onClick={cancel} disabled={busy} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const start = async (partnerId: string) => {
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('create_trade_session', { p_partner_id: partnerId })
    if (error) { setBusy(false); setError(error.message); return }
    // Real-time ping so the partner gets an instant "join" toast if they're online.
    await notifyPlayer(partnerId, 'invite', { sessionId: data, fromName: myName })
    setBusy(false)
    router.push(`/trades/${data}`)
  }

  const shown = players.filter((p) => (p.full_name ?? '').toLowerCase().includes(search.toLowerCase()))
  return (
    <div>
      <h2 className="font-display mb-1 text-xl font-bold">Start a trade</h2>
      <p className="mb-4 text-sm text-zinc-500">Pick a player — you&apos;ll both enter a live trade room.</p>
      {error && <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">{error}</div>}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search players"
        className="input-arcade mb-4 w-full px-4 py-2.5 text-sm"
      />
      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">No players found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {shown.map((p) => (
            <button key={p.id} disabled={busy} onClick={() => start(p.id)}
              className="surface flex items-center gap-3 rounded-xl border border-white/10 p-3 text-left transition-colors hover:border-violet-400/50 hover:bg-white/5 disabled:opacity-50">
              <Avatar url={p.avatar_url} />
              <span className="font-medium">{p.full_name ?? 'Unknown'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
