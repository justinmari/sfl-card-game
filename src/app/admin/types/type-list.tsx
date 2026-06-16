'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type CardType = {
  id: string
  name: string
  description: string | null
  created_at: string
}

export default function TypeList({ types }: { types: CardType[] }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('types').insert({ name: name.trim(), description: description.trim() || null })
    setName('')
    setDescription('')
    setSaving(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this type? It will be removed from all cards using it.')) return
    const supabase = createClient()
    await supabase.from('types').delete().eq('id', id)
    router.refresh()
  }

  const startEdit = (type: CardType) => {
    setEditingId(type.id)
    setEditName(type.name)
    setEditDescription(type.description || '')
  }

  const handleSave = async () => {
    if (!editName.trim() || !editingId) return
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('types')
      .update({ name: editName.trim(), description: editDescription.trim() || null })
      .eq('id', editingId)
    setEditingId(null)
    setSaving(false)
    router.refresh()
  }

  return (
    <div>
      {/* Add form */}
      <form onSubmit={handleAdd} className="mb-8 flex flex-wrap gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a type name..."
          className="flex-1 min-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="flex-1 min-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
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
      {types.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">No types yet. Add your first one above!</p>
      ) : (
        <div className="space-y-2">
          {types.map((type) => (
            <div key={type.id} data-testid="type-row" className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
              {editingId === type.id ? (
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 min-w-[10rem] rounded border border-zinc-600 bg-zinc-700 px-3 py-1 text-sm text-white focus:border-zinc-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="flex-1 min-w-[10rem] rounded border border-zinc-600 bg-zinc-700 px-3 py-1 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
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
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-cyan-300">{type.name}</span>
                    {type.description && (
                      <p className="mt-0.5 truncate text-xs text-zinc-500">{type.description}</p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <button
                      onClick={() => startEdit(type)}
                      className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(type.id)}
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
