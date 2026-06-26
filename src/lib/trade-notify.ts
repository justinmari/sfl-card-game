import { createClient } from '@/lib/supabase/client'

type NotifyPayload = { sessionId?: string; fromName: string }

/**
 * Fire a one-off Realtime broadcast to a player's personal trade channel
 * (`trade-invites-<id>`), which TradeInviteListener listens on app-wide. Used to
 * pop an instant "join" toast on invite and a "cancelled" toast on cancel.
 * Resolves once sent (or after a short timeout so it never hangs the caller).
 */
export async function notifyPlayer(
  userId: string,
  event: 'invite' | 'cancelled',
  payload: NotifyPayload,
): Promise<void> {
  const supabase = createClient()
  const channel = supabase.channel(`trade-invites-${userId}`)
  await new Promise<void>((resolve) => {
    let done = false
    const finish = () => { if (!done) { done = true; resolve() } }
    channel.subscribe((status) => { if (status === 'SUBSCRIBED') finish() })
    setTimeout(finish, 1500)
  })
  await channel.send({ type: 'broadcast', event, payload })
  supabase.removeChannel(channel)
}
