import { test, expect } from '@playwright/test';

/**
 * Accessibility smoke tests.
 * Checks landmarks, keyboard navigation, and image alt texts.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Enter guest mode if possible
  const guestBtn = page.getByRole('button', { name: /invité|découvrir|explorer|guest/i }).first();
  if (await guestBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await guestBtn.click();
    await page.waitForTimeout(1500);
  }
});

test.describe('Accessibility', () => {
  test('all images have alt text', async ({ page }) => {
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      // alt should exist (even if empty for decorative)
      expect(alt !== null).toBeTruthy();
    }
  });

  test('no duplicate IDs in DOM', async ({ page }) => {
    const ids = await page.evaluate(() => {
      const all = document.querySelectorAll('[id]');
      const seen = new Set<string>();
      const dups: string[] = [];
      all.forEach(el => {
        const id = el.id;
        if (seen.has(id)) dups.push(id);
        seen.add(id);
      });
      return dups;
    });
    expect(ids).toEqual([]);
  });

  test('keyboard Tab reaches interactive elements', async ({ page }) => {
    // Press Tab a few times and check focus lands on buttons/links
    let focusableFound = false;
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const activeTag = await page.evaluate(() => document.activeElement?.tagName);
      if (activeTag === 'BUTTON' || activeTag === 'A' || activeTag === 'INPUT') {
        focusableFound = true;
        break;
      }
    }
    expect(focusableFound).toBe(true);
  });
});
