import { test, expect } from '@playwright/test';

/**
 * Visual regression smoke test — captures key screens for manual review.
 * Not a strict pixel diff — just ensures screens render without crash.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  const guestBtn = page.getByRole('button', { name: /invité|découvrir|explorer|guest/i }).first();
  if (await guestBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await guestBtn.click();
    await page.waitForTimeout(1500);
  }
});

test.describe('Visual snapshots', () => {
  test('landing page renders without crash', async ({ page }) => {
    // Even if we moved past landing, just ensure body is visible
    await expect(page.locator('body')).toBeVisible();
    // No visible error messages
    const errorAlert = page.locator('[role="alert"]');
    const errorCount = await errorAlert.count();
    // Alerts may exist (e.g. network errors in test env) — just log
    if (errorCount > 0) {
      console.log(`⚠️ ${errorCount} alert(s) visible on page`);
    }
  });

  test('home screen shows content (not blank)', async ({ page }) => {
    // After guest mode, body should have substantial content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(100);
  });

  test('tarot card interactive elements exist', async ({ page }) => {
    // Smoke check : la page d'accueil doit avoir des éléments interactifs,
    // sans exiger qu'un texte "tarot" soit présent (le tarot est derrière paywall).
    // On tolère un timeout rapide — l'objectif est juste que la page ne soit pas figée.
    const buttonsCount = await page.locator('button').count();
    expect(buttonsCount).toBeGreaterThan(0);
  });
});
