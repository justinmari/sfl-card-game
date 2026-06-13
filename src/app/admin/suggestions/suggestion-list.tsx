'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import TradingCard from '@/components/trading-card'
import { rarityLabel } from '@/lib/rarities'

type Suggestion = {
  id: string
  user_id: string
  user_name: string | null
  title: string
  description: string | null
  image_url: string | null
  rarity: string
  creature_id: string | null
  creature_name: string | null
  status: string
  admin_notes: string | null
  created_at: string
}

type Creature = { id: string; name: string }

export default function SuggestionList({
  pending,
  archived,
  creatures,
}: {
  pending: Suggestion[]
  archived: Suggestion[]
  creatures: Creature[]
}) {
  const [tab, setTab] = useState<'pending' | 'archived'>('pending')
  const [processing, setProcessing] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editRarity, setEditRarity] = useState('')
  const [editCreature, setEditCreature] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const router = useRouter()

  const items = tab === 'pending' ? pending : archived

  const startEdit = (s: Suggestion) => {
    setEditingId(s.id)
    setEditTitle(s.title)
    setEditDesc(s.description || '')
    setEditRarity(s.rarity)
    setEditCreature(s.creature_id)
  }

  const handleAction = async (id: string, status: 'added' | 'archived', addToCards?: boolean) => {
    setProcessing(id)
    try {
      const supabase = createClient()

      if (addToCards) {
        const suggestion = [...pending, ...archived].find((s) => s.id === id)
        if (suggestion) {
          const title = editingId === id ? editTitle : suggestion.title
          const desc = editingId === id ? editDesc : suggestion.description
          const rar = editingId === id ? editRarity : suggestion.rarity
          const cid = editingId === id ? editCreature : suggestion.creature_id

          const { error: insertError } = await supabase.from('cards').insert({
            name: title,
            description: desc,
            image_url: suggestion.image_url,
            rarity: rar,
            creature_id: cid,
          })
          if (insertError) throw insertError
        }
      }

      const { error: rpcError } = await supabase.rpc('admin_review_suggestion', {
        p_id: id,
        p_status: status,
      })
      if (rpcError) throw rpcError

      setEditingId(null)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setProcessing(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this archived suggestion permanently?')) return
    setProcessing(id)
    try {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_delete_suggestion', { p_id: id })
      if (error) throw error
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setProcessing(null)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm(`Delete all ${archived.length} archived suggestions permanently?`)) return
    setDeletingAll(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_delete_all_archived')
      if (error) throw error
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingAll(false)
    }
  }

  return (
    <>
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setTab('pending')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'pending' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
        >
          Pending ({pending.length})
        </button>
        <button
          onClick={() => setTab('archived')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'archived' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
        >
          Archived ({archived.length})
        </button>
      </div>

      {tab === 'archived' && archived.length > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleDeleteAll}
            disabled={deletingAll}
            className="rounded-lg border border-red-800 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-900/30 disabled:opacity-50"
          >
            {deletingAll ? 'Deleting...' : `Delete All (${archived.length})`}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">
          {tab === 'pending' ? 'No pending suggestions.' : 'No archived suggestions.'}
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((s) => {
            const isEditing = editingId === s.id
            const cardPreview = {
              id: s.id,
              name: isEditing ? editTitle : s.title,
              description: isEditing ? editDesc : s.description,
              image_url: s.image_url,
              rarity: isEditing ? editRarity : s.rarity,
              creature_name: isEditing
                ? creatures.find((c) => c.id === editCreature)?.name || null
                : s.creature_name,
            }

            return (
              <div key={s.id} className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex-shrink-0">
                  <TradingCard card={cardPreview} size="sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs text-zinc-500">by {s.user_name || 'Unknown'}</span>
                    <span className="text-xs text-zinc-600">{new Date(s.created_at).toLocaleDateString('en-US')}</span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
                      />
                      <textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        rows={2}
                        className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none resize-none"
                      />
                      <div className="flex gap-2">
                        <select
                          value={editRarity}
                          onChange={(e) => setEditRarity(e.target.value)}
                          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white"
                        >
                          {Object.entries(rarityLabel).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                        <select
                          value={editCreature || ''}
                          onChange={(e) => setEditCreature(e.target.value || null)}
                          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white"
                        >
                          <option value="">No creature</option>
                          {creatures.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium">{s.title}</p>
                      {s.description && <p className="text-xs text-zinc-400">{s.description}</p>}
                      <p className="mt-1 text-xs text-zinc-500">{rarityLabel[s.rarity] || s.rarity}</p>
                      {s.creature_name && <p className="text-xs text-zinc-500">{s.creature_name}</p>}
                    </>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {tab === 'pending' && (
                      <>
                        <button
                          onClick={() => handleAction(s.id, 'added', true)}
                          disabled={processing === s.id}
                          className="rounded border border-green-800 px-3 py-1 text-xs text-green-400 hover:bg-green-900/30 disabled:opacity-50"
                        >
                          {isEditing ? 'Save & Add' : 'Add to Game'}
                        </button>
                        {!isEditing ? (
                          <button
                            onClick={() => startEdit(s)}
                            className="rounded border border-blue-800 px-3 py-1 text-xs text-blue-400 hover:bg-blue-900/30"
                          >
                            Edit & Add
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
                          >
                            Cancel Edit
                          </button>
                        )}
                        <button
                          onClick={() => handleAction(s.id, 'archived')}
                          disabled={processing === s.id}
                          className="rounded border border-red-800 px-3 py-1 text-xs text-red-400 hover:bg-red-900/30 disabled:opacity-50"
                        >
                          Archive
                        </button>
                      </>
                    )}
                    {tab === 'archived' && (
                      <>
                        <button
                          onClick={() => handleAction(s.id, 'added', true)}
                          disabled={processing === s.id}
                          className="rounded border border-green-800 px-3 py-1 text-xs text-green-400 hover:bg-green-900/30 disabled:opacity-50"
                        >
                          Restore & Add
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={processing === s.id}
                          className="rounded border border-red-800 px-3 py-1 text-xs text-red-400 hover:bg-red-900/30 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
