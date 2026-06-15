'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    }

    setSaving(false)
  }

  return (
    <div className="surface rounded-2xl p-6">
      <h2 className="font-display mb-4 text-lg font-semibold">Change Password</h2>

      {success && (
        <div className="mb-4 rounded-lg bg-green-900/50 px-4 py-2 text-sm text-green-300">
          Password updated successfully!
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            placeholder="At least 6 characters"
            className="input-arcade w-full px-4 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Repeat password"
            className="input-arcade w-full px-4 py-2.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="btn-arcade w-full rounded-lg px-6 py-2.5 text-sm"
        >
          {saving ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
