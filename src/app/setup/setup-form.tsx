'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'

export default function SetupForm() {
  const [name, setName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setPreview(URL.createObjectURL(selected))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Update password
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword })
      if (pwError) throw pwError

      let avatarUrl: string | null = null

      if (file) {
        const compressed = await compressImage(file, 200, 200, 0.9)
        const fileName = `avatars/${user.id}-${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('card-images')
          .upload(fileName, compressed, { contentType: 'image/jpeg' })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage
          .from('card-images')
          .getPublicUrl(fileName)
        avatarUrl = publicUrl
      } else {
        // Generate default avatar from initials
        const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        const colors = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899']
        const color = colors[name.trim().length % colors.length]
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" rx="100" fill="${color}"/><text x="100" y="108" text-anchor="middle" font-family="system-ui,sans-serif" font-size="80" font-weight="bold" fill="white">${initials}</text></svg>`
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const fileName = `avatars/${user.id}-${Date.now()}.svg`
        const { error: uploadError } = await supabase.storage
          .from('card-images')
          .upload(fileName, blob, { contentType: 'image/svg+xml' })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage
          .from('card-images')
          .getPublicUrl(fileName)
        avatarUrl = publicUrl
      }

      // Update auth user metadata
      await supabase.auth.updateUser({
        data: { full_name: name.trim(), avatar_url: avatarUrl },
      })

      // Update profile via RPC
      const { error: rpcError } = await supabase.rpc('setup_profile', {
        p_full_name: name.trim(),
        p_avatar_url: avatarUrl,
      })
      if (rpcError) throw rpcError

      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm px-6">
      <h1 className="mb-2 text-2xl font-bold text-white">Welcome to SFL TCG!</h1>
      <p className="mb-8 text-sm text-zinc-400">Set up your profile to get started.</p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-5">
        <label className="mb-2 block text-sm text-zinc-400">Display Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="What should we call you?"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div className="mb-5">
        <label className="mb-2 block text-sm text-zinc-400">New Password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          placeholder="At least 6 characters"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div className="mb-5">
        <label className="mb-2 block text-sm text-zinc-400">Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          placeholder="Repeat password"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div className="mb-8">
        <label className="mb-2 block text-sm text-zinc-400">Avatar (optional)</label>
        <div className="flex items-center gap-4">
          {preview ? (
            <img src={preview} alt="Avatar" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 text-2xl text-zinc-600">
              ?
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-zinc-600"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving || !name.trim() || !newPassword}
        className="w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
      >
        {saving ? 'Setting up...' : 'Get Started'}
      </button>
    </form>
  )
}
