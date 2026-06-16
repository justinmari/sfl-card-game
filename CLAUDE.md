@AGENTS.md
@CONTEXT.md

## Development Workflow

When working on features or bug fixes, follow this workflow:

1. **Implement** — Write the code changes (feature, fix, migration, etc.)
2. **Apply migrations locally** — Run `npx supabase db reset` to apply any new SQL migrations to the local Supabase instance
3. **Unit tests** — Write/update unit tests (Vitest), run `npx vitest run` and ensure all pass
4. **E2E tests** — Write/update e2e tests (Playwright), run `npx playwright test` and ensure all pass (Playwright starts its own dev server)
5. **Full regression** — Run the complete test suite to verify nothing is broken
6. **Report** — Summarize what was done, what tests were added, and suggest the user test locally before deploying
7. **Wait for user approval** — Do not commit, push, or deploy unless the user explicitly asks
8. **Backup live DB** — Before pushing migrations, back up the live database (do NOT commit backups):
   ```bash
   npx supabase db dump -f supabase/backup_YYYYMMDD_schema.sql
   npx supabase db dump --data-only -f supabase/backup_YYYYMMDD_data.sql
   ```
9. **Sync live DB** — Push migrations to the live database with `npx supabase db push`, ensuring no data loss
10. **Commit and push** — Only when the user says to push; stage specific files (never `git add -A`)

### Key rules
- Never push to remote unless explicitly asked
- Always back up the live database before pushing migrations
- Migrations must be idempotent when possible (use `IF NOT EXISTS`, `CREATE OR REPLACE`)
- Test both unit and e2e before reporting a feature as complete
- Never add `Co-Authored-By` lines to commit messages

## Local Servers / Ports

Three dev servers have dedicated ports so they never collide. Keep them separate.

| Port | Purpose | Database | Notes |
|------|---------|----------|-------|
| **3000** | Regular dev server (`npx next dev`) | **Live** (via `.env.local`) | The normal local build the user runs. Leave it alone; don't override its env. |
| **3001** | E2E tests (Playwright `webServer`) | Local Supabase | Started automatically by `npx playwright test`. Uses `NEXT_DIST_DIR=.next-e2e`. Don't run a manual server here. |
| **3002** | Playwright MCP preview | Local Supabase | Spun up on demand for visual previews driven by the Playwright MCP. |

### Playwright MCP preview (port 3002)

When asked to use the Playwright MCP to look at the running app:

- **Browser**: use **Firefox** (the MCP server is configured with `--browser firefox`).
- **Server**: run the preview server on **port 3002** against **local** Supabase (override the env vars) so clicking around doesn't mutate production. Test accounts: `player@test.com` / `admin@test.com`, password `password123`.
  Set `NEXT_DIST_DIR=.next-preview` so it doesn't fight the port-3000 server over the shared `.next` build dir (`.next-preview/` is gitignored):
  ```bash
  NEXT_DIST_DIR=.next-preview \
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key from `npx supabase status`> \
  npx next dev -p 3002
  ```
- Navigate Playwright MCP to `http://localhost:3002`.
