import { test, expect } from '@playwright/test'
import { login, TEST_PLAYER } from './helpers'
import path from 'path'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

const ORIGINAL_BYTES = 1001718 // e2e/fixtures/sample.gif (rotating earth, 400x400, ~1MB)
const TARGET_BYTES = 100 * 1024

// Verifies the gifsicle-wasm client-side pipeline: a ~1MB animated GIF is
// compressed in the browser to under 100KB before it's uploaded to storage,
// while staying an animated GIF.
test('uploaded GIF is compressed client-side to under 100KB before storage', async ({ page }) => {
  test.setTimeout(180000) // gifsicle runs several optimization passes in-browser
  await fetch(`${LOCAL_URL}/rest/v1/card_suggestions?id=neq.00000000-0000-0000-0000-000000000000`, { method: 'DELETE', headers })

  await login(page, TEST_PLAYER)
  await page.goto('/suggest')
  await expect(page.getByPlaceholder('Card name')).toBeVisible({ timeout: 10000 })
  await page.getByPlaceholder('Card name').fill('Gif Compress Test')
  await page.locator('input[type=file]').setInputFiles(path.join(__dirname, 'fixtures/sample.gif'))

  await page.click('button:has-text("Review & Submit")')
  await expect(page.getByText('Review Your Suggestion')).toBeVisible({ timeout: 10000 })
  await page.click('button:has-text("Confirm")')
  await expect(page.getByText('Suggestion Submitted!')).toBeVisible({ timeout: 150000 })

  const res = await fetch(`${LOCAL_URL}/rest/v1/card_suggestions?select=image_url&order=created_at.desc&limit=1`, { headers })
  const url = (await res.json())[0]?.image_url as string | undefined
  expect(url, 'suggestion has an image_url').toBeTruthy()
  expect(url).toMatch(/\.gif(\?|$)/) // stays a gif (animation preserved)

  const stored = (await (await fetch(url!)).arrayBuffer()).byteLength
  expect(stored, 'compression ran').toBeLessThan(ORIGINAL_BYTES)
  expect(stored, 'under 100KB target').toBeLessThan(TARGET_BYTES)
})
