#!/usr/bin/env sh
# BBS Core — manual database backup
# Usage (on VPS, from project root):
#   ./scripts/backup-db.sh
#
# What it does:
#   - runs mariadb-dump inside the running backend container
#   - writes a timestamped .sql file to ./backups/ on the host
#   - filename: bbs-<DB_NAME>-v<VERSION>-<UTC_TIMESTAMP>.sql
#
# Safety:
#   - read-only against the database
#   - never deletes existing backups
#   - does NOT stop any container
#
# Restore: see scripts/restore-db.sh (manual, destructive, read warnings).
set -eu

BBS_VERSION="0.1.2"
BACKEND_CONTAINER="${BBS_BACKEND_CONTAINER:-bbs_backend}"
HOST_BACKUP_DIR="${BBS_BACKUP_DIR:-./backups}"

# Load .env if present, for DB_NAME / DB_USER / DB_PASSWORD / DB_HOST.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

DB_HOST="${DB_HOST:-db}"
DB_NAME="${DB_NAME:-bbs_core}"
DB_USER="${DB_USER:-bbs}"
DB_PASSWORD="${DB_PASSWORD:-}"

if [ -z "$DB_PASSWORD" ]; then
  echo "ERROR: DB_PASSWORD is empty. Set it in .env." >&2
  exit 1
fi

mkdir -p "$HOST_BACKUP_DIR"

TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
FILE="bbs-${DB_NAME}-v${BBS_VERSION}-${TS}.sql"
CONTAINER_PATH="/backups/${FILE}"

echo "[backup] container=${BACKEND_CONTAINER} db=${DB_NAME} file=${FILE}"

docker exec -e MYSQL_PWD="$DB_PASSWORD" "$BACKEND_CONTAINER" \
  sh -c "mariadb-dump --single-transaction --quick --routines --triggers \
    -h '$DB_HOST' -u '$DB_USER' '$DB_NAME' > '$CONTAINER_PATH'"

# Backups dir is host-mounted (./backups:/backups), so the file is already on host.
SIZE="$(stat -c %s "$HOST_BACKUP_DIR/$FILE" 2>/dev/null || stat -f %z "$HOST_BACKUP_DIR/$FILE")"
echo "[backup] OK  path=$HOST_BACKUP_DIR/$FILE  size=${SIZE} bytes"
