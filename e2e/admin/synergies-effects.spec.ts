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

test.describe('Synergy Codex', () => {
  test('player can open the codex (locked entries by default)', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/codex')
    await expect(page.getByText('Synergy Codex')).toBeVisible({ timeout: 10000 })
  })
})
