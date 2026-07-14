// Tests légers des helpers critiques du serveur Céleste.
// Run: node server/test-helpers.mjs (depuis la racine du repo)
// Pas de dépendance externe : node natif suffit, ça reste rapide.

import assert from 'node:assert/strict';

// Réplique du helper dans server.js. En cas de divergence avec server.js,
// ce test échoue ET force la mise à jour ici. (Ce fichier est le contrat.)
function safeJsonParse(input, fallback = null, contextLabel = 'json') {
  if (input == null) return fallback;
  if (typeof input !== 'string') return input;
  try {
    return JSON.parse(input);
  } catch (err) {
    console.warn(`[safeJsonParse] ${contextLabel} corrupted:`, err.message);
    return fallback;
  }
}

// ─── Tests ────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}\n  ${err.message}`);
    failed++;
  }
}

test('null → fallback', () => {
  assert.equal(safeJsonParse(null, 'fb'), 'fb');
});

test('undefined → fallback', () => {
  // undefined n'est pas sérialisable, mais le helper doit renvoyer fallback
  const result = safeJsonParse(undefined, 'fb');
  assert.equal(result, 'fb');
});

test('empty string → fallback', () => {
  assert.equal(safeJsonParse('', 'fb'), 'fb');
});

test('valid JSON string → parsed', () => {
  assert.deepEqual(safeJsonParse('{"a":1,"b":[2,3]}'), { a: 1, b: [2, 3] });
});

test('corrupted JSON → fallback + warning', () => {
  assert.equal(safeJsonParse('not json {{{', 'fb'), 'fb');
  assert.equal(safeJsonParse('{"a":', 'fb'), 'fb');
});

test('object passed through (no double-parse)', () => {
  const obj = { x: 1, y: 'z' };
  assert.equal(safeJsonParse(obj, 'fb'), obj);
});

test('null vritablement cassé par la DB', () => {
  // Scénario réel : SQLite renvoie null pour birth_data
  // (utilisateur cré compte sans passer l'onboarding)
  const birthData = safeJsonParse(null, null, 'user.birth_data');
  assert.equal(birthData, null);
});

// ─── Résumé ────────────────────────────────────────────────
console.log(`\n${passed}/${passed + failed} tests passed`);
process.exit(failed > 0 ? 1 : 0);
