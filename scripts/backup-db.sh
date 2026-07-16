#!/usr/bin/env bash
# P1 #11 — Backup automatique SQLite.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/home/ubuntu/celeste-app}"
DB_PATH="${DATABASE_PATH:-$REPO_ROOT/server/celeste.db}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/celeste-$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "[backup] No DB at $DB_PATH — nothing to do."
  exit 0
fi

sqlite3 "$DB_PATH" ".timeout 5000" ".backup '$BACKUP_FILE'"
gzip -f "$BACKUP_FILE"
echo "[backup] OK → $BACKUP_FILE.gz"

find "$BACKUP_DIR" -name "celeste-*.db.gz" -mtime +"$RETENTION_DAYS" -delete
echo "[backup] Retention: kept last $RETENTION_DAYS days"

if [ -n "${BACKUP_S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  aws s3 cp "$BACKUP_FILE.gz" "s3://$BACKUP_S3_BUCKET/db-backups/celeste-$TIMESTAMP.db.gz" --storage-class STANDARD_IA
  echo "[backup] Uploaded to S3"
fi
