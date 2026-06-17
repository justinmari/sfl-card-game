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

  const { data, error } = await supabase.rpc('buy_pack', {
    p_pack_id: pack_id,
    p_quantity: quantity,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Attach each pulled card's type names so the reveal cards show Type tags,
  // matching the collection. (buy_pack doesn't return types.)
  const result = data as { cards?: { id: string; typeNames?: string[] }[] } | null
  if (result?.cards?.length) {
    const ids = [...new Set(result.cards.map((c) => c.id))]
    const { data: typeRows } = await supabase
      .from('card_types')
      .select('card_id, types(name)')
      .in('card_id', ids)
    const typeMap = new Map<string, string[]>()
    for (const row of (typeRows ?? []) as unknown as { card_id: string; types: { name: string } | null }[]) {
      if (!row.types?.name) continue
      typeMap.set(row.card_id, [...(typeMap.get(row.card_id) ?? []), row.types.name])
    }
    for (const c of result.cards) c.typeNames = typeMap.get(c.id) ?? []
  }

  return NextResponse.json(data)
}
