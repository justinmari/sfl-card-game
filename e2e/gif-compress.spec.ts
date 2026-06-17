import { test, expect } from '@playwright/test'
import { login, TEST_PLAYER } from './helpers'
import path from 'path'
import sharp from 'sharp'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

const ORIGINAL_BYTES = 1001718 // e2e/fixtures/sample.gif (rotating earth, 400x400, ~1MB)
const TARGET_BYTES = 200 * 1024

// Verifies the sharp pipeline: a ~1MB animated GIF is converted server-side to
// an animated WebP, stored under ~200KB, with its animation preserved.
test('uploaded GIF is converted to an animated WebP under 200KB', async ({ page }) => {
  test.setTimeout(180000)
  await fetch(`${LOCAL_URL}/rest/v1/card_suggestions?id=neq.00000000-0000-0000-0000-000000000000`, { method: 'DELETE', headers })

  await login(page, TEST_PLAYER)
  await page.goto('/suggest')
  await expect(page.getByPlaceholder('Card name')).toBeVisible({ timeout: 10000 })
  await page.getByPlaceholder('Card name').fill('Gif To Webp Test')
  await page.locator('input[type=file]').setInputFiles(path.join(__dirname, 'fixtures/sample.gif'))

  await page.click('button:has-text("Review & Submit")')
  await expect(page.getByText('Review Your Suggestion')).toBeVisible({ timeout: 10000 })
  await page.click('button:has-text("Confirm")')
  await expect(page.getByText('Suggestion Submitted!')).toBeVisible({ timeout: 150000 })

  const res = await fetch(`${LOCAL_URL}/rest/v1/card_suggestions?select=image_url&order=created_at.desc&limit=1`, { headers })
  const url = (await res.json())[0]?.image_url as string | undefined
  expect(url, 'suggestion has an image_url').toBeTruthy()
  expect(url, 'stored as webp').toMatch(/\.webp(\?|$)/)

  const buf = Buffer.from(await (await fetch(url!)).arrayBuffer())
  expect(buf.length, 'under 200KB target').toBeLessThan(TARGET_BYTES)
  expect(buf.length, 'smaller than the source gif').toBeLessThan(ORIGINAL_BYTES)

  // Animation preserved: an animated WebP has more than one page/frame.
  const meta = await sharp(buf, { animated: true }).metadata()
  expect(meta.format).toBe('webp')
  expect(meta.pages ?? 1, 'animation preserved (multiple frames)').toBeGreaterThan(1)
})
