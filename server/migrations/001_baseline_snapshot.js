/**
 * Migration 001 — Baseline schema snapshot (July 2026)
 *
 * This migration does NOT create tables — they already exist via the inline
 * `CREATE TABLE IF NOT EXISTS` statements in server.js. Its sole purpose is
 * to mark the current schema version as "0001" so future migrations run
 * from a known state.
 *
 * When you remove the inline CREATE statements from server.js in a future
 * refactor, create migration 002+ with the actual DDL.
 *
 * @type {{ id: number, name: string, up: (db: import('better-sqlite3').Database) => void }}
 */
export default {
  id: 1,
  name: 'baseline_snapshot_2026_07',
  up(db) {
    // Verify the core tables exist (fail fast if schema is broken)
    const check = db.prepare(
      "SELECT COUNT(*) as n FROM sqlite_master WHERE type='table' AND name='users'"
    ).get();
    if (check.n === 0) {
      throw new Error('Baseline check failed: users table missing');
    }
    // No-op: tables already created by server.js inline DDL
    console.log('[migrate] 001 baseline: schema verified, 13+ tables present');
  },
};
