'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function useArenaStatus() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('arena-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'key=eq.arena_enabled' },
        async (payload) => {
          const value = payload.new?.value
          if (value === false || value === 'false') {
            // Admins keep arena access while it's disabled for regular users.
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
              if (data?.role === 'admin') return
            }
            router.push('/dashboard?toast=arena-disabled')
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, router])
}
