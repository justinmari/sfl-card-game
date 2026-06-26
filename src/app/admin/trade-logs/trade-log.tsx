'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EDITION_DOT, type Edition } from '@/lib/editions'

type Player = { id: string; full_name: string | null }
type AuditCard = { card_id: string; name: string; edition: string; quantity: number; rarity: string }
type Audit = {
  id: string
  initiator_id: string | null
  partner_id: string | null
  initiator_name: string | null
  partner_name: string | null
  initiator_cards: AuditCard[]
  partner_cards: AuditCard[]
  completed_at: string
}

const PAGE_SIZE = 20

function Cards({ cards }: { cards: AuditCard[] }) {
  if (!cards || cards.length === 0) return <span className="text-xs text-zinc-600">nothing</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {cards.map((c) => (
        <span key={`${c.card_id}:${c.edition}`} className="inline-flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 text-xs">
          <span className={`h-1.5 w-1.5 rounded-full ${EDITION_DOT[c.edition as Edition] ?? 'bg-zinc-400'}`} aria-hidden />
          {c.name}{c.quantity > 1 ? ` ×${c.quantity}` : ''}
        </span>
      ))}
    </div>
  )
}

export default function TradeLog({ players = [] }: { players?: Player[] }) {
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<Audit[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterUser, setFilterUser] = useState('')

  const load = useCallback(async (p: number) => {
    setLoading(true)
    const supabase = createClient()
    const from = p * PAGE_SIZE
    let query = supabase
      .from('trade_audit')
      .select('id, initiator_id, partner_id, initiator_name, partner_name, initiator_cards, partner_cards, completed_at', { count: 'exact' })
      .order('completed_at', { ascending: false })
    if (filterUser) query = query.or(`initiator_id.eq.${filterUser},partner_id.eq.${filterUser}`)
    const { data, count } = await query.range(from, from + PAGE_SIZE - 1)
    setRows((data || []) as Audit[])
    setTotal(count ?? 0)
    setLoading(false)
  }, [filterUser])

  useEffect(() => { setPage(0) }, [filterUser])
  useEffect(() => { load(page) }, [page, load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fmtDate = (s: string) => new Date(s).toLocaleString()

  return (
    <div data-testid="trade-log">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Completed Trades</h2>
        <span className="text-sm text-zinc-500">{total.toLocaleString()} total</span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Filter by player"
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
        >
          <option value="">All players</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 8)}</option>
          ))}
        </select>
        {filterUser && (
          <button onClick={() => setFilterUser('')} className="text-xs text-zinc-400 transition-colors hover:text-white">Clear filter</button>
        )}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">No completed trades.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => (
            <div key={t.id} data-testid="trade-log-row" className="surface rounded-xl border border-white/10 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {t.initiator_name || t.initiator_id?.slice(0, 8) || 'Unknown'}
                  <span className="mx-1.5 text-zinc-500">⇄</span>
                  {t.partner_name || t.partner_id?.slice(0, 8) || 'Unknown'}
                </p>
                <span className="text-xs text-zinc-500">{fmtDate(t.completed_at)}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">{t.initiator_name || 'Initiator'} gave</p>
                  <Cards cards={t.initiator_cards} />
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">{t.partner_name || 'Partner'} gave</p>
                  <Cards cards={t.partner_cards} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-40"
        >← Prev</button>
        <span className="text-sm text-zinc-500">Page {page + 1} of {totalPages}</span>
        <button
          onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
          disabled={page + 1 >= totalPages || loading}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-40"
        >Next →</button>
      </div>
    </div>
  )
}
