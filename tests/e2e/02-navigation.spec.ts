import { test, expect } from '@playwright/test';

/**
 * Navigation — BottomNav, screen switching, accessibility landmarks.
 * Runs in guest mode (no server auth required).
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Try to enter guest mode
  const guestBtn = page.getByRole('button', { name: /invité|découvrir|explorer|guest/i }).first();
  if (await guestBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await guestBtn.click();
    await page.waitForTimeout(1500);
  }
});

test.describe('Navigation', () => {
  test('BottomNav has semantic nav element with aria-label', async ({ page }) => {
    const nav = page.locator('nav[aria-label]');
    await expect(nav).toBeVisible({ timeout: 10_000 });
  });

  test('BottomNav buttons have accessible names', async ({ page }) => {
    const navButtons = page.locator('nav[aria-label] button');
    const count = await navButtons.count();
    expect(count).toBeGreaterThan(0);
    // Each button should have an aria-label or text content
    for (let i = 0; i < count; i++) {
      const btn = navButtons.nth(i);
      const label = await btn.getAttribute('aria-label');
      const text = await btn.textContent();
      expect(label || text).toBeTruthy();
    }
  });

  test('at least one nav button has aria-current on load', async ({ page }) => {
    // On home, the active item should have aria-current="page"
    const nav = page.locator('nav[aria-label]');
    await expect(nav).toBeVisible();
    const currentButtons = await nav.locator('[aria-current="page"]').count();
    expect(currentButtons).toBeGreaterThanOrEqual(1);
  });

  test('nav buttons are keyboard accessible', async ({ page }) => {
    const nav = page.locator('nav[aria-label]');
    const buttons = nav.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    // Each button must be focusable
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      await btn.focus();
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).toBe('BUTTON');
    }
  });
});
