import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'

export default async function ChangelogPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: logs } = await supabase
    .from('changelogs')
    .select('id, version, title, content, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Changelog" />

      <main className="mx-auto max-w-2xl px-6 py-10">
        <h2 className="font-display mb-6 text-2xl font-bold tracking-tight">Changelog</h2>

        {(!logs || logs.length === 0) ? (
          <p className="py-10 text-center text-sm text-zinc-500">No updates yet.</p>
        ) : (
          <div className="space-y-6">
            {logs.map((log, i) => (
              <div key={log.id} className="surface rounded-2xl p-5">
                <div className="mb-2 flex items-center gap-2">
                  {i === 0 && <span className="rounded bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-[0_0_10px_-2px_rgba(245,158,11,0.6)]">LATEST</span>}
                  {log.version && <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">v{log.version}</span>}
                  <h3 className="text-sm font-bold text-white">{log.title}</h3>
                </div>
                <p className="text-sm text-zinc-400 whitespace-pre-wrap">{log.content}</p>
                <p className="mt-3 text-[10px] text-zinc-600">
                  {new Date(log.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
