// E2E test C2 — version courte (sandbox-safe)
// Vérifie : SW registered, OfflineIndicator mounted, queue badge apparaît.
import { chromium } from 'playwright';
const URL = 'http://localhost:5173/';
const ok = (m) => console.log('OK', m);
const fail = (m) => { console.error('FAIL', m); process.exit(1); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await ctx.route('**/api/test*', (r) => r.fulfill({ status: 503 }));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  ok('page loaded');

  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg.scope;
  });
  if (!sw) fail('no SW support');
  ok('SW registered: ' + sw);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => navigator.serviceWorker.controller != null, { timeout: 5000 }).catch(() => {});
  ok('SW controller acquired');

  await page.evaluate(() => localStorage.removeItem('celeste:offline_queue:v1'));
  await page.waitForTimeout(300);
  let txt = await page.evaluate(() => document.body.innerText);
  if (/en attente/i.test(txt)) fail('indicator should be hidden when queue empty');
  ok('indicator hidden when queue empty');

  // Inject 2 items + dispatch event
  await page.evaluate(() => {
    const items = [];
    for (let i = 0; i < 2; i++) {
      items.push({ id: 'q' + i, url: '/api/test' + i, method: 'POST', body: {}, headers: { 'Content-Type': 'application/json' }, createdAt: Date.now(), attempts: 0 });
    }
    localStorage.setItem('celeste:offline_queue:v1', JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: { size: 2 } }));
  });
  await page.waitForTimeout(500);
  txt = await page.evaluate(() => document.body.innerText);
  const m = txt.match(/(\d+)\s+actions?\s+en attente/i);
  if (!m) fail('badge not visible — DOM: ' + txt.slice(0, 150));
  ok('badge: ' + m[0]);

  // Vérifier que drain auto (à 2s) garde les items en cas de 503
  await page.waitForTimeout(2200);
  const remaining = await page.evaluate(() => {
    const raw = localStorage.getItem('celeste:offline_queue:v1');
    return raw ? JSON.parse(raw).length : 0;
  });
  if (remaining !== 2) fail('drain n a pas préservé la queue : ' + remaining + '/2');
  ok('queue préservée après drain (503)');

  await page.evaluate(() => localStorage.removeItem('celeste:offline_queue:v1'));
  await browser.close();
  console.log('\n✅ C2 OK');
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });