'use client'

import { useState } from 'react'
import TradingCard from '@/components/trading-card'
import CompactCard from '@/components/compact-card'

type Card = {
  id: string
  name: string
  image_url: string | null
  rarity: string
  description: string | null
  creature_name: string | null
  author_name?: string | null
  author_anonymous?: boolean | null
  edition?: string | null
}

type Player = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string
  top_cards: Card[]
  unique_cards?: number
  joined_at?: string | null
}

const fmtJoined = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null

export default function PlayerGrid({ players, currentUserId }: { players: Player[]; currentUserId: string }) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)

  return (
    <>
      {/* Player detail modal */}
      {selectedPlayer && (
        <div
          data-testid="player-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setSelectedPlayer(null)}
        >
          <div
            className="surface w-full max-w-2xl rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center gap-4">
              {selectedPlayer.avatar_url ? (
                <img src={selectedPlayer.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover border-2 border-zinc-700" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 border-2 border-zinc-700 text-2xl text-zinc-500">?</div>
              )}
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <span className="truncate">{selectedPlayer.full_name}</span>
                  {selectedPlayer.id === currentUserId && <span className="text-sm font-normal text-zinc-500">(You)</span>}
                  {selectedPlayer.role === 'admin' && (
                    <span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white">Admin</span>
                  )}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
                  <span>{selectedPlayer.unique_cards ?? 0} cards</span>
                  {fmtJoined(selectedPlayer.joined_at) && (
                    <><span className="text-zinc-600">·</span><span>Joined {fmtJoined(selectedPlayer.joined_at)}</span></>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => {
                const card = selectedPlayer.top_cards[i]
                return card ? (
                  <div key={card.id} className="flex justify-center">
                    <TradingCard card={card} size="sm" />
                  </div>
                ) : (
                  <div
                    key={i}
                    className="flex justify-center"
                  >
                    <div
                      className="w-[8.5rem] flex items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50"
                      style={{ aspectRatio: '5/8' }}
                    >
                      <span className="text-xs text-zinc-700">—</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => setSelectedPlayer(null)}
              className="mt-6 w-full rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Player grid — 2 per row */}
      <div data-testid="player-grid" className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {players.map((player) => (
          <button
            key={player.id}
            onClick={() => setSelectedPlayer(player)}
            className="tile-arcade cursor-pointer rounded-2xl p-6 text-left"
          >
            {/* Player info */}
            <div className="mb-4 flex items-center gap-4">
              {player.avatar_url ? (
                <img src={player.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-zinc-700" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 border-2 border-zinc-700 text-xl text-zinc-500">?</div>
              )}
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-base font-semibold">
                  <span className="truncate">{player.full_name}</span>
                  {player.id === currentUserId && <span className="text-sm font-normal text-zinc-500">(You)</span>}
                  {player.role === 'admin' && (
                    <span className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">Admin</span>
                  )}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                  <span>{player.unique_cards ?? 0} cards</span>
                  {fmtJoined(player.joined_at) && (
                    <><span className="text-zinc-700">·</span><span>Joined {fmtJoined(player.joined_at)}</span></>
                  )}
                </div>
              </div>
            </div>

            {/* Top 4 cards — always 4 slots */}
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map((i) => {
                const card = player.top_cards[i]
                return card ? (
                  <CompactCard key={card.id} card={card} />
                ) : (
                  <div
                    key={i}
                    className="flex items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/50"
                    style={{ aspectRatio: '3/4' }}
                  >
                    <span className="text-[10px] text-zinc-700">—</span>
                  </div>
                )
              })}
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
