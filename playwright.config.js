// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for ShiftOS / XDrive.
 * Boots the production build via `vite preview` and runs the suite against it.
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* One retry on CI to absorb transient network flakiness; none locally. */
  retries: process.env.CI ? 1 : 0,
  /* Serial on CI for deterministic ordering and lower resource use. */
  workers: process.env.CI ? 1 : undefined,
  /* Per-test ceiling — prevents a hung navigation from stalling the whole job. */
  timeout: 30 * 1000,
  expect: { timeout: 10 * 1000 },
  /* Hard cap on the entire run so CI can never hang for an hour again. */
  globalTimeout: 10 * 60 * 1000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    /* Bounded action/navigation timeouts so a dead route fails fast, not slow. */
    actionTimeout: 10 * 1000,
    navigationTimeout: 20 * 1000,
  },

  /* Chromium only — firefox/webkit triple the runtime and flake in CI for
     no added signal on a Chromium-first user base. Add back deliberately. */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Boot the built app before the suite. Workflow runs `npm run build` first,
     so `vite preview` serves dist/ on :3000. */
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
