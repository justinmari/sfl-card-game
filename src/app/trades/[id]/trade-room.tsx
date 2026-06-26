'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import CardSelector, { type SelectorCard } from '@/components/card-selector'
import CompactCard from '@/components/compact-card'
import SwipeableReveal from '@/components/swipeable-reveal'
import { createClient } from '@/lib/supabase/client'
import { notifyPlayer } from '@/lib/trade-notify'
import { ownedEditionsRarestFirst, EDITION_DOT, EDITION_LABEL, type Edition } from '@/lib/editions'

export type FlatCard = {
  card_id: string; name: string; image_url: string | null; rarity: string
  creature_name: string | null; edition: string; count: number
}
export type SessionCard = {
  owner_id: string; card_id: string; name: string; image_url: string | null; rarity: string
  description: string | null; creature_name: string | null; typeNames: string[]
  edition: string; quantity: number; recipient_new: boolean
}
export type Session = {
  id: string; status: 'open' | 'completed' | 'cancelled' | 'expired'
  initiator_id: string; partner_id: string
  initiator_locked: boolean; partner_locked: boolean
  initiator_confirmed: boolean; partner_confirmed: boolean
  initiator: { id: string; full_name: string | null; avatar_url: string | null }
  partner: { id: string; full_name: string | null; avatar_url: string | null }
  cards: SessionCard[]
}
type Line = { card_id: string; edition: string; quantity: number }

function buildSelectorCards(rows: FlatCard[]): SelectorCard[] {
  const byCard = new Map<string, SelectorCard & { editions: Record<string, number> }>()
  for (const r of rows) {
    const ex = byCard.get(r.card_id)
    if (ex) ex.editions[r.edition] = (ex.editions[r.edition] ?? 0) + r.count
    else byCard.set(r.card_id, {
      id: r.card_id, name: r.name, image_url: r.image_url, rarity: r.rarity,
      creature_name: r.creature_name, editions: { [r.edition]: r.count },
    })
  }
  return [...byCard.values()]
}

function Avatar({ url }: { url: string | null }) {
  return url
    ? <img src={url} alt="" className="h-8 w-8 rounded-full object-cover" />
    : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs">?</span>
}

type StagedView = { card_id: string; name: string; image_url: string | null; rarity: string; creature_name: string | null; edition: string; quantity: number }
function StagedCards({ cards }: { cards: StagedView[] }) {
  if (cards.length === 0) return <p className="py-6 text-center text-sm text-zinc-600">Nothing staged yet</p>
  return (
    <div className="flex flex-wrap gap-2">
      {cards.map((c) => (
        <div key={`${c.card_id}:${c.edition}`} className="w-16 sm:w-20">
          <CompactCard
            card={{ id: c.card_id, name: c.name, image_url: c.image_url, rarity: c.rarity, creature_name: c.creature_name, edition: c.edition }}
            count={c.quantity > 1 ? c.quantity : undefined}
          />
        </div>
      ))}
    </div>
  )
}

export default function TradeRoom({
  sessionId, meId, myName, initialSession, myCards,
}: {
  sessionId: string
  meId: string
  myName: string
  initialSession: Session
  myCards: FlatCard[]
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const mySelectorCards = useMemo(() => buildSelectorCards(myCards), [myCards])

  const [session, setSession] = useState<Session>(initialSession)
  const [lines, setLines] = useState<Line[]>(() =>
    initialSession.cards.filter((c) => c.owner_id === meId).map((c) => ({ card_id: c.card_id, edition: c.edition, quantity: c.quantity })))
  const [received, setReceived] = useState<SessionCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [partnerOnline, setPartnerOnline] = useState(false)
  const [partnerSeen, setPartnerSeen] = useState(false)
  const [busy, setBusy] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const iAmInitiator = session.initiator_id === meId
  const partner = iAmInitiator ? session.partner : session.initiator
  const myLocked = iAmInitiator ? session.initiator_locked : session.partner_locked
  const theirLocked = iAmInitiator ? session.partner_locked : session.initiator_locked
  const myConfirmed = iAmInitiator ? session.initiator_confirmed : session.partner_confirmed
  const theirConfirmed = iAmInitiator ? session.partner_confirmed : session.initiator_confirmed
  const partnerStaged = session.cards.filter((c) => c.owner_id === partner.id)
  const byId = useMemo(() => new Map(mySelectorCards.map((c) => [c.id, c])), [mySelectorCards])

  const refetch = useCallback(async () => {
    const { data } = await supabase.rpc('get_trade_session', { p_session_id: sessionId })
    if (!data) return
    const s = data as Session
    setSession(s)
    if (s.status === 'completed') {
      const recv = s.cards.filter((c) => c.owner_id !== meId)
      if (recv.length > 0) setReceived(recv)
      else { router.push('/trades'); router.refresh() }
    } else if (s.status === 'cancelled' || s.status === 'expired') {
      router.push('/trades')
    }
  }, [supabase, sessionId, meId, router])

  useEffect(() => {
    const ch = supabase.channel(`trade-session-${sessionId}`, { config: { presence: { key: meId } } })
    channelRef.current = ch
    ch.on('broadcast', { event: 'changed' }, () => { refetch() })
      .on('presence', { event: 'sync' }, () => {
        const ids = Object.keys(ch.presenceState())
        const present = ids.some((id) => id !== meId)
        setPartnerOnline(present)
        if (present) setPartnerSeen(true)
      })
      .subscribe(async (status) => { if (status === 'SUBSCRIBED') await ch.track({ online: true }) })
    // Realtime broadcasts (stage/lock/confirm/cancel) are the actual sync path
    // and update the UI instantly. This slow tick only (a) heartbeats updated_at
    // via get_trade_session's touch-on-read so stale-cleanup knows the room is
    // still open, and (b) recovers from a rare missed broadcast. 30s is well
    // inside the 3-min cleanup window; it is not the sync mechanism.
    const poll = setInterval(refetch, 30000)
    return () => { clearInterval(poll); supabase.removeChannel(ch) }
  }, [supabase, sessionId, meId, refetch])

  const ping = () => channelRef.current?.send({ type: 'broadcast', event: 'changed', payload: {} })

  const pushStage = async (next: Line[]) => {
    setLines(next)
    const { error } = await supabase.rpc('set_trade_stage', { p_session_id: sessionId, p_cards: next })
    if (error) { setError(error.message); return }
    ping(); refetch()
  }
  const toggle = (id: string) => {
    if (lines.some((l) => l.card_id === id)) { pushStage(lines.filter((l) => l.card_id !== id)); return }
    const c = byId.get(id)
    // Default to the LOWEST finish owned (ownedEditionsRarestFirst is rarest→
    // lowest) so a player never accidentally stages their best copy — they opt
    // up via the finish chips.
    const ed = (ownedEditionsRarestFirst(c?.editions ?? {}).at(-1) ?? 'regular') as string
    pushStage([...lines, { card_id: id, edition: ed, quantity: 1 }])
  }
  const update = (id: string, patch: Partial<Line>) =>
    pushStage(lines.map((l) => (l.card_id === id ? { ...l, ...patch } : l)))

  const setLock = async (v: boolean) => {
    setBusy(true)
    const { error } = await supabase.rpc('set_trade_lock', { p_session_id: sessionId, p_locked: v })
    setBusy(false)
    if (error) { setError(error.message); return }
    ping(); refetch()
  }
  const confirm = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('confirm_trade_session', { p_session_id: sessionId })
    setBusy(false)
    if (error) { setError(error.message); return }
    ping(); refetch()
  }
  const cancel = async () => {
    await supabase.rpc('cancel_trade_session', { p_session_id: sessionId })
    ping() // in-room partner refetches → sees cancelled → leaves
    await notifyPlayer(partner.id, 'cancelled', { fromName: myName }) // toast naming who cancelled
    router.push('/trades')
  }

  // Completed → reveal the cards I received, pack-style (no pack).
  if (received) {
    const revealCards = received.flatMap((c) =>
      Array.from({ length: c.quantity }, () => ({
        id: c.card_id, name: c.name, image_url: c.image_url, rarity: c.rarity,
        edition: c.edition, creature_name: c.creature_name, description: c.description,
        typeNames: c.typeNames, is_new: c.recipient_new,
      })))
    return (
      <SwipeableReveal
        cards={revealCards}
        cardsPerPack={revealCards.length}
        coverless
        headline="You received:"
        onDone={() => { router.push('/trades'); router.refresh() }}
      />
    )
  }

  const bothLocked = myLocked && theirLocked

  // My side, derived from local lines (instant) + display fields from byId.
  const myStagedView: StagedView[] = lines.map((l) => {
    const c = byId.get(l.card_id)
    return {
      card_id: l.card_id, name: c?.name ?? 'Card', image_url: c?.image_url ?? null,
      rarity: c?.rarity ?? 'common', creature_name: c?.creature_name ?? null,
      edition: l.edition, quantity: l.quantity,
    }
  })

  // Partner presence in THIS room: present / never-joined / left.
  const presence = partnerOnline
    ? { label: 'In the room', dot: 'bg-emerald-400', text: 'text-emerald-400' }
    : partnerSeen
      ? { label: 'Left the room', dot: 'bg-amber-400', text: 'text-amber-400' }
      : { label: 'Hasn’t joined yet', dot: 'bg-zinc-600', text: 'text-zinc-500' }

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar url={partner.avatar_url} />
          <div>
            <p className="text-xs text-zinc-500">Trading with</p>
            <p className="font-medium">{partner.full_name ?? 'Unknown'}</p>
          </div>
        </div>
        <span
          data-testid="partner-presence"
          className={`flex items-center gap-1.5 text-xs ${presence.text}`}
        >
          <span className={`h-2 w-2 rounded-full ${presence.dot} ${partnerOnline ? 'animate-pulse' : ''}`} />
          {presence.label}
        </span>
      </div>

      {/* Make absence obvious: a trade can't complete unless they're here. */}
      {!partnerOnline && (
        <div className="mb-4 rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-400">
          {partnerSeen
            ? `${partner.full_name ?? 'Your partner'} left the trade room — they need to come back to finish.`
            : `Waiting for ${partner.full_name ?? 'your partner'} to join. They've been notified.`}
        </div>
      )}

      {error && <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">{error}</div>}

      {/* TOP: what each side is putting up, side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="surface rounded-xl border border-white/10 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-amber-400">You give</h3>
            {myLocked && <span className="text-xs font-medium text-emerald-400">✓ Locked</span>}
          </div>
          <StagedCards cards={myStagedView} />
        </div>
        <div className="surface rounded-xl border border-white/10 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-sky-400">You get</h3>
            {theirLocked && <span className="text-xs font-medium text-emerald-400">✓ Locked</span>}
          </div>
          <StagedCards cards={partnerStaged} />
        </div>
      </div>

      {/* MIDDLE: lock / confirm */}
      <div className="my-5 flex flex-wrap items-center justify-center gap-3">
        <button onClick={cancel} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white">
          Cancel
        </button>
        {!myLocked ? (
          <button onClick={() => setLock(true)} disabled={busy} className="btn-arcade rounded-lg px-6 py-2.5 text-sm disabled:opacity-50">
            Lock my offer
          </button>
        ) : !bothLocked ? (
          <>
            <button onClick={() => setLock(false)} disabled={busy} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white disabled:opacity-50">Unlock</button>
            <span className="text-sm text-zinc-400">Waiting for {partner.full_name ?? 'partner'} to lock…</span>
          </>
        ) : myConfirmed ? (
          <span className="text-sm text-emerald-400">Confirmed — waiting for {partner.full_name ?? 'partner'}…</span>
        ) : (
          <>
            <button onClick={() => setLock(false)} disabled={busy} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white disabled:opacity-50">Unlock</button>
            <button onClick={confirm} disabled={busy} className="btn-arcade rounded-lg px-6 py-2.5 text-sm disabled:opacity-50">
              Confirm trade {theirConfirmed ? '(they’re ready!)' : ''}
            </button>
          </>
        )}
      </div>

      {/* BOTTOM: choose your cards */}
      <div className="surface rounded-xl border border-white/10 p-4">
        <h3 className="font-display mb-3 text-sm font-bold uppercase tracking-widest text-zinc-400">Choose your cards</h3>
        {myLocked ? (
          <p className="py-6 text-center text-sm text-zinc-500">Your offer is locked. Unlock above to change it.</p>
        ) : mySelectorCards.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-600">You have no cards to trade.</p>
        ) : (
          <>
            {lines.length > 0 && (
              <div className="mb-3 space-y-2">
                {lines.map((l) => {
                  const c = byId.get(l.card_id)
                  const eds = ownedEditionsRarestFirst(c?.editions ?? {})
                  const maxQ = c?.editions?.[l.edition as Edition] ?? 1
                  return (
                    <div key={l.card_id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 p-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-medium">{c?.name ?? 'Card'}</span>
                      {eds.length > 1 && (
                        <div className="flex gap-1">
                          {eds.map((e) => (
                            <button key={e} type="button"
                              onClick={() => update(l.card_id, { edition: e, quantity: Math.min(l.quantity, c?.editions?.[e] ?? 1) })}
                              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${e === l.edition ? 'bg-violet-600/30 text-white' : 'text-zinc-400 hover:bg-white/5'}`}>
                              <span className={`h-2 w-2 rounded-full ${EDITION_DOT[e]}`} aria-hidden />{EDITION_LABEL[e]}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <button type="button" disabled={l.quantity <= 1} onClick={() => update(l.card_id, { quantity: l.quantity - 1 })}
                          className="flex h-6 w-6 items-center justify-center rounded border border-white/10 disabled:opacity-30">−</button>
                        <span className="w-5 text-center tabular-nums">{l.quantity}</span>
                        <button type="button" disabled={l.quantity >= maxQ} onClick={() => update(l.card_id, { quantity: l.quantity + 1 })}
                          className="flex h-6 w-6 items-center justify-center rounded border border-white/10 disabled:opacity-30">+</button>
                      </div>
                      <button type="button" onClick={() => toggle(l.card_id)} className="text-zinc-500 transition-colors hover:text-red-400" aria-label="Remove">✕</button>
                    </div>
                  )
                })}
              </div>
            )}
            <CardSelector cards={mySelectorCards} selectedIds={lines.map((l) => l.card_id)} onToggle={toggle} max={12} pageSize={12} />
          </>
        )}
      </div>
    </div>
  )
}
