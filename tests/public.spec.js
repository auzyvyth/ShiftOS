// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Public marketplace smoke tests — pages an anonymous visitor SHOULD reach.
 * These assert on static UI chrome (headers, form labels, headings) rather
 * than live Supabase data so they stay deterministic in CI.
 */

test('homepage loads with marketplace chrome', async ({ page }) => {
  await page.goto('/');
  // XDRIVE brand wordmark appears in header/footer across the public site.
  await expect(page.getByText('XDRIVE', { exact: false }).first()).toBeVisible();
});

test('showroom renders the search + filters UI', async ({ page }) => {
  await page.goto('/showroom');
  await expect(page.getByPlaceholder(/Search brand, model, variant/i)).toBeVisible();
  await expect(page.getByText('Filters', { exact: false }).first()).toBeVisible();
});

test('login page shows the sign-in form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('SIGN IN', { exact: false })).toBeVisible();
  await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
  await expect(page.getByPlaceholder('••••••••')).toBeVisible();
});

test('articles index renders (Bahasa Malaysia guides)', async ({ page }) => {
  await page.goto('/articles');
  await expect(page.getByRole('heading', { name: /Panduan Kereta Malaysia/i })).toBeVisible();
});

test('article detail renders with light theme content', async ({ page }) => {
  await page.goto('/articles/apa-itu-puspakom-b5-b7');
  await expect(page.getByText(/Apa Itu Puspakom B5 & B7/i).first()).toBeVisible();
});

test('unknown route shows the 404 page', async ({ page }) => {
  // Multi-segment path: a single segment would match the /:dealerSlug
  // catch-all (DealerSlugRedirect) instead of the NotFound `*` route.
  await page.goto('/no/such/page');
  await expect(page.getByText('Page not found', { exact: false })).toBeVisible();
});
