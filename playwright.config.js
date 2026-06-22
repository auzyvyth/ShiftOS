// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests for the ShiftOS / XDrive SPA. Runs against a local `vite preview`
 * of the production build (see webServer below). Keep it to fast, resilient
 * checks — full data-driven flows need real Supabase creds we don't ship to CI.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /* Serve the built SPA before running tests. The build must already exist
     (CI builds first); locally an already-running preview is reused. */
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
