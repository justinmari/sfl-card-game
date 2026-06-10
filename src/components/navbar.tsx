'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type NavbarProps = {
  avatarUrl?: string | null
  isAdmin?: boolean
  gruten?: number
  canClaimDaily?: boolean
  backHref?: string
  backLabel?: string
  title?: string
}

export default function Navbar({ avatarUrl, isAdmin, gruten, canClaimDaily, backHref, backLabel, title }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [showReward, setShowReward] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleClaim = async () => {
    const res = await fetch('/api/daily', { method: 'POST' })
    if (res.ok) {
      setClaimed(true)
      setShowReward(true)
      setTimeout(() => setShowReward(false), 3000)
      router.refresh()
    }
  }

  const grutenDisplay = gruten === undefined ? null : gruten === -1 ? 'Infinite' : gruten.toLocaleString()
  const showGift = canClaimDaily && !claimed

  return (
    <>
    <nav className="border-b border-zinc-800 px-6 py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-3">
          {backHref && (
            <Link href={backHref} className="text-zinc-400 hover:text-white">
              &larr; {backLabel || 'Back'}
            </Link>
          )}
          <Link href="/dashboard" className="text-xl font-bold text-white">
            {title || 'SFL TCG'}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {grutenDisplay !== null && (
            <div className="flex items-center gap-2">
              {showGift && (
                <button
                  onClick={handleClaim}
                  className="animate-bounce cursor-pointer text-lg transition-transform hover:scale-125"
                  title="Claim 500 daily Gruten!"
                >
                  🎁
                </button>
              )}
              <span className="rounded-lg bg-amber-950/50 px-3 py-1 text-sm font-medium text-amber-400">
                {grutenDisplay} G
              </span>
            </div>
          )}

          {isAdmin && (
            <span className="rounded bg-amber-600 px-2 py-0.5 text-xs font-medium text-white">
              Admin
            </span>
          )}

          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-zinc-700 transition-colors hover:border-zinc-500"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm text-zinc-400">?</span>
              )}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-36 rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>

    {/* Toast */}
    {showReward && (
      <div className="fixed bottom-6 right-6 z-50 animate-[slideUp_0.3s_ease-out] rounded-xl border border-amber-700 bg-zinc-900 px-5 py-3 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎁</span>
          <div>
            <p className="text-sm font-semibold text-white">Daily Reward Claimed!</p>
            <p className="text-xs text-amber-400">+500 Gruten added to your balance</p>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
