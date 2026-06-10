'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DailyClaim({ alreadyClaimed }: { alreadyClaimed: boolean }) {
  const [claimed, setClaimed] = useState(alreadyClaimed)
  const [claiming, setClaiming] = useState(false)
  const [showReward, setShowReward] = useState(false)
  const router = useRouter()

  const handleClaim = async () => {
    setClaiming(true)
    try {
      const res = await fetch('/api/daily', { method: 'POST' })
      if (res.ok) {
        setClaimed(true)
        setShowReward(true)
        setTimeout(() => setShowReward(false), 2000)
        router.refresh()
      }
    } finally {
      setClaiming(false)
    }
  }

  if (claimed) return null

  return (
    <div className="relative mb-8">
      <button
        onClick={handleClaim}
        disabled={claiming}
        className="flex items-center gap-3 rounded-xl border border-amber-700 bg-gradient-to-r from-amber-950/50 to-amber-900/30 px-6 py-4 transition-all hover:border-amber-500 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] disabled:opacity-50"
      >
        <span className="text-3xl animate-bounce">🎁</span>
        <div className="text-left">
          <p className="font-semibold text-amber-400">Daily Reward</p>
          <p className="text-sm text-zinc-400">Claim 200 Gruten!</p>
        </div>
      </button>

      {showReward && (
        <span className="absolute -top-6 left-16 animate-bounce text-lg font-bold text-amber-400">
          +200 G!
        </span>
      )}
    </div>
  )
}
