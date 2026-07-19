import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Celeste app.
 * Runs against the Vite preview server on :5173.
 *
 * IMPORTANT : on force `reuseExistingServer: true` même en CI pour permettre à un
 * workflow qui démarrerait `npm run preview` dans une étape séparée d'être réutilisé
 * (sinon Playwright relance une 2ème instance qui rentre en conflit de port).
 * Et on ne respecte plus SKIP_WEBSERVER (un ancien hack qui empêchait le serveur
 * de démarrer en CI, faisant échouer tous les tests avec ERR_CONNECTION_REFUSED).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    locale: 'fr-FR',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
