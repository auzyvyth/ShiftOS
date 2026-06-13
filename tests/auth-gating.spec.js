// @ts-check
import { test, expect } from '@playwright/test';

/**
 * SECURITY — protected-route auth gating.
 *
 * ShiftOS holds customer PII (IC numbers, phone, addresses, loan data) and
 * per-dealer revenue. Every role-scoped route checks the Supabase session on
 * mount and redirects unauthenticated visitors away before rendering any
 * tenant data. These tests assert that gate holds for an anonymous browser
 * (no stored session) so a regression that exposes a dashboard to the public
 * fails CI loudly.
 *
 * Routes are split by where they bounce an anonymous visitor:
 *  - LOGIN_GATED: redirect to /login (role dashboards holding PII)
 *  - /platform (superadmin console): redirects to / (home)
 *
 * Not covered: /accounts is currently an empty "Coming Soon" stub with no data
 * fetch or PII, so it has no gate by design. Add it here if it ever renders
 * real account data.
 */

const LOGIN_GATED = [
  '/dashboard',
  '/dashboard/leads',
  '/dashboard/import-stock',
  '/salesman',
  '/salesman-lite',
  '/salesman-premium',
  '/manager',
  '/accountant',
  '/fi',
  '/admin',
];

test.describe('PII dashboards redirect anonymous visitors to /login', () => {
  for (const route of LOGIN_GATED) {
    test(`${route} is not reachable without a session`, async ({ page }) => {
      await page.goto(route);

      // Client-side session check resolves null then navigates to /login.
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

      // And the login form is actually rendered (not a blank/partial dashboard).
      await expect(page.getByText('SIGN IN', { exact: false })).toBeVisible();
    });
  }
});

test('superadmin /platform console bounces anonymous visitor to home', async ({ page }) => {
  await page.goto('/platform');
  // AdminPage redirects no-user / non-superadmin to '/', not /login.
  await expect(page).toHaveURL('/', { timeout: 15000 });
  // Must not linger on the platform console.
  await expect(page).not.toHaveURL(/platform/);
});

test('anonymous visitor never sees dashboard PII chrome before redirect', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

  // Sanity: sensitive dashboard-only markers must not be present on the page
  // we landed on. Keep this list aligned with unmistakably authed UI.
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/Revenue Analytics|Commission Breakdown|Post[- ]?Sale/i);
});
