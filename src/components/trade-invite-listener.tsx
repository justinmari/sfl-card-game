'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Toast =
  | { kind: 'invite'; sessionId: string; fromName: string }
  | { kind: 'cancelled'; fromName: string }

/**
 * App-wide listener (mounted in the navbar) for trade events on your personal
 * Supabase Realtime channel — a direct WebSocket to Supabase, so no Vercel
 * cost. Pops a toast when someone opens a trade room with you, or when the
 * other player cancels a trade you're in. Only fires while a tab is open.
 */
export default function TradeInviteListener({ userId }: { userId: string }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const show = (t: Toast) => {
      setToast(t)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setToast(null), 15000)
    }
    const channel = supabase.channel(`trade-invites-${userId}`)
    channel
      .on('broadcast', { event: 'invite' }, ({ payload }) =>
        show({ kind: 'invite', sessionId: payload.sessionId, fromName: payload.fromName || 'Someone' }))
      .on('broadcast', { event: 'cancelled' }, ({ payload }) =>
        show({ kind: 'cancelled', fromName: payload.fromName || 'The other player' }))
      .subscribe()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [userId])

  if (!toast) return null

  if (toast.kind === 'cancelled') {
    return (
      <div data-testid="trade-cancel-toast" className="surface fixed bottom-6 right-6 z-50 animate-[slideUp_0.3s_ease-out] rounded-xl border border-amber-400/40 px-5 py-3 shadow-[0_0_24px_-4px_rgba(245,158,11,0.5)]">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚫</span>
          <p className="text-sm font-semibold text-white">{toast.fromName} cancelled the trade.</p>
          <button onClick={() => setToast(null)} aria-label="Dismiss" className="ml-2 self-start text-zinc-500 transition-colors hover:text-white">✕</button>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="trade-invite-toast" className="surface fixed bottom-6 right-6 z-50 animate-[slideUp_0.3s_ease-out] rounded-xl border border-violet-400/40 px-5 py-3 shadow-[0_0_24px_-4px_rgba(139,92,246,0.55)]">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🤝</span>
        <div>
          <p className="text-sm font-semibold text-white">{toast.fromName} wants to trade!</p>
          <Link
            href={`/trades/${toast.sessionId}`}
            onClick={() => setToast(null)}
            className="text-xs font-medium text-violet-300 underline transition-colors hover:text-violet-200"
          >
            Click here to join the trade room
          </Link>
        </div>
        <button onClick={() => setToast(null)} aria-label="Dismiss" className="ml-2 self-start text-zinc-500 transition-colors hover:text-white">✕</button>
      </div>
    </div>
  )
}
