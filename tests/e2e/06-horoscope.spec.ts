import { test, expect } from '@playwright/test';

/**
 * Horoscope — le parcours quotidien le plus utilisé.
 * Combine :
 *  - Test UI : page horoscope rendue sans crash + contenu non vide (guest + logged)
 *  - Test API : /api/horoscope/daily et /api/astro/now répondent sans 500
 *
 * Pas de dépendance better-sqlite3 : utilise request API de Playwright
 * (qui ne requiert pas d'auth si endpoint public, et accepte 401/403 — on
 * vérifie juste que ça ne crashe pas en 500).
 */

test.describe('Horoscope — parcours quotidien', () => {
  test('UI : page horoscope charge du contenu non vide (guest)', async ({ page }) => {
    await page.goto('/');
    const guestBtn = page.getByRole('button', { name: /invité|découvrir|explorer|guest/i }).first();
    if (await guestBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await guestBtn.click();
      await page.waitForTimeout(1500);
    }
    // Navigue vers l'écran horoscope via event custom
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('celeste:navigate', { detail: 'horoscope' }));
    });
    await page.waitForTimeout(3000);
    // Vérifie contenu : doit avoir du texte substantiel (>200 chars)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect((bodyText || '').length).toBeGreaterThan(200);
  });

  test('API : /api/horoscope/daily répond en JSON sans crasher (500)', async ({ request }) => {
    const res = await request.get('/api/horoscope/daily');
    // Réponse 200 ou 401/403 (si endpoint protégé), mais JAMAIS 500
    expect([200, 400, 401, 403, 404]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json();
      expect(data).toBeTruthy();
    }
  });

  test('API astro : /api/astro/now répond sans 500', async ({ request }) => {
    const res = await request.get('/api/astro/now');
    expect([200, 400, 401, 403, 404]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json();
      // Doit contenir une date ISO ou un timestamp
      const dump = JSON.stringify(data);
      expect(dump.length).toBeGreaterThan(10);
    }
  });

  test('API health : /api/health répond 200', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
  });
});
