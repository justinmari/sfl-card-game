@AGENTS.md

## Development Workflow

When working on features or bug fixes, follow this workflow:

1. **Implement** — Write the code changes (feature, fix, migration, etc.)
2. **Apply migrations locally** — Run `npx supabase db reset` to apply any new SQL migrations to the local Supabase instance
3. **Unit tests** — Write/update unit tests (Vitest), run `npx vitest run` and ensure all pass
4. **E2E tests** — Write/update e2e tests (Playwright), run `npx playwright test` and ensure all pass (Playwright starts its own dev server)
5. **Full regression** — Run the complete test suite to verify nothing is broken
6. **Report** — Summarize what was done, what tests were added, and suggest the user test locally before deploying
7. **Wait for user approval** — Do not commit, push, or deploy unless the user explicitly asks
8. **Backup live DB** — Before pushing migrations, create a backup of the live Supabase database (schema + data) to `supabase/backup_*.sql` (do NOT commit backups)
9. **Sync live DB** — Push migrations to the live database with `npx supabase db push`, ensuring no data loss
10. **Commit and push** — Only when the user says to push; stage specific files (never `git add -A`)

### Key rules
- Never push to remote unless explicitly asked
- Always back up the live database before pushing migrations
- Migrations must be idempotent when possible (use `IF NOT EXISTS`, `CREATE OR REPLACE`)
- Test both unit and e2e before reporting a feature as complete
- Never add `Co-Authored-By` lines to commit messages
