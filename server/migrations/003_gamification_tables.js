/**
 * Migration 003 — Gamification tables (user_xp, daily_quests, user_badges, xp_log)
 *
 * Bug découvert le 2026-07-19 : les tables gamification n'étaient pas créées
 * automatiquement au boot. La migration_gamification.sql existait mais n'était
 * jamais exécutée par le système de migrations automatique.
 *
 * Conséquence : /api/gamification/status plantait en 500, ProgressionHub
 * affichait "Impossible de charger ta progression", XpBar et BadgeGrid
 * affichaient une page vide.
 *
 * @type {{ id: number, name: string, up: (db: import('better-sqlite3').Database) => void }}
 */
export default {
  id: 3,
  name: 'gamification_tables',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_xp (
        user_id INTEGER PRIMARY KEY,
        xp_total INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        updated_at INTEGER DEFAULT (strftime('%s','now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS daily_quests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        quest_key TEXT NOT NULL,
        quest_label TEXT NOT NULL,
        xp_reward INTEGER DEFAULT 10,
        completed INTEGER DEFAULT 0,
        completed_at INTEGER,
        UNIQUE(user_id, date, quest_key),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS user_badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        badge_id TEXT NOT NULL,
        earned_at INTEGER DEFAULT (strftime('%s','now')),
        UNIQUE(user_id, badge_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS xp_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
    console.log('[migrate] 003: gamification tables ensured');
  },
};
