'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type User = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string
  gruten: number
}

export default function UserList({ users }: { users: User[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editGruten, setEditGruten] = useState(0)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const startEdit = (user: User) => {
    setEditingId(user.id)
    setEditGruten(user.gruten)
  }

  const handleSave = async () => {
    if (!editingId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.rpc('admin_set_gruten', {
      p_user_id: editingId,
      p_gruten: editGruten,
    })
    setEditingId(null)
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {users.map((user) => (
        <div key={user.id} className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-sm text-zinc-500">
              ?
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{user.full_name || 'No name'}</p>
              {user.role === 'admin' && (
                <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-medium">Admin</span>
              )}
            </div>
            <p className="text-xs text-zinc-500 truncate">{user.id.slice(0, 8)}</p>
          </div>

          {editingId === user.id ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editGruten}
                onChange={(e) => setEditGruten(Number(e.target.value))}
                className="w-24 rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-right text-sm text-white focus:border-zinc-500 focus:outline-none"
              />
              <span className="text-sm text-amber-400">G</span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded bg-white px-3 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-amber-400">
                {user.gruten === -1 ? 'Infinite' : user.gruten.toLocaleString()} G
              </span>
              <button
                onClick={() => startEdit(user)}
                className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
