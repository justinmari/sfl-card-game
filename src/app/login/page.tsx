'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const FALLBACK_TAGLINE = 'Collect. Build. Battle.'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tagline, setTagline] = useState(FALLBACK_TAGLINE)

  // Pull a random tagline from the DB (public-read; login is pre-auth).
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('login_taglines')
      .select('text')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setTagline(data[Math.floor(Math.random() * data.length)].text)
        }
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (!data.session) {
      setError('Login failed')
      setLoading(false)
      return
    }
    window.location.href = '/dashboard'
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      {/* Glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.35), rgba(217,70,239,0.18) 45%, transparent 70%)' }}
      />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-display text-5xl font-bold tracking-tight">
            <span className="text-arcade-gradient drop-shadow-[0_0_24px_rgba(167,139,250,0.45)]">SFL TCG</span>
          </h1>
          <p data-testid="login-tagline" className="text-sm text-zinc-400">{tagline}</p>
        </div>

        <form onSubmit={handleSubmit} className="surface flex w-full flex-col gap-3 rounded-2xl p-6 shadow-2xl">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-zinc-500 transition-colors focus:border-violet-400/70 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={6}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-zinc-500 transition-colors focus:border-violet-400/70 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-arcade mt-1 w-full rounded-lg px-6 py-3 text-sm"
          >
            {loading ? 'Loading...' : 'Sign In'}
          </button>

          {error && (
            <p data-testid="login-error" className="text-center text-sm text-red-400">{error}</p>
          )}
        </form>

        <p className="text-xs text-zinc-500">Invite only. Contact the admin to get an account.</p>
      </div>
    </div>
  )
}
