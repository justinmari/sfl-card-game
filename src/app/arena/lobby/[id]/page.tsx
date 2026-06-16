import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import { isArenaAccessible } from '@/lib/arena-settings'
import AppNavbar from '@/components/app-navbar'
import LobbyRoom from './lobby-room'
import { getSessionHp } from '@/app/arena/actions'
import { loadSkillEffectRows } from '@/lib/battle-effects/skill-effects'

export default async function LobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lobbyId } = await params
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const arenaEnabled = await isArenaAccessible()
  if (!arenaEnabled) redirect('/arena')

  const supabase = await createClient()

  // Get lobby info
  const { data: lobby } = await supabase
    .from('arena_lobbies')
    .select('id, host_id, name, status, max_players')
    .eq('id', lobbyId)
    .single()

  if (!lobby) redirect('/arena')

  // Check if player is in this lobby
  const { data: myEntry } = await supabase
    .from('arena_lobby_players')
    .select('user_id')
    .eq('lobby_id', lobbyId)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (!myEntry) redirect('/arena')

  // Get player's decks
  const { data: decks } = await supabase
    .from('decks')
    .select('slot, name, card_ids')
    .eq('user_id', profile.id)
    .order('slot')

  const allCardIds = (decks || []).flatMap((d) => d.card_ids || [])
  const { data: cards } = allCardIds.length > 0
    ? await supabase
        .from('cards')
        .select('id, name, image_url, rarity, creatures(name), card_skills(skill_id)')
        .in('id', allCardIds)
    : { data: [] }

  const { data: dbSkills } = await supabase.from('skills').select('id, name, description')
  const skillEffectRows = await loadSkillEffectRows(supabase)

  type CardWithSkills = {
    id: string; name: string; image_url: string | null; rarity: string
    creature_name: string | null; dbSkillIds: string[]
  }

  const cardMap = new Map<string, CardWithSkills>()
  for (const c of cards || []) {
    const card = c as unknown as {
      id: string; name: string; image_url: string | null; rarity: string
      creatures: { name: string } | null; card_skills: { skill_id: string }[]
    }
    cardMap.set(card.id, {
      id: card.id, name: card.name, image_url: card.image_url, rarity: card.rarity,
      creature_name: card.creatures?.name || null,
      dbSkillIds: (card.card_skills || []).map((s) => s.skill_id),
    })
  }

  const legalDecks = (decks || [])
    .filter((d) => d.card_ids?.length === 5)
    .map((d) => ({
      slot: d.slot as number,
      name: d.name as string,
      cards: (d.card_ids as string[])
        .map((id) => cardMap.get(id))
        .filter((c): c is CardWithSkills => c !== undefined),
    }))

  // Check for active session
  let session = await supabase
    .from('arena_sessions')
    .select('id, seed, players, hp, status')
    .eq('arena_lobby_id', lobbyId)
    .eq('status', 'active')
    .maybeSingle()
    .then((r) => r.data)

  // If session exists, compute actual HP and check if game is over
  if (session) {
    const freshHp = await getSessionHp(session.id)
    if (freshHp) {
      const aliveCount = Object.values(freshHp).filter((h) => h > 0).length
      if (aliveCount <= 1) {
        // Game is over but status wasn't updated — clean it up
        await supabase.rpc('rpc_update_arena_session', { p_session_id: session.id, p_status: 'done' })
        await supabase.from('arena_lobbies').update({ status: 'waiting' }).eq('id', lobbyId)
        session = null
      }
    }
  }

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/arena" title={lobby.name} />
      <main className="mx-auto max-w-5xl px-6 py-10 pb-24">
        <LobbyRoom
          lobbyId={lobbyId}
          lobbyName={lobby.name}
          hostId={lobby.host_id}
          lobbyStatus={lobby.status}
          maxPlayers={lobby.max_players}
          userId={profile.id}
          userName={profile.full_name || 'Unknown'}
          avatarUrl={profile.avatar_url || profile.user_metadata?.avatar_url || null}
          legalDecks={legalDecks}
          dbSkills={(dbSkills || []) as { id: string; name: string; description: string }[]}
          skillEffectRows={skillEffectRows}
          activeSession={session ? {
            sessionId: session.id,
            seed: session.seed,
            players: session.players as any[],
            hp: session.hp as Record<string, number>,
          } : null}
        />
      </main>
    </div>
  )
}
