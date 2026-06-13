import { type Page } from '@playwright/test'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const LOCAL_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

export const TEST_ADMIN = { email: 'admin@test.com', password: 'password123' }
export const TEST_PLAYER = { email: 'player@test.com', password: 'password123' }

export async function login(page: Page, user: { email: string; password: string }) {
  await page.goto('/login')
  await page.fill('input[type="email"]', user.email)
  await page.fill('input[type="password"]', user.password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(dashboard|setup)/, { timeout: 10000 })
}

export async function resetArenaEnabled() {
  await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/app_settings?key=eq.arena_enabled`, {
    method: 'PATCH',
    headers: {
      'apikey': LOCAL_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${LOCAL_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ value: true }),
  })
}

export async function setArenaDisabled() {
  await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/app_settings?key=eq.arena_enabled`, {
    method: 'PATCH',
    headers: {
      'apikey': LOCAL_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${LOCAL_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ value: false }),
  })
}

export async function cleanupLobbies() {
  await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/arena_ready?id=not.is.null`, {
    method: 'DELETE',
    headers: {
      'apikey': LOCAL_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${LOCAL_SERVICE_ROLE_KEY}`,
    },
  })
  await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/arena_lobby_players?id=not.is.null`, {
    method: 'DELETE',
    headers: {
      'apikey': LOCAL_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${LOCAL_SERVICE_ROLE_KEY}`,
    },
  })
  await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/arena_lobbies?id=not.is.null`, {
    method: 'DELETE',
    headers: {
      'apikey': LOCAL_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${LOCAL_SERVICE_ROLE_KEY}`,
    },
  })
}
