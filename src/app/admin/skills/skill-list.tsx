'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type SkillCard = { card_id: string; cards: { name: string; rarity: string } | null }
type Skill = {
  id: string
  name: string
  description: string
  card_skills: SkillCard[]
}

type CardOption = { id: string; name: string; rarity: string }

const rarityTextColor: Record<string, string> = {
  common: 'text-zinc-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  ultra_rare: 'text-purple-400',
  legendary: 'text-amber-400',
  secret_rare: 'text-pink-400',
}

const rarityOrder: Record<string, number> = {
  secret_rare: 0, legendary: 1, ultra_rare: 2, rare: 3, uncommon: 4, common: 5,
}

export default function SkillList({ skills, allCards }: { skills: Skill[]; allCards: CardOption[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editCardIds, setEditCardIds] = useState<Set<string>>(new Set())
  const [cardSearch, setCardSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const startEdit = (skill: Skill) => {
    setEditingId(skill.id)
    setEditName(skill.name)
    setEditDesc(skill.description)
    setEditCardIds(new Set(skill.card_skills.map((cs) => cs.card_id)))
    setCardSearch('')
  }

  const toggleCard = (cardId: string) => {
    setEditCardIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  const handleSave = async () => {
    if (!editName.trim() || !editingId) return
    setSaving(true)
    const supabase = createClient()

    // Update skill display info
    await supabase.from('skills').update({
      name: editName.trim(),
      description: editDesc.trim(),
    }).eq('id', editingId)

    // Get current assignments
    const skill = skills.find((s) => s.id === editingId)
    const currentIds = new Set(skill?.card_skills.map((cs) => cs.card_id) || [])
    const newIds = editCardIds

    // Remove unassigned
    const toRemove = [...currentIds].filter((id) => !newIds.has(id))
    if (toRemove.length > 0) {
      await supabase.from('card_skills').delete().eq('skill_id', editingId).in('card_id', toRemove)
    }

    // Add new assignments
    const toAdd = [...newIds].filter((id) => !currentIds.has(id))
    if (toAdd.length > 0) {
      await supabase.from('card_skills').insert(
        toAdd.map((card_id) => ({ card_id, skill_id: editingId }))
      )
    }

    setEditingId(null)
    setSaving(false)
    router.refresh()
  }

  const sortedCards = [...allCards].sort((a, b) => (rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99))
  const filteredCards = cardSearch
    ? sortedCards.filter((c) => c.name.toLowerCase().includes(cardSearch.toLowerCase()))
    : sortedCards

  return (
    <div>
      {skills.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">No skills defined yet.</p>
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => (
            <div key={skill.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              {editingId === skill.id ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Skill ID</label>
                    <span className="text-sm text-zinc-400 font-mono">{skill.id}</span>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Description</label>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none resize-none"
                    />
                  </div>

                  {/* Card assignments */}
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">
                      Assigned Cards ({editCardIds.size})
                    </label>
                    {/* Selected cards */}
                    {editCardIds.size > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {[...editCardIds].map((id) => {
                          const card = allCards.find((c) => c.id === id)
                          return (
                            <button
                              key={id}
                              onClick={() => toggleCard(id)}
                              className={`rounded-full border border-pink-800 bg-pink-950/30 px-2.5 py-1 text-xs font-medium ${rarityTextColor[card?.rarity || ''] || 'text-zinc-300'} hover:bg-pink-900/40`}
                            >
                              {card?.name || id.slice(0, 8)} ×
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {/* Card picker */}
                    <input
                      type="text"
                      value={cardSearch}
                      onChange={(e) => setCardSearch(e.target.value)}
                      placeholder="Search cards to assign..."
                      className="mb-2 w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                    />
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800">
                      {filteredCards.map((card) => {
                        const assigned = editCardIds.has(card.id)
                        return (
                          <button
                            key={card.id}
                            onClick={() => toggleCard(card.id)}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-700 ${assigned ? 'bg-pink-950/20' : ''}`}
                          >
                            <span className={`font-medium ${rarityTextColor[card.rarity] || 'text-zinc-300'}`}>
                              {card.name}
                            </span>
                            {assigned && <span className="text-xs text-pink-400">Assigned</span>}
                          </button>
                        )
                      })}
                      {filteredCards.length === 0 && (
                        <p className="px-3 py-2 text-xs text-zinc-500">No cards found</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving || !editName.trim()}
                      className="rounded-lg bg-white px-4 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-pink-400">✦ {skill.name}</span>
                        <span className="text-[10px] text-zinc-600 font-mono">{skill.id}</span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-400">{skill.description}</p>
                    </div>
                    <button
                      onClick={() => startEdit(skill)}
                      className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800 flex-shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                  {skill.card_skills.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-zinc-600">Assigned to:</span>
                      {skill.card_skills.map((cs) => (
                        <span key={cs.card_id} className={`text-[10px] font-medium ${rarityTextColor[cs.cards?.rarity || ''] || 'text-zinc-300'}`}>
                          {cs.cards?.name || cs.card_id}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-zinc-600">Not assigned to any cards</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
