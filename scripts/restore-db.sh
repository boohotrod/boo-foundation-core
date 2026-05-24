#!/usr/bin/env sh
# BBS Core — manual database restore
#
# !! DESTRUCTIVE !!
#   This OVERWRITES the current database with the contents of a backup file.
#   Always take a fresh backup first:
#     ./scripts/backup-db.sh
#
# Usage:
#   ./scripts/restore-db.sh backups/bbs-bbs_core-v0.1.2-2026-05-24T20-00-00Z.sql
#
# Requires explicit confirmation. Type RESTORE to proceed.
set -eu

BACKEND_CONTAINER="${BBS_BACKEND_CONTAINER:-bbs_backend}"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-backup.sql>" >&2
  exit 2
fi
SRC="$1"

if [ ! -f "$SRC" ]; then
  echo "ERROR: file not found: $SRC" >&2
  exit 2
fi

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

echo "About to RESTORE database '$DB_NAME' from: $SRC"
echo "This will OVERWRITE current data. Type RESTORE to continue."
read -r CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Aborted."
  exit 1
fi

# Copy file into the backend container, then pipe into mariadb client.
BASENAME="$(basename "$SRC")"
docker cp "$SRC" "$BACKEND_CONTAINER:/tmp/$BASENAME"
docker exec -e MYSQL_PWD="$DB_PASSWORD" "$BACKEND_CONTAINER" \
  sh -c "mariadb -h '$DB_HOST' -u '$DB_USER' '$DB_NAME' < '/tmp/$BASENAME' && rm -f '/tmp/$BASENAME'"

echo "[restore] OK  from=$SRC  db=$DB_NAME"
