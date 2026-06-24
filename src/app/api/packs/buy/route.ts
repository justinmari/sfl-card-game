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

  // Attach each pulled card's type names + author credit so the reveal cards
  // match the collection. (buy_pack doesn't return types or author.)
  // buy_pack emits the identifier as `card_id`; normalize it to `id` so the
  // client (dedup/count/sort) and the enrichment lookups below both work.
  const result = data as { cards?: { id?: string; card_id?: string; typeNames?: string[]; author_name?: string | null; author_anonymous?: boolean | null }[] } | null
  if (result?.cards?.length) {
    for (const c of result.cards) c.id = c.id ?? c.card_id
    const ids = [...new Set(result.cards.map((c) => c.id).filter((x): x is string => !!x))]
    const { data: typeRows } = await supabase
      .from('card_types')
      .select('card_id, types(name)')
      .in('card_id', ids)
    const typeMap = new Map<string, string[]>()
    for (const row of (typeRows ?? []) as unknown as { card_id: string; types: { name: string } | null }[]) {
      if (!row.types?.name) continue
      typeMap.set(row.card_id, [...(typeMap.get(row.card_id) ?? []), row.types.name])
    }
    const { data: authorRows } = await supabase
      .from('cards')
      .select('id, author_name, author_anonymous')
      .in('id', ids)
    const authorMap = new Map((authorRows ?? []).map((r) => [r.id, r]))
    for (const c of result.cards) {
      c.typeNames = typeMap.get(c.id ?? '') ?? []
      const a = authorMap.get(c.id ?? '')
      c.author_name = a?.author_name ?? null
      c.author_anonymous = a?.author_anonymous ?? false
    }
  }

  return NextResponse.json(data)
}
