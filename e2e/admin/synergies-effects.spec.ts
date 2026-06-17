import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN, TEST_PLAYER } from '../helpers'

test.describe('Admin Battle Effects', () => {
  test('admin sees the seeded battle effects', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/battle-effects')
    await expect(page.getByTestId('battle-effects-admin')).toBeVisible({ timeout: 10000 })
    // 14 built-in effects are seeded.
    expect(await page.getByTestId('effect-row').count()).toBeGreaterThanOrEqual(10)
  })

  test('admin can create and delete a battle effect', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/battle-effects')
    await expect(page.getByTestId('battle-effects-admin')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: '+ New Effect' }).click()
    await page.getByPlaceholder('my-effect').fill('e2e-test-fx')
    await page.getByPlaceholder('My Effect').fill('E2E Test FX')
    await page.getByLabel('Operation').selectOption('multiply_total')
    await page.getByRole('button', { name: 'Save' }).click()

    const row = page.getByTestId('effect-row').filter({ hasText: 'E2E Test FX' })
    await expect(row).toBeVisible({ timeout: 10000 })

    // Clean up so re-runs don't hit the unique-key constraint.
    page.on('dialog', (d) => d.accept())
    await row.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByTestId('effect-row').filter({ hasText: 'E2E Test FX' })).toHaveCount(0, { timeout: 10000 })
  })

  test('non-admin cannot access battle effects', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/admin/battle-effects')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toContain('/admin/battle-effects')
  })
})

test.describe('Admin Synergies', () => {
  test('admin can create and delete a synergy', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/synergies')
    await expect(page.getByTestId('synergies-admin')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: '+ New Synergy' }).click()
    await page.getByPlaceholder('Egg Roll').fill('E2E Synergy')
    // Add a requirement (a seeded type) and an effect.
    await page.getByRole('button', { name: '+ requirement' }).click()
    await page.getByRole('button', { name: '+ effect' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    const row = page.getByTestId('synergy-row').filter({ hasText: 'E2E Synergy' })
    await expect(row).toBeVisible({ timeout: 10000 })

    page.on('dialog', (d) => d.accept())
    await row.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByTestId('synergy-row').filter({ hasText: 'E2E Synergy' })).toHaveCount(0, { timeout: 10000 })
  })

  test('non-admin cannot access synergies', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/admin/synergies')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toContain('/admin/synergies')
  })
})

const LOCAL = 'http://127.0.0.1:54321'
const SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const svcHeaders = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' }

test.describe('Skill ↔ Battle Effect composition', () => {
  test('admin can assign a battle effect to a skill and it persists', async ({ page }) => {
    // Ensure a known skill with no composition exists.
    await fetch(`${LOCAL}/rest/v1/skills`, {
      method: 'POST',
      headers: { ...svcHeaders, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: 'e2e-skill', name: 'E2E Composable Skill', description: 'test' }),
    })
    await fetch(`${LOCAL}/rest/v1/skill_effects?skill_id=eq.e2e-skill`, { method: 'DELETE', headers: svcHeaders })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/skills')
    await expect(page.getByText('Manage Skills')).toBeVisible({ timeout: 10000 })

    const card = page.locator('div.rounded-xl.border').filter({ hasText: 'E2E Composable Skill' }).first()
    await card.getByRole('button', { name: 'Edit' }).click()
    const editor = page.getByTestId('skill-effects-editor')
    await expect(editor).toBeVisible({ timeout: 10000 })
    await editor.getByRole('combobox').selectOption({ index: 1 }) // first real effect (index 0 = placeholder)
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1500)

    const rows = await (await fetch(`${LOCAL}/rest/v1/skill_effects?skill_id=eq.e2e-skill&select=battle_effect_id`, { headers: svcHeaders })).json()
    expect(rows.length).toBeGreaterThanOrEqual(1)

    await fetch(`${LOCAL}/rest/v1/skills?id=eq.e2e-skill`, { method: 'DELETE', headers: svcHeaders })
  })
})

test.describe('Admin Battle Effects — editing', () => {
  const KEYS = ['e2e-edit-fx', 'e2e-edit-ls', 'e2e-bad-op']
  const cleanup = async () => {
    for (const key of KEYS) {
      await fetch(`${LOCAL}/rest/v1/battle_effects?key=eq.${key}`, { method: 'DELETE', headers: svcHeaders })
    }
  }
  const seedEffect = (row: object) =>
    fetch(`${LOCAL}/rest/v1/battle_effects`, { method: 'POST', headers: { ...svcHeaders, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(row) })

  test.beforeEach(cleanup)
  test.afterEach(cleanup)

  test('edits a numeric param and persists it', async ({ page }) => {
    await seedEffect({ key: 'e2e-edit-fx', name: 'E2E Edit FX', op: 'multiply_total', params: { factor: 2 }, kind: ['total'] })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/battle-effects')
    const row = page.getByTestId('effect-row').filter({ hasText: 'E2E Edit FX' })
    await expect(row).toBeVisible({ timeout: 10000 })

    await row.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('Factor').fill('4')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1200)

    const rows = await (await fetch(`${LOCAL}/rest/v1/battle_effects?key=eq.e2e-edit-fx&select=params`, { headers: svcHeaders })).json()
    expect(rows[0].params.factor).toBe(4)
  })

  test('edits a multi-param effect (lifesteal mode/amount/chance)', async ({ page }) => {
    await seedEffect({ key: 'e2e-edit-ls', name: 'E2E Edit LS', op: 'lifesteal', params: { mode: 'flat', amount: 1, chance: 100 }, kind: ['heal'] })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/battle-effects')
    const row = page.getByTestId('effect-row').filter({ hasText: 'E2E Edit LS' })
    await expect(row).toBeVisible({ timeout: 10000 })

    await row.getByRole('button', { name: 'Edit' }).click()
    // All three params render and are editable (string mode + two numbers).
    await page.getByLabel(/Mode/).fill('percent')
    await page.getByLabel(/Flat heal/).fill('50')
    await page.getByLabel(/Heal chance/).fill('25')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1200)

    const rows = await (await fetch(`${LOCAL}/rest/v1/battle_effects?key=eq.e2e-edit-ls&select=params`, { headers: svcHeaders })).json()
    expect(rows[0].params).toMatchObject({ mode: 'percent', amount: 50, chance: 25 })
  })

  test('an unrecognized op shows a warning instead of white-screening', async ({ page }) => {
    // Mimics the DB-migrated-ahead-of-deploy state that broke editing lifesteal.
    await seedEffect({ key: 'e2e-bad-op', name: 'E2E Bad Op', op: 'does_not_exist_op', params: {}, kind: ['power'] })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/battle-effects')
    const row = page.getByTestId('effect-row').filter({ hasText: 'E2E Bad Op' })
    await expect(row).toBeVisible({ timeout: 10000 })

    await row.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByTestId('unknown-op-warning')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
    // The page is still alive (no error boundary / white screen).
    await expect(page.getByTestId('battle-effects-admin')).toBeVisible()
  })
})

test.describe('Synergy Codex', () => {
  test('player can open the codex (locked entries by default)', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/codex')
    await expect(page.getByText('Synergy Codex')).toBeVisible({ timeout: 10000 })
  })
})
