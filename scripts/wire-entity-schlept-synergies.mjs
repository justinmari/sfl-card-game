// One-off: create the Entity (Lifesteal) and Schlept (Drowsy) synergies in the
// live DB, referencing the lifesteal/drowsy battle_effects (must already exist).
// Idempotent: skips a synergy whose name already exists. Uses the secret key.
//   SUPABASE_SERVICE_ROLE_KEY=<sb_secret_…> node scripts/wire-entity-schlept-synergies.mjs

import { readFileSync } from 'node:fs'

const SUPABASE_URL = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^"|"$/g, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !KEY) { console.error('Missing URL or KEY'); process.exit(1) }

const ENTITY_TYPE = '1ef47105-0f49-4a7d-8e00-ba1bac81df0c'
const SCHLEPT_TYPE = '388a4147-a02c-46a0-ac6d-167c7feadff0'

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function rest(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function effectId(key) {
  const rows = await rest(`battle_effects?select=id&key=eq.${key}`)
  if (!rows?.length) throw new Error(`battle_effect "${key}" not found in prod — push migrations first`)
  return rows[0].id
}

async function ensureSynergy({ name, description, typeId, count, effectKey, scope, target }) {
  const existing = await rest(`synergies?select=id&name=eq.${encodeURIComponent(name)}`)
  if (existing?.length) { console.log(`• "${name}" already exists (${existing[0].id}) — skipping`); return }

  const beId = await effectId(effectKey)
  const [syn] = await rest('synergies', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name, description }),
  })
  await rest('synergy_requirements', {
    method: 'POST',
    body: JSON.stringify({ synergy_id: syn.id, type_id: typeId, count }),
  })
  await rest('synergy_effects', {
    method: 'POST',
    body: JSON.stringify({ synergy_id: syn.id, battle_effect_id: beId, scope, target, ordinal: 0 }),
  })
  console.log(`✓ created "${name}" (${syn.id}) → ${effectKey} [${scope}/${target}], requires ${count}× type`)
}

await ensureSynergy({
  name: 'Lifesteal',
  description: '3+ Entity cards: your Entity cards heal you 1 HP when they deal damage.',
  typeId: ENTITY_TYPE, count: 3,
  effectKey: 'lifesteal', scope: 'synergy_cards', target: 'allies',
})

await ensureSynergy({
  name: 'Drowsy',
  description: '3 Schlept cards: every non-Schlept card (both players) rolls a -1 to 0 penalty die.',
  typeId: SCHLEPT_TYPE, count: 3,
  effectKey: 'drowsy', scope: 'non_synergy_cards', target: 'everyone',
})

console.log('Done.')
