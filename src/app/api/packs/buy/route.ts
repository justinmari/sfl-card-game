import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { pack_id, quantity = 1 } = await request.json()
  if (!pack_id || quantity < 1 || quantity > 10) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Get pack with its cards
  const { data: pack, error: packError } = await supabase
    .from('packs')
    .select('*, pack_cards(*, cards(*, creatures(name)))')
    .eq('id', pack_id)
    .eq('is_active', true)
    .single()

  if (packError || !pack) {
    return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
  }

  const totalCost = pack.price * quantity

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('gruten')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Check if user can afford it (-1 = infinite)
  if (profile.gruten !== -1 && profile.gruten < totalCost) {
    return NextResponse.json({ error: 'Not enough Gruten' }, { status: 400 })
  }

  // Roll cards based on pull percentages
  const pulledCards = []
  const packCards = pack.pack_cards as { pull_percentage: number; cards: { id: string; name: string; rarity: string; image_url: string | null; description: string | null; creatures: { name: string } | null } }[]

  for (let q = 0; q < quantity; q++) {
    for (let i = 0; i < pack.cards_per_pack; i++) {
      const roll = Math.random() * 100
      let cumulative = 0

      for (const pc of packCards) {
        cumulative += pc.pull_percentage
        if (roll < cumulative) {
          pulledCards.push({
            id: pc.cards.id,
            name: pc.cards.name,
            rarity: pc.cards.rarity,
            image_url: pc.cards.image_url,
            description: pc.cards.description,
            creature_name: pc.cards.creatures?.name || null,
          })
          break
        }
      }
    }
  }

  // Save pulled cards to user_cards
  const userCards = pulledCards.map((card) => ({
    user_id: user.id,
    card_id: card.id,
  }))

  const { error: insertError } = await supabase.from('user_cards').insert(userCards)
  if (insertError) {
    return NextResponse.json({ error: 'Failed to save cards' }, { status: 500 })
  }

  // Deduct gruten (skip for infinite)
  if (profile.gruten !== -1) {
    await supabase
      .from('profiles')
      .update({ gruten: profile.gruten - totalCost })
      .eq('id', user.id)
  }

  return NextResponse.json({
    cards: pulledCards,
    gruten_remaining: profile.gruten === -1 ? -1 : profile.gruten - totalCost,
  })
}
