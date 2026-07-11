/**
 * e2e_smoke.mjs — End-to-end smoke test for Celeste app.
 *
 * Tests (without Chromium — uses HTTP probes against the running
 * dev/preview server, which is enough for backend + asset validation):
 *   1. Build artifacts present (dist/index.html, dist/assets/*.js)
 *   2. index.html contains <main id="main-content"> landmark
 *   3. PWA manifest reachable
 *   4. Service worker reachable + contains CACHE_VERSION
 *   5. Backend health endpoint returns OK
 *   6. Public moon-phase endpoint returns astronomy-engine data
 *   7. Bundle size within budget (< 500 kB raw)
 *
 * Run:
 *   node tests/e2e_smoke.mjs
 *   BASE_URL=http://localhost:4173 node tests/e2e_smoke.mjs
 *   API_URL=http://localhost:3001 node tests/e2e_smoke.mjs
 *
 * Exit 0 if all pass, exit 1 on first failure.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const API_URL = process.env.API_URL || 'http://localhost:3001';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    const detail = fn();
    if (detail === false) {
      failed++;
      failures.push(name);
      console.log(`✗ ${name}`);
    } else {
      passed++;
      console.log(`✓ ${name}${detail ? ' — ' + detail : ''}`);
    }
  } catch (err) {
    failed++;
    failures.push(`${name}: ${err.message}`);
    console.log(`✗ ${name} — ${err.message}`);
  }
}

async function acheck(name, fn) {
  try {
    const detail = await fn();
    if (detail === false) {
      failed++;
      failures.push(name);
      console.log(`✗ ${name}`);
    } else {
      passed++;
      console.log(`✓ ${name}${detail ? ' — ' + detail : ''}`);
    }
  } catch (err) {
    failed++;
    failures.push(`${name}: ${err.message}`);
    console.log(`✗ ${name} — ${err.message}`);
  }
}

console.log(`\n🧪 Celeste E2E smoke tests`);
console.log(`   BASE_URL = ${BASE_URL}`);
console.log(`   API_URL  = ${API_URL}\n`);

// 1. Build artifacts present
check('Build: dist/index.html exists', () => {
  if (!existsSync(join(ROOT, 'dist/index.html'))) throw new Error('dist/index.html missing');
  return 'present';
});

check('Build: dist/assets/*.js exists', () => {
  const assetsDir = join(ROOT, 'dist/assets');
  if (!existsSync(assetsDir)) throw new Error('dist/assets missing');
  const files = readFileSync(join(ROOT, 'dist/index.html'), 'utf8');
  const matches = files.match(/assets\/index-[^"]+\.js/g) || [];
  if (matches.length === 0) throw new Error('no JS asset referenced');
  return matches[0];
});

// 2. HTML landmark for a11y
check('A11y: <main id="main-content"> in dist/index.html', () => {
  const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf8');
  if (!html.includes('id="main-content"')) throw new Error('landmark missing');
  return 'found';
});

// 7. Bundle size
check('Build: bundle < 500 kB raw', () => {
  const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf8');
  const m = html.match(/assets\/(index-[^"]+\.js)/);
  if (!m) throw new Error('asset not found');
  const stat = statSync(join(ROOT, 'dist/assets', m[1]));
  const kb = Math.round(stat.size / 1024);
  if (kb > 500) throw new Error(`${kb} kB > 500 kB budget`);
  return `${kb} kB`;
});

// 3-4. PWA assets reachable via HTTP
await acheck('HTTP: PWA manifest reachable', async () => {
  const r = await fetch(`${BASE_URL}/manifest.json`).catch(() => null);
  if (!r || !r.ok) throw new Error(`status ${r?.status}`);
  const json = await r.json();
  if (!json.name) throw new Error('no name field');
  return json.name;
});

await acheck('HTTP: service worker reachable + CACHE_VERSION', async () => {
  const r = await fetch(`${BASE_URL}/sw.js`).catch(() => null);
  if (!r || !r.ok) throw new Error(`status ${r?.status}`);
  const body = await r.text();
  if (!body.includes('CACHE_VERSION')) throw new Error('CACHE_VERSION missing');
  return 'CACHE_VERSION ok';
});

// 5-6. Backend health + astro
await acheck('API: /api/health returns ok', async () => {
  const r = await fetch(`${API_URL}/api/health`).catch(() => null);
  if (!r || !r.ok) throw new Error(`status ${r?.status}`);
  const json = await r.json();
  if (json.status !== 'ok') throw new Error(`status=${json.status}`);
  return json.ephemeris || 'ok';
});

await acheck('API: /api/astro/moon-phase returns astronomy-engine data', async () => {
  const r = await fetch(`${API_URL}/api/astro/moon-phase`).catch(() => null);
  if (!r || !r.ok) throw new Error(`status ${r?.status}`);
  const json = await r.json();
  if (typeof json.age !== 'number') throw new Error('no age field');
  if (!json.name) throw new Error('no name field');
  return `${json.name} age=${json.age.toFixed(1)}d`;
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`\n❌ Failures:`);
  for (const f of failures) console.log(`   - ${f}`);
  process.exit(1);
}
console.log('✅ All E2E smoke tests passed.\n');