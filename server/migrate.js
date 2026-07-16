/**
 * server/migrate.js — Lightweight schema migration runner.
 *
 * - Uses the existing better-sqlite3 `db` instance (no new dependency)
 * - Migrations live in server/migrations/ as numbered .js files
 * - Each export: { id, name, up(db) }
 * - Tracked in `_migrations` table (schema version)
 * - Runs automatically on server boot BEFORE route declarations
 * - Idempotent: already-applied migrations are skipped
 * - Transactional: a failed migration rolls back and halts the boot
 *
 * Naming convention: NNN_description.js (zero-padded, e.g. 001, 002)
 */

import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {{ applied: number, skipped: number, total: number }}
 */
export async function runMigrations(db) {
  // 1. Ensure _migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 2. Load already-applied migrations
  const applied = new Set(
    db.prepare('SELECT id FROM _migrations').all().map(r => r.id)
  );

  // 3. Discover migration files
  let files = [];
  try {
    files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.js'))
      .sort();
  } catch {
    // migrations/ folder doesn't exist yet — nothing to run
    console.log('[migrate] No migrations directory — skipping');
    return { applied: 0, skipped: 0, total: 0 };
  }

  let appliedCount = 0;
  let skippedCount = 0;

  // 4. Run each pending migration in order
  for (const file of files) {
    const mod = await import(join(MIGRATIONS_DIR, file));
    const migration = mod.default || mod;

    if (!migration.id || !migration.name || typeof migration.up !== 'function') {
      console.warn(`[migrate] ⚠️ Skipping ${file}: missing id/name/up`);
      continue;
    }

    if (applied.has(migration.id)) {
      skippedCount++;
      continue;
    }

    // Run in a transaction — rollback on failure
    const run = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO _migrations (id, name) VALUES (?, ?)').run(
        migration.id,
        migration.name
      );
    });

    try {
      run();
      appliedCount++;
      console.log(`[migrate] ✅ ${migration.id.toString().padStart(3, '0')}: ${migration.name}`);
    } catch (err) {
      console.error(`[migrate] ❌ ${migration.name} failed:`, err.message);
      // Re-throw to halt the boot — a half-migrated schema is dangerous
      throw new Error(`Migration ${migration.id} (${migration.name}) failed: ${err.message}`);
    }
  }

  console.log(`[migrate] ${appliedCount} applied, ${skippedCount} skipped, ${files.length} total`);
  return { applied: appliedCount, skipped: skippedCount, total: files.length };
}
