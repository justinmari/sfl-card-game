'use client'

import { useState } from 'react'
import TradingCard, { rarityColors, rarityGlow } from '@/components/trading-card'
import { rarityBadgeColors, rarityLabel } from '@/lib/rarities'

type Card = {
  id: string
  name: string
  image_url: string | null
  rarity: string
  description: string | null
  creature_name: string | null
}

type Player = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string
  top_cards: Card[]
}

export default function PlayerGrid({ players, currentUserId }: { players: Player[]; currentUserId: string }) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)

  return (
    <>
      {/* Player detail modal */}
      {selectedPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setSelectedPlayer(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center gap-4">
              {selectedPlayer.avatar_url ? (
                <img src={selectedPlayer.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover border-2 border-zinc-700" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 border-2 border-zinc-700 text-2xl text-zinc-500">?</div>
              )}
              <div>
                <h2 className="text-xl font-bold">
                  {selectedPlayer.full_name}
                  {selectedPlayer.id === currentUserId && <span className="ml-2 text-sm text-zinc-500">(You)</span>}
                </h2>
                {selectedPlayer.role === 'admin' && (
                  <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-medium">Admin</span>
                )}
              </div>
            </div>

            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => {
                const card = selectedPlayer.top_cards[i]
                return card ? (
                  <TradingCard key={card.id} card={card} size="sm" />
                ) : (
                  <div
                    key={i}
                    className="w-[8.5rem] rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 flex items-center justify-center"
                    style={{ minHeight: '12rem' }}
                  >
                    <span className="text-xs text-zinc-700">—</span>
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => setSelectedPlayer(null)}
              className="mt-6 w-full rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Player grid — 2 per row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {players.map((player) => (
          <button
            key={player.id}
            onClick={() => setSelectedPlayer(player)}
            className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-left transition-colors hover:border-zinc-600"
          >
            {/* Player info */}
            <div className="mb-4 flex items-center gap-4">
              {player.avatar_url ? (
                <img src={player.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-zinc-700" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 border-2 border-zinc-700 text-xl text-zinc-500">?</div>
              )}
              <div>
                <p className="text-base font-semibold">
                  {player.full_name}
                  {player.id === currentUserId && <span className="ml-1 text-sm text-zinc-500">(You)</span>}
                </p>
                {player.role === 'admin' && (
                  <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[9px] font-medium">Admin</span>
                )}
              </div>
            </div>

            {/* Top 4 cards — always 4 slots */}
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3].map((i) => {
                const card = player.top_cards[i]
                return card ? (
                  <div
                    key={card.id}
                    className={`w-[4.5rem] overflow-hidden rounded-lg border ${rarityColors[card.rarity]} ${rarityGlow[card.rarity]} transition-transform duration-200 hover:scale-105`}
                  >
                    {card.image_url ? (
                      <img src={card.image_url} alt={card.name} className="aspect-square w-full object-cover" />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-zinc-800 text-lg">🃏</div>
                    )}
                    <div className="bg-zinc-900 px-1 py-1 text-center">
                      <p className="truncate text-[8px] font-semibold text-white">{card.name}</p>
                      <span className={`inline-block rounded px-1 py-0.5 text-[7px] ${rarityBadgeColors[card.rarity]}`}>
                        {rarityLabel[card.rarity] || card.rarity}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    key={i}
                    className="flex w-[4.5rem] items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/50"
                    style={{ aspectRatio: '3/5' }}
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
