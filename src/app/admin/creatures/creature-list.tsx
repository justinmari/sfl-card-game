'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Creature = {
  id: string
  name: string
  created_at: string
}

export default function CreatureList({ creatures }: { creatures: Creature[] }) {
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('creatures').insert({ name: name.trim() })
    setName('')
    setSaving(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this creature? Cards using it will show "Unknown".')) return
    const supabase = createClient()
    await supabase.from('creatures').delete().eq('id', id)
    router.refresh()
  }

  const startEdit = (creature: Creature) => {
    setEditingId(creature.id)
    setEditName(creature.name)
  }

  const handleSave = async () => {
    if (!editName.trim() || !editingId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('creatures').update({ name: editName.trim() }).eq('id', editingId)
    setEditingId(null)
    setSaving(false)
    router.refresh()
  }

  return (
    <div>
      {/* Add form */}
      <form onSubmit={handleAdd} className="mb-8 flex gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a creature name..."
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-lg bg-white px-6 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {/* List */}
      {creatures.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">No creatures yet. Add your first one above!</p>
      ) : (
        <div className="space-y-2">
          {creatures.map((creature) => (
            <div key={creature.id} data-testid="creature-row" className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
              {editingId === creature.id ? (
                <div className="flex flex-1 items-center gap-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded border border-zinc-600 bg-zinc-700 px-3 py-1 text-sm text-white focus:border-zinc-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded bg-white px-3 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-200"
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
                <>
                  <span className="text-sm font-medium">{creature.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(creature)}
                      className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(creature.id)}
                      className="rounded border border-red-800 px-3 py-1 text-xs text-red-400 hover:bg-red-900/30"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
