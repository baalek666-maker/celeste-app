#!/usr/bin/env bash
# P1 #11 — Backup automatique SQLite.
# Cron : 0 */6 * * * /home/ubuntu/celeste-app/scripts/backup-db.sh
#
# Garde 14 jours de backups en local. Uploade en S3 si BACKUP_S3_BUCKET défini.

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/home/ubuntu/celeste-app}"
DB_PATH="${DATABASE_PATH:-$REPO_ROOT/server/data/celeste.db}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/celeste-$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "[backup] No DB at $DB_PATH — nothing to do."
  exit 0
fi

# SQLite safe backup (handles concurrent writes via the .backup command).
sqlite3 "$DB_PATH" ".timeout 5000" ".backup '$BACKUP_FILE'"
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[backup] OK → $BACKUP_FILE ($SIZE)"

# Compress (backups sont des dumps statiques — gzip ~10x)
gzip -f "$BACKUP_FILE"
echo "[backup] Compressed → $BACKUP_FILE.gz"

# Retention locale
find "$BACKUP_DIR" -name "celeste-*.db.gz" -mtime +"$RETENTION_DAYS" -delete
echo "[backup] Retention: kept last $RETENTION_DAYS days locally"

# Upload S3 si configuré
if [ -n "${BACKUP_S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  aws s3 cp "$BACKUP_FILE.gz" "s3://$BACKUP_S3_BUCKET/db-backups/celeste-$TIMESTAMP.db.gz" \
    --storage-class STANDARD_IA
  echo "[backup] Uploaded to s3://$BACKUP_S3_BUCKET/db-backups/"
fi