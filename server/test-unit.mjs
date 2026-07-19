// Tests unitaires backend Céleste — fonctions pures critiques.
// Run: node server/test-unit.mjs (depuis la racine du repo)
//
// P2-9 — Coverage des fonctions pures les + critiques du serveur.
// Pattern : on réplique les fonctions ici (contrat vivant). Si une fonction
// change dans server.js sans que ce test échoue → on a un drift, à corriger.
//
// 0 dépendance externe, node natif, exécution < 1s.

import assert from 'node:assert/strict';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}\n      ${err.message}`); failed++; }
}
function group(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// ─── Répliques des fonctions pures de server.js ─────────────────────────

const ZODIAC_ARC_ORDER = ['Bélier','Taureau','Gémeaux','Cancer','Lion','Vierge','Balance','Scorpion','Sagittaire','Capricorne','Verseau','Poissons'];

function safeJsonParse(input, fallback = null, contextLabel = 'json') {
  if (input == null) return fallback;
  if (typeof input !== 'string') return input;
  try { return JSON.parse(input); }
  catch (err) {
    console.warn(`[safeJsonParse] ${contextLabel} corrupted:`, err.message);
    return fallback;
  }
}

function degToSign(deg) {
  const normDeg = ((deg % 360) + 360) % 360;
  const signIdx = Math.floor(normDeg / 30);
  const signDeg = normDeg - signIdx * 30;
  return { sign: ZODIAC_ARC_ORDER[signIdx], degree: signDeg, absDeg: normDeg };
}

function signDistance(s1, s2) {
  const order = ZODIAC_ARC_ORDER;
  const i1 = order.indexOf(s1); const i2 = order.indexOf(s2);
  if (i1 < 0 || i2 < 0) return 999;
  let d = Math.abs(i1 - i2) * 30;
  return d > 180 ? 360 - d : d;
}

function aspectTypeFromDistance(deg) {
  if (deg <= 8) return { name: 'conjunction', weight: 1.0, harmonious: false };
  if (Math.abs(deg - 60) <= 6) return { name: 'sextile', weight: 0.6, harmonious: true };
  if (Math.abs(deg - 90) <= 6) return { name: 'square', weight: -0.7, harmonious: false };
  if (Math.abs(deg - 120) <= 8) return { name: 'trine', weight: 0.9, harmonious: true };
  if (Math.abs(deg - 180) <= 8) return { name: 'opposition', weight: -0.4, harmonious: false };
  return null;
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA + 'T00:00:00Z');
  const b = new Date(isoB + 'T00:00:00Z');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function localISODate() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
}

function yesterdayISODate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleString('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
}

function validateBirthData(input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Données de naissance manquantes ou invalides.' };
  }
  const { date, time, city, country, latitude, longitude, timezone } = input;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Date de naissance requise (format YYYY-MM-DD).' };
  }
  const [yStr, mStr, dStr] = date.split('-');
  const y = Number(yStr), m = Number(mStr), d = Number(dStr);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return { ok: false, error: 'Date de naissance invalide (ex: 31 février).' };
  }
  const nowUtc = new Date();
  if (probe.getTime() > nowUtc.getTime() + 86400000) {
    return { ok: false, error: 'La date de naissance ne peut pas être dans le futur.' };
  }
  if (probe.getTime() < nowUtc.getTime() - 150 * 365 * 86400000) {
    return { ok: false, error: 'Date de naissance trop ancienne.' };
  }
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, error: 'Heure de naissance requise (format HH:MM).' };
  }
  const [hh, mm] = time.split(':').map(Number);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return { ok: false, error: 'Heure de naissance invalide.' };
  }
  if (typeof city !== 'string' || city.length < 1 || city.length > 100) {
    return { ok: false, error: 'Ville de naissance requise.' };
  }
  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    return { ok: false, error: 'Latitude invalide.' };
  }
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    return { ok: false, error: 'Longitude invalide.' };
  }
  if (typeof timezone !== 'number' || timezone < -12 || timezone > 14) {
    return { ok: false, error: 'Fuseau horaire invalide.' };
  }
  return { ok: true, birthData: { date, time, city, country: country || '', latitude, longitude, timezone } };
}

const ELEMENT_AFFINITY = {
  'Fire-Fire': 75, 'Fire-Air': 85, 'Fire-Earth': 40, 'Fire-Water': 35,
  'Earth-Earth': 75, 'Earth-Water': 85, 'Earth-Air': 40,
  'Air-Air': 75, 'Air-Water': 40,
  'Water-Water': 80,
};
function elementAffinity(e1, e2) {
  if (e1 === e2) return ELEMENT_AFFINITY[`${e1}-${e2}`] ?? 70;
  return ELEMENT_AFFINITY[`${e1}-${e2}`] ?? ELEMENT_AFFINITY[`${e2}-${e1}`] ?? 55;
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'string') {
      // Strip control chars + cap length to prevent log injection / memory blowup
      out[k] = v.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 10000);
    } else if (v !== null && typeof v === 'object') {
      out[k] = sanitizeBody(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─── TESTS ─────────────────────────────────────────────────────────────

console.log('🧪 Céleste backend — tests unitaires\n');

// 1. safeJsonParse (legacy regression guard)
group('── safeJsonParse ──', () => {
  test('null → fallback', () => assert.equal(safeJsonParse(null, 'fb'), 'fb'));
  test('undefined → fallback', () => assert.equal(safeJsonParse(undefined, 'fb'), 'fb'));
  test('empty string → fallback', () => assert.equal(safeJsonParse('', 'fb'), 'fb'));
  test('valid JSON → parsed', () => assert.deepEqual(safeJsonParse('{"a":1,"b":[2,3]}'), { a: 1, b: [2, 3] }));
  test('corrupted → fallback', () => assert.equal(safeJsonParse('not json {{{', 'fb'), 'fb'));
  test('object passed through', () => {
    const obj = { x: 1 };
    assert.equal(safeJsonParse(obj, 'fb'), obj);
  });
});

// 2. degToSign — base astrologique
group('── degToSign ──', () => {
  test('0° → Bélier', () => assert.equal(degToSign(0).sign, 'Bélier'));
  test('29.99° → Bélier (borne haute)', () => assert.equal(degToSign(29.99).sign, 'Bélier'));
  test('30° → Taureau', () => assert.equal(degToSign(30).sign, 'Taureau'));
  test('180° → Balance', () => assert.equal(degToSign(180).sign, 'Balance'));
  test('359.99° → Poissons', () => assert.equal(degToSign(359.99).sign, 'Poissons'));
  test('360° → Bélier (wrap)', () => assert.equal(degToSign(360).sign, 'Bélier'));
  test('-30° → Poissons (négatif wrap)', () => assert.equal(degToSign(-30).sign, 'Poissons'));
  test('-1° → Poissons (négatif wrap = 359°)', () => assert.equal(degToSign(-1).sign, 'Poissons'));
  test('720° → Bélier (double wrap)', () => assert.equal(degToSign(720).sign, 'Bélier'));
  test('degree intra-sign correct', () => {
    const r = degToSign(45);
    assert.equal(r.sign, 'Taureau');
    assert.ok(Math.abs(r.degree - 15) < 0.001, `degree=15 expected, got ${r.degree}`);
  });
});

// 3. signDistance
group('── signDistance ──', () => {
  test('Bélier-Bélier = 0°', () => assert.equal(signDistance('Bélier', 'Bélier'), 0));
  test('Bélier-Taureau = 30°', () => assert.equal(signDistance('Bélier', 'Taureau'), 30));
  test('Bélier-Cancer = 90° (square)', () => assert.equal(signDistance('Bélier', 'Cancer'), 90));
  test('Bélier-Balance = 180° (opposition)', () => assert.equal(signDistance('Bélier', 'Balance'), 180));
  test('symétrique : Poissons-Bélier = 30°', () => assert.equal(signDistance('Poissons', 'Bélier'), 30));
  test('symétrique : Balance-Bélier = 180°', () => assert.equal(signDistance('Balance', 'Bélier'), 180));
  test('signe inconnu → 999', () => assert.equal(signDistance('XX', 'Bélier'), 999));
  test('Sagittaire-Cancer = 150° (court chemin)', () => assert.equal(signDistance('Sagittaire', 'Cancer'), 150));
});

// 4. aspectTypeFromDistance
group('── aspectTypeFromDistance ──', () => {
  test('0° → conjunction', () => assert.equal(aspectTypeFromDistance(0).name, 'conjunction'));
  test('8° → conjunction (borne)', () => assert.equal(aspectTypeFromDistance(8).name, 'conjunction'));
  test('9° → null (trop loin conjunction)', () => assert.equal(aspectTypeFromDistance(9), null));
  test('60° → sextile, harmonious', () => {
    const a = aspectTypeFromDistance(60);
    assert.equal(a.name, 'sextile'); assert.equal(a.harmonious, true);
  });
  test('66° → sextile (orbis ≤6 inclusif, borne)', () => {
    const a = aspectTypeFromDistance(66);
    assert.equal(a.name, 'sextile'); assert.equal(a.harmonious, true);
  });
  test('67° → null (hors orbis sextile)', () => assert.equal(aspectTypeFromDistance(67), null));
  test('90° → square, tension', () => {
    const a = aspectTypeFromDistance(90);
    assert.equal(a.name, 'square'); assert.equal(a.harmonious, false);
  });
  test('120° → trine, harmonious', () => {
    const a = aspectTypeFromDistance(120);
    assert.equal(a.name, 'trine'); assert.equal(a.harmonious, true); assert.ok(a.weight > 0);
  });
  test('180° → opposition, tension', () => {
    const a = aspectTypeFromDistance(180);
    assert.equal(a.name, 'opposition'); assert.equal(a.harmonious, false); assert.ok(a.weight < 0);
  });
  test('45° → null (pas d\'aspect majeur)', () => assert.equal(aspectTypeFromDistance(45), null));
});

// 5. daysBetween
group('── daysBetween ──', () => {
  test('même jour = 0', () => assert.equal(daysBetween('2026-07-19', '2026-07-19'), 0));
  test('jour suivant = +1', () => assert.equal(daysBetween('2026-07-19', '2026-07-20'), 1));
  test('jour précédent = -1', () => assert.equal(daysBetween('2026-07-20', '2026-07-19'), -1));
  test('1 an = 365 (année non bissextile)', () => assert.equal(daysBetween('2025-07-19', '2026-07-19'), 365));
  test('29 fév → 1 mars 2024 = 1 (bissextile)', () => assert.equal(daysBetween('2024-02-29', '2024-03-01'), 1));
  test('passage d\'année', () => assert.equal(daysBetween('2025-12-31', '2026-01-01'), 1));
});

// 6. localISODate / yesterdayISODate
group('── Dates ISO ──', () => {
  test('localISODate format YYYY-MM-DD', () => {
    const d = localISODate();
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/, `got: ${d}`);
  });
  test('yesterdayISODate = today - 1', () => {
    const today = localISODate();
    const y = yesterdayISODate();
    assert.equal(daysBetween(today, y), -1);
  });
});

// 7. validateBirthData — sécurité entrée user
group('── validateBirthData ──', () => {
  const valid = { date: '1990-05-15', time: '14:30', city: 'Paris', country: 'France', latitude: 48.85, longitude: 2.35, timezone: 2 };

  test('valid → ok', () => {
    const r = validateBirthData(valid);
    assert.equal(r.ok, true);
    assert.equal(r.birthData.date, '1990-05-15');
  });
  test('null → ko', () => assert.equal(validateBirthData(null).ok, false));
  test('array → ko', () => assert.equal(validateBirthData([1,2,3]).ok, false));
  test('31 février → ko (overflow calendar)', () => {
    const r = validateBirthData({ ...valid, date: '2026-02-31' });
    assert.equal(r.ok, false);
    assert.match(r.error, /invalide/i);
  });
  test('date future → ko', () => {
    const r = validateBirthData({ ...valid, date: '2099-01-01' });
    assert.equal(r.ok, false);
    assert.match(r.error, /futur/i);
  });
  test('date > 150 ans → ko', () => {
    const r = validateBirthData({ ...valid, date: '1800-01-01' });
    assert.equal(r.ok, false);
  });
  test('format date erroné → ko', () => {
    assert.equal(validateBirthData({ ...valid, date: '1990-5-15' }).ok, false);
    assert.equal(validateBirthData({ ...valid, date: '15/05/1990' }).ok, false);
  });
  test('heure 25:99 → ko', () => {
    assert.equal(validateBirthData({ ...valid, time: '25:99' }).ok, false);
  });
  test('heure 23:59 → ok (borne haute)', () => {
    assert.equal(validateBirthData({ ...valid, time: '23:59' }).ok, true);
  });
  test('latitude > 90 → ko', () => {
    assert.equal(validateBirthData({ ...valid, latitude: 91 }).ok, false);
  });
  test('latitude -90 → ok (pôle Sud)', () => {
    assert.equal(validateBirthData({ ...valid, latitude: -90 }).ok, true);
  });
  test('longitude 181 → ko', () => {
    assert.equal(validateBirthData({ ...valid, longitude: 181 }).ok, false);
  });
  test('timezone 15 → ko (max 14)', () => {
    assert.equal(validateBirthData({ ...valid, timezone: 15 }).ok, false);
  });
  test('timezone -13 → ko (min -12)', () => {
    assert.equal(validateBirthData({ ...valid, timezone: -13 }).ok, false);
  });
  test('country omis → ok (default vide)', () => {
    const r = validateBirthData({ ...valid, country: undefined });
    assert.equal(r.ok, true);
    assert.equal(r.birthData.country, '');
  });
});

// 8. elementAffinity
group('── elementAffinity ──', () => {
  test('Fire-Fire = 75', () => assert.equal(elementAffinity('Fire', 'Fire'), 75));
  test('Fire-Air = 85 (complémentaires)', () => assert.equal(elementAffinity('Fire', 'Air'), 85));
  test('Fire-Water = 35 (faible)', () => assert.equal(elementAffinity('Fire', 'Water'), 35));
  test('symétrique : Air-Fire = 85', () => assert.equal(elementAffinity('Air', 'Fire'), 85));
  test('Water-Water = 80', () => assert.equal(elementAffinity('Water', 'Water'), 80));
  test('élément inconnu → fallback 55', () => assert.equal(elementAffinity('XX', 'Fire'), 55));
});

// 9. sanitizeBody — sécurité
group('── sanitizeBody ──', () => {
  test('null → {}', () => assert.deepEqual(sanitizeBody(null), {}));
  test('string passée avec trim control chars', () => {
    const r = sanitizeBody({ name: 'A\x00B\x1FC' });
    assert.equal(r.name, 'ABC');
  });
  test('long string tronquée à 10000', () => {
    const long = 'x'.repeat(15000);
    const r = sanitizeBody({ big: long });
    assert.equal(r.big.length, 10000);
  });
  test('objet imbriqué sanitisé récursivement', () => {
    const r = sanitizeBody({ nested: { a: 'x\x00y' } });
    assert.equal(r.nested.a, 'xy');
  });
  test('nombre préservé', () => {
    const r = sanitizeBody({ n: 42 });
    assert.equal(r.n, 42);
  });
});

// ─── Résumé ────────────────────────────────────────────────────────────
console.log(`\n──────────────────────────────────────`);
console.log(`📊 ${passed}/${passed + failed} tests passed`);
if (failed > 0) {
  console.error(`❌ ${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log(`✅ All green`);
  process.exit(0);
}
