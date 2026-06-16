import { defineConfig, devices } from '@playwright/test'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'on',
    // Opt-in video recording: run with `PWVIDEO=1 npx playwright test ...`
    // (off by default so normal/CI runs stay fast). Watch via `npx playwright show-report`.
    video: process.env.PWVIDEO ? 'on' : 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // PWSLOW=1 runs the arena at production pace (no ARENA_FAST) — for recording
    // watchable, real-speed videos. Default stays fast so CI/e2e finish quickly.
    command: `NEXT_DIST_DIR=.next-e2e ${process.env.PWSLOW ? '' : 'NEXT_PUBLIC_ARENA_FAST=1 '}NEXT_PUBLIC_SUPABASE_URL=${LOCAL_SUPABASE_URL} NEXT_PUBLIC_SUPABASE_ANON_KEY=${LOCAL_ANON_KEY} npx next dev --port 3001`,
    port: 3001,
    reuseExistingServer: true,
    timeout: 60000,
  },
})
