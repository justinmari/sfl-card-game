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
    <nav className="surface sticky top-0 z-40 border-b border-white/10 px-6 py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-3">
          {backHref && (
            <Link href={backHref} className="text-zinc-400 transition-colors hover:text-white">
              &larr; {backLabel || 'Back'}
            </Link>
          )}
          <Link href="/dashboard" className="font-display text-xl font-bold tracking-tight">
            <span className="text-arcade-gradient">{title || 'SFL TCG'}</span>
            {!title && <span className="ml-2 text-[10px] font-normal text-zinc-500">v0.3.1</span>}
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
              <span className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-sm font-semibold text-amber-300 shadow-[0_0_12px_-2px_rgba(245,158,11,0.45)]">
                <span aria-hidden className="text-amber-400">◈</span>
                {grutenDisplay} G
              </span>
            </div>
          )}

          {isAdmin && (
            <span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow-[0_0_12px_-2px_rgba(245,158,11,0.6)]">
              Admin
            </span>
          )}

          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Account menu"
              className="flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/15 transition-all hover:border-violet-400/70 hover:shadow-[0_0_12px_-2px_rgba(167,139,250,0.7)]"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm text-zinc-400">?</span>
              )}
            </button>

            {menuOpen && (
              <div className="surface absolute right-0 top-full z-50 mt-2 w-36 rounded-xl py-1 shadow-xl">
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full px-4 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Profile
                </Link>
                <Link
                  href="/preferences"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full px-4 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Preferences
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full px-4 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
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
      <div className="surface fixed bottom-6 right-6 z-50 animate-[slideUp_0.3s_ease-out] rounded-xl border border-amber-400/40 px-5 py-3 shadow-[0_0_24px_-4px_rgba(245,158,11,0.5)]">
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
