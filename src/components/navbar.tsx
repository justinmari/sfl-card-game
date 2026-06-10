'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type NavbarProps = {
  avatarUrl?: string | null
  isAdmin?: boolean
  gruten?: number
  backHref?: string
  backLabel?: string
  title?: string
}

export default function Navbar({ avatarUrl, isAdmin, gruten, backHref, backLabel, title }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
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

  const grutenDisplay = gruten === undefined ? null : gruten === -1 ? 'Infinite' : gruten.toLocaleString()

  return (
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
            <span className="rounded-lg bg-amber-950/50 px-3 py-1 text-sm font-medium text-amber-400">
              {grutenDisplay} G
            </span>
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
  )
}
