// Backfill: convert existing card-images objects (gif/jpg/jpeg/png) to WebP and
// rewrite every DB reference. DRY RUN by default — prints a plan and changes
// nothing. Set APPLY=1 to actually convert/rewrite/delete.
//
// Usage (dry run):
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-webp.mjs
// Usage (apply):
//   APPLY=1 SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-webp.mjs
//
// SUPABASE_URL is read from the env or from NEXT_PUBLIC_SUPABASE_URL in .env.local.
import sharp from 'sharp'
import { readFileSync } from 'fs'

const APPLY = process.env.APPLY === '1'
const BUCKET = 'card-images'
const STATIC_TARGET = 100 * 1024
const ANIM_TARGET = 200 * 1024

function readEnvLocal(key) {
  try {
    const line = readFileSync('.env.local', 'utf8').split('\n').find((l) => l.startsWith(key + '='))
    return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : undefined
  } catch { return undefined }
}

const URL_BASE = (process.env.SUPABASE_URL || readEnvLocal('NEXT_PUBLIC_SUPABASE_URL') || '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !KEY) {
  console.error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL in .env.local) and/or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const ONLY = process.env.ONLY // optional substring filter to target specific objects
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const encName = (name) => name.split('/').map(encodeURIComponent).join('/')
const publicUrl = (name) => `${URL_BASE}/storage/v1/object/public/${BUCKET}/${encName(name)}`
const objectUrl = (name) => `${URL_BASE}/storage/v1/object/${BUCKET}/${encName(name)}`

// --- list every object in the bucket (recurse into folders) ---
async function listAll(prefix = '') {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${URL_BASE}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    })
    const batch = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    for (const e of batch) {
      const full = prefix + e.name
      if (e.id === null || e.metadata == null) out.push(...(await listAll(full + '/')))
      else out.push({ name: full, size: e.metadata.size ?? 0, mime: e.metadata.mimetype ?? '' })
    }
    if (batch.length < 1000) break
  }
  return out
}

// --- collect DB rows that reference an image URL ---
async function fetchRefs() {
  const refs = new Map() // object name -> [{table,id,label,column}]
  const add = (url, row) => {
    if (!url) return
    const m = url.match(new RegExp(`/${BUCKET}/(.+)$`))
    if (!m) return
    const name = decodeURIComponent(m[1].split('?')[0])
    if (!refs.has(name)) refs.set(name, [])
    refs.get(name).push(row)
  }
  const tables = [
    { t: 'cards', col: 'image_url', sel: 'id,name,image_url', label: (r) => r.name },
    { t: 'packs', col: 'image_url', sel: 'id,name,image_url', label: (r) => r.name },
    { t: 'profiles', col: 'avatar_url', sel: 'id,full_name,avatar_url', label: (r) => r.full_name },
    { t: 'card_suggestions', col: 'image_url', sel: 'id,title,image_url', label: (r) => r.title },
  ]
  for (const { t, col, sel, label } of tables) {
    const res = await fetch(`${URL_BASE}/rest/v1/${t}?select=${sel}`, { headers: h })
    const rows = await res.json()
    if (Array.isArray(rows)) for (const r of rows) add(r[col], { table: t, id: r.id, label: label(r), column: col })
  }
  return refs
}

// --- conversion (APPLY only) ---
async function toWebp(buf, animated) {
  const target = animated ? ANIM_TARGET : STATIC_TARGET
  const enc = (q, w) => {
    let p = sharp(buf, { animated })
    if (!animated) p = p.resize({ width: 800, height: 1100, fit: 'inside', withoutEnlargement: true })
    else if (w) p = p.resize({ width: w })
    return p.webp({ quality: q, effort: 4 }).toBuffer()
  }
  let out = await enc(animated ? 80 : 80)
  for (const q of [65, 50, 40, 30]) { if (out.length <= target) break; out = await enc(q) }
  if (out.length > target && animated) {
    const width = (await sharp(buf, { animated: true }).metadata()).width ?? 0
    for (const s of [0.75, 0.6, 0.45, 0.35]) { if (out.length <= target || !width) break; out = await enc(45, Math.max(120, Math.round(width * s))) }
  }
  return out
}

async function main() {
  console.log(`\n=== WebP backfill ${APPLY ? '(APPLY — will modify live data)' : '(DRY RUN — no changes)'} ===`)
  console.log(`Project: ${URL_BASE}\n`)

  const objects = await listAll()
  const candidates = objects
    .filter((o) => /\.(gif|jpe?g|png)$/i.test(o.name))
    .filter((o) => !ONLY || o.name.includes(ONLY))
  const refs = await fetchRefs()

  let savedEst = 0, anim = 0, stat = 0, orphans = 0
  for (const o of candidates) {
    const animated = /\.gif$/i.test(o.name)
    animated ? anim++ : stat++
    const r = refs.get(o.name) || []
    if (r.length === 0) orphans++
    const refStr = r.length ? r.map((x) => `${x.table}:${x.label ?? x.id}`).join(', ') : 'ORPHAN (no DB reference)'
    console.log(`${animated ? '🎞 ' : '🖼 '} ${o.name}  ${(o.size / 1024).toFixed(0)}KB  → ${animated ? 'animated' : 'static'} .webp   [${refStr}]`)

    if (APPLY) {
      if (r.length === 0) { console.log('   · skipped (orphan — left untouched)'); continue }
      const buf = Buffer.from(await (await fetch(publicUrl(o.name))).arrayBuffer())
      const webp = await toWebp(buf, animated)
      const newName = o.name.replace(/\.(gif|jpe?g|png)$/i, '.webp')
      const up = await fetch(objectUrl(newName), {
        method: 'POST', headers: { ...h, 'Content-Type': 'image/webp', 'x-upsert': 'true' }, body: webp,
      })
      if (!up.ok) { console.log(`   ! upload failed: ${await up.text()}`); continue }
      const newUrl = publicUrl(newName)
      for (const x of r) {
        await fetch(`${URL_BASE}/rest/v1/${x.table}?id=eq.${x.id}`, {
          method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ [x.column]: newUrl }),
        })
      }
      if (newName !== o.name) {
        const del = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}`, {
          method: 'DELETE', headers: h, body: JSON.stringify({ prefixes: [o.name] }),
        })
        if (!del.ok) console.log(`   ! delete of original failed: ${await del.text()}`)
      }
      console.log(`   ✓ ${(buf.length / 1024).toFixed(0)}KB → ${(webp.length / 1024).toFixed(0)}KB, ${r.length} ref(s) updated`)
      savedEst += buf.length - webp.length
    }
  }

  console.log(`\n--- Summary ---`)
  console.log(`Objects in bucket: ${objects.length}`)
  console.log(`Convertible: ${candidates.length}  (animated/gif: ${anim}, static: ${stat})`)
  console.log(`Orphans (no DB reference): ${orphans}`)
  if (APPLY) console.log(`Bytes saved: ${(savedEst / 1024 / 1024).toFixed(1)} MB`)
  else console.log(`\nThis was a DRY RUN. Re-run with APPLY=1 to convert, rewrite references, and delete originals.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
