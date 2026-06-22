'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Player = { id: string; full_name: string | null }

type Txn = {
  id: string
  user_id: string
  type: string
  amount: number
  balance_after: number
  metadata: Record<string, unknown> | null
  created_at: string
}

const PAGE_SIZE = 25

const TYPE_LABEL: Record<string, string> = {
  pack_purchase: 'Pack purchase',
  admin_grant: 'Admin grant',
  daily_claim: 'Daily claim',
  arena_reward: 'Arena reward',
  card_scrap: 'Card scrap',
  care_package: 'Care package',
  suggestion_reward: 'Suggestion reward',
}

export default function TransactionLog({ players = [] }: { players?: Player[] }) {
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<Txn[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('')
  const [filterUser, setFilterUser] = useState<string>('')

  // id → display name, from the players list (transactions have no FK to profiles).
  const names = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of players) map[p.id] = p.full_name || p.id.slice(0, 8)
    return map
  }, [players])

  const load = useCallback(async (p: number) => {
    setLoading(true)
    const supabase = createClient()
    const from = p * PAGE_SIZE
    let query = supabase
      .from('gruten_transactions')
      .select('id, user_id, type, amount, balance_after, metadata, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filterType) query = query.eq('type', filterType)
    if (filterUser) query = query.eq('user_id', filterUser)
    const { data, count } = await query.range(from, from + PAGE_SIZE - 1)

    setRows((data || []) as Txn[])
    setTotal(count ?? 0)
    setLoading(false)
  }, [filterType, filterUser])

  // Reset to the first page whenever a filter changes.
  useEffect(() => { setPage(0) }, [filterType, filterUser])
  useEffect(() => { load(page) }, [page, load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fmtDate = (s: string) => new Date(s).toLocaleString()

  return (
    <div data-testid="transaction-log">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Gruten Transactions</h2>
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
        <select
          aria-label="Filter by type"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
        >
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {(filterType || filterUser) && (
          <button
            onClick={() => { setFilterType(''); setFilterUser('') }}
            className="text-xs text-zinc-400 transition-colors hover:text-white"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="surface overflow-hidden rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-right">When</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-zinc-500">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-zinc-500">No transactions.</td></tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} data-testid="txn-row" className="border-t border-white/5">
                  <td className="px-3 py-2">{names[t.user_id] ?? t.user_id.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-zinc-300">{TYPE_LABEL[t.type] ?? t.type}</td>
                  <td className={`px-3 py-2 text-right font-mono ${t.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {t.amount >= 0 ? '+' : ''}{t.amount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-400">{t.balance_after === -1 ? '∞' : t.balance_after.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-xs text-zinc-500">{fmtDate(t.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
