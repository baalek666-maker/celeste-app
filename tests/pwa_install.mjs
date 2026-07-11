// Test PWA installability criteria — Chrome's standards
// https://developer.chrome.com/docs/devtools/progressive-web-apps/
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost:5173';
const results = [];
const fail = (m) => { console.error('  ❌', m); results.push({ ok: false, msg: m }); };
const pass = (m) => { console.log('  ✅', m); results.push({ ok: true, msg: m }); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  console.log('\n[PWA] 1. Manifest validation');
  const manifestRes = await fetch(`${BASE}/manifest.json`);
  const manifest = await manifestRes.json();
  if (!manifest.name) fail('manifest.name manquant'); else pass(`name="${manifest.name}"`);
  if (!manifest.short_name) fail('manifest.short_name manquant'); else pass(`short_name="${manifest.short_name}"`);
  if (manifest.start_url !== '/') fail(`start_url="${manifest.start_url}" ≠ "/"`); else pass('start_url="/"');
  if (manifest.display !== 'standalone') fail(`display="${manifest.display}" ≠ "standalone"`); else pass('display=standalone');
  if (!manifest.theme_color) fail('theme_color manquant'); else pass(`theme_color=${manifest.theme_color}`);
  if (!manifest.icons || manifest.icons.length < 2) fail(`icons=${manifest.icons?.length} (<2)`); else pass(`${manifest.icons.length} icons`);
  const has192 = manifest.icons?.some(i => i.sizes === '192x192' && i.type === 'image/png');
  const has512 = manifest.icons?.some(i => i.sizes === '512x512' && i.type === 'image/png');
  const hasMaskable = manifest.icons?.some(i => i.purpose === 'maskable');
  if (!has192) fail('icon 192x192 PNG manquant'); else pass('icon 192x192 PNG ✓');
  if (!has512) fail('icon 512x512 PNG manquant'); else pass('icon 512x512 PNG ✓');
  if (!hasMaskable) fail('icon maskable manquant'); else pass('icon maskable ✓');

  console.log('\n[PWA] 2. Icon HTTP fetch + dimensions');
  for (const url of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-512-maskable.png', '/icons/apple-touch-icon.png', '/favicon-32.png']) {
    const r = await fetch(`${BASE}${url}`);
    if (r.status !== 200) fail(`${url} HTTP ${r.status}`);
    else pass(`${url} HTTP 200 (${r.headers.get('content-type')})`);
  }

  console.log('\n[PWA] 3. <head> meta tags');
  await page.goto(BASE);
  const meta = await page.evaluate(() => {
    const get = (sel) => document.head.querySelector(sel)?.getAttribute('content') || document.head.querySelector(sel)?.getAttribute('href') || null;
    return {
      manifest: document.head.querySelector('link[rel="manifest"]')?.href || null,
      themeColor: get('meta[name="theme-color"]'),
      appleTouch: document.head.querySelector('link[rel="apple-touch-icon"]')?.href || null,
      appleCapable: get('meta[name="apple-mobile-web-app-capable"]'),
      appleStatusBar: get('meta[name="apple-mobile-web-app-status-bar-style"]'),
      mobileCapable: get('meta[name="mobile-web-app-capable"]'),
      appName: get('meta[name="application-name"]'),
      appleTitle: get('meta[name="apple-mobile-web-app-title"]'),
    };
  });
  if (!meta.manifest) fail('link manifest manquant'); else pass(`manifest → ${meta.manifest}`);
  if (meta.themeColor !== '#0a0a15') fail(`theme-color="${meta.themeColor}" ≠ "#0a0a15"`); else pass(`theme-color=${meta.themeColor}`);
  if (!meta.appleTouch) fail('apple-touch-icon manquant'); else pass(`apple-touch-icon → ${meta.appleTouch}`);
  if (meta.appleCapable !== 'yes') fail('apple-mobile-web-app-capable ≠ yes'); else pass('apple-mobile-web-app-capable=yes');
  if (meta.mobileCapable !== 'yes') fail('mobile-web-app-capable ≠ yes'); else pass('mobile-web-app-capable=yes');
  if (meta.appleStatusBar !== 'black-translucent') fail('status-bar-style incorrect'); else pass(`status-bar=${meta.appleStatusBar}`);

  console.log('\n[PWA] 4. Service worker registration');
  await page.waitForTimeout(1500); // laisser le SW s'enregistrer
  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { ok: false, why: 'API absente' };
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return { ok: false, why: 'pas de registration' };
    return {
      ok: true,
      scope: reg.scope,
      active: !!reg.active,
      controller: !!navigator.serviceWorker.controller,
    };
  });
  if (!swState.ok) fail(`SW: ${swState.why}`); else pass(`SW registered scope=${swState.scope} controller=${swState.controller}`);

  console.log('\n[PWA] 5. Cohérence theme-color manifest ↔ meta');
  if (manifest.theme_color !== meta.themeColor) {
    fail(`incohérence: manifest=${manifest.theme_color} meta=${meta.themeColor}`);
  } else {
    pass(`theme-color aligné (${meta.themeColor})`);
  }

  console.log('\n[PWA] 6. SW precache (après reload pour prise en compte v2)');
  await page.reload();
  await page.waitForTimeout(2000);
  const cacheCheck = await page.evaluate(async () => {
    const keys = await caches.keys();
    const staticKey = keys.find(k => k.endsWith('-static'));
    if (!staticKey) return { ok: false, why: 'pas de cache static' };
    const cache = await caches.open(staticKey);
    const reqs = await cache.keys();
    const urls = reqs.map(r => new URL(r.url).pathname);
    return {
      ok: true,
      cacheName: staticKey,
      count: urls.length,
      urls,
      hasManifest: urls.includes('/manifest.json'),
      hasIcon192: urls.includes('/icons/icon-192.png'),
      hasIcon512: urls.includes('/icons/icon-512.png'),
      hasMaskable: urls.includes('/icons/icon-512-maskable.png'),
      hasIndex: urls.includes('/index.html') || urls.includes('/'),
    };
  });
  if (!cacheCheck.ok) { fail(`precache: ${cacheCheck.why}`); }
  else {
    pass(`cache ${cacheCheck.cacheName} (${cacheCheck.count} entrées)`);
    if (!cacheCheck.hasManifest) fail('manifest.json pas precaché'); else pass('manifest.json precaché ✓');
    if (!cacheCheck.hasIcon192) fail('icon-192 pas precaché'); else pass('icon-192 precaché ✓');
    if (!cacheCheck.hasIcon512) fail('icon-512 pas precaché'); else pass('icon-512 precaché ✓');
    if (!cacheCheck.hasMaskable) fail('icon-maskable pas precaché'); else pass('icon-maskable precaché ✓');
    if (!cacheCheck.hasIndex) fail('index pas precaché'); else pass('index precaché ✓');
  }

  await browser.close();

  const okCount = results.filter(r => r.ok).length;
  const total = results.length;
  console.log(`\n========= PWA: ${okCount}/${total} critères OK =========`);
  if (okCount < total) {
    console.log('\n❌ Échecs :');
    results.filter(r => !r.ok).forEach(r => console.log('  -', r.msg));
    process.exit(1);
  }
  console.log('🎉 PWA installable — Chrome l\'affichera dans la barre d\'adresse');
})().catch(e => { console.error('FATAL', e); process.exit(2); });