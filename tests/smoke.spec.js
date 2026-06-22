// @ts-check
import { test, expect } from '@playwright/test';

// Smoke tests for the real app. Titles are set via react-helmet / document.title
// effects, so these also guard the SEO title work from regressing. Data fetches
// may fail under placeholder Supabase creds — assert on the shell, not on data.

test('homepage renders with XDrive title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/XDrive/i, { timeout: 15_000 });
});

test('ShiftOS landing page renders with its own title', async ({ page }) => {
  await page.goto('/shiftos');
  await expect(page).toHaveTitle(/ShiftOS/i, { timeout: 15_000 });
});

test('Compare page renders with its own title', async ({ page }) => {
  await page.goto('/compare');
  await expect(page).toHaveTitle(/Compare/i, { timeout: 15_000 });
});
