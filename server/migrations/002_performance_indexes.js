/**
 * Migration 002 — Add missing performance indexes
 *
 * These indexes cover queries that were doing full table scans:
 *   - journal_entries(user_id)           → Settings screen loads journal
 *   - journal_entries(user_id, date)     → Date-filtered journal lookups
 *   - horoscope_personal_daily(date)     → Cron batch updates & cleanup
 *
 * Note: horoscope_personal_daily has NO user_id column (keyed by astro signs).
 *
 * Uses CREATE INDEX IF NOT EXISTS so it's safe even if manually applied.
 *
 * @type {{ id: number, name: string, up: (db: import('better-sqlite3').Database) => void }}
 */
export default {
  id: 2,
  name: 'add_performance_indexes',
  up(db) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_journal_user_date ON journal_entries(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_horoscope_personal_date ON horoscope_personal_daily(date);
    `);
  },
};
