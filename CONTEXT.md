# CONTEXT.md — SFL Card Game

## Overview

A collectible card game web app where players buy card packs with in-game currency (Gruten), build decks, and battle in an 8-player auto-battler arena. Invite-only — admins create accounts. Deployed at `sfl-card-game.vercel.app`, backed by Supabase project `llozvdmgxvjjhvsjttho`.

## Tech Stack

| Layer | Version | Notes |
|-------|---------|-------|
| Next.js | 16.2.9 | App Router. Uses `src/proxy.ts` — **not** `middleware.ts`. |
| React | 19.2.4 | `reactStrictMode: false` in `next.config.ts`. |
| Supabase | JS 2.108.1, SSR 0.12.0 | Postgres 17, Auth, Storage, Realtime. |
| Tailwind CSS | 4 | Via `@tailwindcss/postcss`. |
| Playwright | 1.60.0 | E2E tests, runs dev server on port 3001. |
| Vitest | 3.2.6 | Unit/integration tests. |
| Hosting | Vercel | Limited deployments — deploy sparingly. |

## Architecture

### Security Model

**All state mutations go through Supabase RPC functions** (`SECURITY DEFINER`). No client-side writes to tables. RLS is enabled on all user-facing tables.

The `is_admin()` helper avoids RLS recursion by using `LANGUAGE sql` (not plpgsql) with `SECURITY DEFINER` to check `profiles.role = 'admin'` without triggering the profiles RLS policy. Defined in `supabase/migrations/00000000000000_baseline.sql`.

### Auth Flow

Invite-only. Admins create accounts via `admin_create_user` RPC. Auth is email+password through Supabase GoTrue. `src/proxy.ts` redirects unauthenticated requests to `/login` (excludes `/login`, `/auth` paths).

### Data Flow

- **Client** → Supabase JS client → **RPC function** (security definer) → **Postgres**
- Server components use `src/lib/supabase/server.ts`; client components use `src/lib/supabase/client.ts`
- Arena multiplayer uses Supabase Realtime for presence + broadcast

## RPC Functions

| Function | Purpose | Caller |
|----------|---------|--------|
| `buy_pack(pack_id, quantity)` | Atomic pack purchase: deducts gruten, rolls cards, inserts user_cards, logs transaction | Player |
| `claim_daily_gruten()` | 500G daily reward, EST timezone, once per day | Player |
| `setup_profile(name, avatar)` | First-time profile creation | Player |
| `update_profile(name, avatar, top_cards)` | Edit profile display | Player |
| `save_deck(slot, name, card_ids)` | Save a 5-card deck to a slot | Player |
| `get_players()` | Public profiles (non-hidden, non-admin) with top cards | Any authenticated |
| `admin_create_user(email, password, name)` | Create invite-only account | Admin |
| `admin_set_gruten(user_id, gruten)` | Set absolute gruten balance, logs transaction with diff | Admin |
| `admin_reset_password(user_id, password)` | Reset user password | Admin |
| `admin_toggle_hidden(user_id)` | Hide/show user from friends page | Admin |
| `rpc_create_arena_session(...)` | Create game session, clean up stale sessions | Any authenticated |
| `rpc_update_arena_session(...)` | Update HP, matchups, connected players, status | Any authenticated |
| `rpc_insert_arena_round(...)` | Store round result; `ON CONFLICT DO NOTHING` — first writer wins | Any authenticated |
| `rpc_delete_arena_session(lobby_id)` | Clean up session and related data | Any authenticated |
| `rpc_close_stale_lobby(lobby_id)` | Close lobby if host disconnected | Any authenticated |
| `rpc_admin_enable_arena()` / `rpc_admin_disable_arena()` | Toggle arena feature flag | Admin |
| `submit_card_suggestion(...)` | Submit a card idea | Player |
| `admin_review_suggestion(...)` / `admin_delete_suggestion(...)` | Manage suggestions | Admin |
| `is_admin()` | Non-recursive admin check used in RLS policies | Internal (SQL) |

## Data Model

### Key Tables (18 total)

- **`profiles`** — id (= auth.users.id), full_name, role, gruten, last_daily_claim, top_cards, hidden
- **`cards`** — id, name, rarity, image_url, description, creature_id
- **`creatures`** — id, name (cards belong to creatures)
- **`skills`** — id, name, description, is_active (admin-togglable)
- **`card_skills`** — card_id, skill_id (junction)
- **`user_cards`** — user_id, card_id, **count** (single row per card, count increments — not one row per copy)
- **`decks`** — user_id, slot, name, card_ids (uuid array, 5 cards)
- **`packs`** — name, price, cards_per_pack, is_active
- **`pack_cards`** — pack_id, card_id, pull_percentage (per-card weight, not per-rarity)
- **`gruten_transactions`** — user_id, type, amount (signed), balance_after, metadata (jsonb)
- **`arena_sessions`** — id, seed, players (jsonb), hp (jsonb), matchups, status
- **`arena_rounds`** — session_id, round_num, result (jsonb), skills_used; unique on (session_id, round_num)
- **`arena_ready`** — session_id, user_id, round_num, skills, is_ready
- **`app_settings`** — key/value store (e.g., `arena_enabled`)

### Rarity Order (lowest → highest)

`common` → `uncommon` → `rare` → `ultra_rare` → `legendary` → `secret_rare`

Defined in `src/lib/rarities.ts`. Pack pull weights are per-card in `pack_cards.pull_percentage`, not global rarity tiers.

### Gruten (Currency)

- Packs cost 100G each
- Daily claim: 500G (EST timezone)
- `gruten = -1` means unlimited (admin/test accounts)
- All changes logged to `gruten_transactions` (types: `pack_purchase`, `admin_grant`, `daily_claim`, `arena_reward`, `card_scrap`)

## Directory Map

| Path | Purpose |
|------|---------|
| `src/proxy.ts` | Auth proxy (Next.js 16 replacement for middleware.ts) |
| `src/app/dashboard/` | Main hub after login |
| `src/app/shop/` | Pack purchase UI |
| `src/app/collection/` | Card collection viewer with sorting/filtering |
| `src/app/decks/` | Deck builder (5-card decks) |
| `src/app/arena/` | Arena lobby, battle UI, test page |
| `src/app/arena/actions.ts` | Server actions: session management, round computation |
| `src/app/arena/lobby/[id]/` | Lobby room with Realtime presence |
| `src/app/players/` | Friends page (public profiles) |
| `src/app/profile/` | Profile editor with top cards |
| `src/app/suggest/` | Card suggestion form |
| `src/app/admin/` | Admin pages: cards, creatures, packs, skills, users, suggestions, arena, settings |
| `src/lib/battle-engine.ts` | Core battle logic: `precomputeRound()`, `randomPair()`, `applyHooks()` |
| `src/lib/skills/` | 13 skill implementations, each exports hooks (onStars, onDice, onDiceOverride, onTotals, onDamage, onRound) |
| `src/lib/skills/types.ts` | `Skill`, `SkillHooks`, `FaceOffState`, `RoundContext`, `ActiveSkill` types |
| `src/lib/seeded-random.ts` | Deterministic RNG from seed (used for reproducible arena rounds) |
| `src/lib/supabase/server.ts` | Server-side Supabase client factory |
| `src/lib/supabase/client.ts` | Client-side Supabase client factory |
| `supabase/migrations/` | 8 migration files (baseline through gruten_transactions) |
| `supabase/seed.sql` | Test data: 5 creatures, 10 cards, 1 pack, arena settings |

## Development

```bash
# Local Supabase (must be running)
npx supabase start          # Starts local Postgres, Auth, etc.
npx supabase db reset        # Apply all migrations + seed data

# Dev server
npx next dev                 # Default port 3000

# Unit tests (202 tests)
npx vitest run

# E2E tests (181 tests, starts own dev server on port 3001)
npx playwright test

# Apply migrations to production
npx supabase db dump -f supabase/backup_YYYYMMDD_schema.sql
npx supabase db dump --data-only -f supabase/backup_YYYYMMDD_data.sql
npx supabase db push
```

E2E global setup (`e2e/global-setup.ts`) creates test users via GoTrue admin API — users don't persist across `db reset`.

## Gotchas & Invariants

- **`proxy.ts`, not `middleware.ts`**: Next.js 16 renamed the auth middleware entry point.
- **`ON CONFLICT DO NOTHING` in `rpc_insert_arena_round`**: Multiple clients may compute the same round concurrently. First write wins; callers must re-read from `arena_rounds` to get the authoritative result (`src/app/arena/actions.ts:305`).
- **`user_cards.count`**: A single row per (user, card) pair with a count column. Don't insert duplicate rows — use `ON CONFLICT DO UPDATE SET count = count + 1`.
- **`gruten = -1`**: Means unlimited balance. All gruten checks must handle this (`!= -1` guard before comparing).
- **Pack pull weights are per-card**: `pack_cards.pull_percentage` is set on each card individually, not as a global rarity tier. A common card might have 4.5% while another common has 5.0%.
- **Seeded RNG for arena**: Round results are deterministic from `session.seed * 1000 + roundNum`. This ensures all clients compute identical results.
- **Rate limit on pack purchases**: 2-second cooldown enforced in `buy_pack` via `profiles.last_pack_purchase`. Tests that buy multiple packs need a `setTimeout` between calls.
- **EST timezone for daily claims**: `claim_daily_gruten` uses `America/New_York`, not UTC.
- **Backup before push**: Always dump the live DB before `supabase db push`. Don't commit backup files.
- **Don't push backups to git**: `supabase/backup_*.sql` files should stay untracked.
