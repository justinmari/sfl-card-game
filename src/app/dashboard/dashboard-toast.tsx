'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const TOAST_MESSAGES: Record<string, string> = {
  'arena-disabled': 'Arena has been disabled by an admin. All sessions have been ended.',
}

export default function DashboardToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const toast = searchParams.get('toast')
    if (toast && TOAST_MESSAGES[toast]) {
      setMessage(TOAST_MESSAGES[toast])
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [searchParams, router])

  if (!message) return null

  return (
    <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl border border-red-800 bg-red-950 px-5 py-3 shadow-lg shadow-red-950/50">
        <span className="text-sm text-red-300">{message}</span>
        <button
          onClick={() => setMessage(null)}
          className="text-red-400 hover:text-red-300"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
