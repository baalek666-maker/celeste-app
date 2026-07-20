/**
 * Migration 004 — OAuth columns (provider, oauth_id, avatar_url, display_name)
 *
 * Adds columns needed for Sign in with Apple + Google. Existing email/password
 * accounts are preserved (oauth_provider = NULL means classic auth).
 *
 * Display name is also added here because OAuth providers give a name at
 * signup, whereas classic accounts just have email.
 *
 * IDEMPOTENT : if columns already exist (e.g. manually applied in dev),
 * the migration no-ops instead of crashing the boot.
 *
 * @type {{ id: number, name: string, up: (db: import('better-sqlite3').Database) => void }}
 */
export default {
  id: 4,
  name: 'oauth_columns',
  up(db) {
    const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
    const add = (col, ddl) => {
      if (!cols.includes(col)) {
        db.exec(ddl);
      }
    };
    add('oauth_provider', "ALTER TABLE users ADD COLUMN oauth_provider TEXT");
    add('oauth_id', "ALTER TABLE users ADD COLUMN oauth_id TEXT");
    add('avatar_url', "ALTER TABLE users ADD COLUMN avatar_url TEXT");
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id) WHERE oauth_provider IS NOT NULL');
    console.log('[migrate] 004: oauth columns ensured (idempotent)');
  },
};