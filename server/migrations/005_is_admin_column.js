/**
 * Migration 005 — Add is_admin column to users
 *
 * Découvert pendant l'audit P0 (2026-08-02) :
 * Les fixes B2 (streak/freeze abuse) et B3 (badge grant abuse) ajoutent
 * un check `is_admin` mais cette colonne n'existait pas dans le schéma users.
 *
 * Symptôme : B3 renvoyait HTTP 500 au lieu de 403 admin_only car
 * `db.prepare('SELECT is_admin FROM users...')` plantait avec
 * "no such column: is_admin".
 *
 * Fix : ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0
 * Sans valeur par défaut non-zéro : tous les users existants restent
 * non-admin. Pour promouvoir un admin, faire :
 *   UPDATE users SET is_admin = 1 WHERE email = 'admin@celeste.app';
 *
 * @type {{ id: number, name: string, up: (db: import('better-sqlite3').Database) => void }}
 */
export default {
  id: 5,
  name: 'is_admin_column',
  up(db) {
    // Vérifier si la colonne existe déjà (idempotence)
    const cols = db.prepare("PRAGMA table_info(users)").all();
    const hasIsAdmin = cols.some(c => c.name === 'is_admin');
    if (!hasIsAdmin) {
      db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`);
      console.log('[migrate 005] Added users.is_admin column');
    } else {
      console.log('[migrate 005] users.is_admin already exists, skipping');
    }
  },
};
