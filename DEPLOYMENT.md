# BBS Core — VPS deployment guide (v0.1.2)

Target: Hetzner VPS with Docker + Portainer. System nginx must remain
disabled — the frontend container's nginx serves the SPA on port 8080.

## 1. Prerequisites

- Docker + Docker Compose plugin installed
- Project cloned to the VPS (e.g. `/opt/bbs-core`)
- `.env` file with at minimum `DB_PASSWORD` and `APP_SECRET` set
  (copy from `.env.example`)
- A writable `./backups` directory in the project root (auto-created by
  Docker if missing; bind-mounted into the backend at `/backups`)

## 2. Standard deploy (pull + rebuild)

```bash
cd /opt/bbs-core
git pull
docker compose down
docker compose up -d --build
docker ps
```

> ⚠️ NEVER run `docker compose down -v`. The `-v` flag deletes the
> `bbs_db_data` volume — your entire MariaDB database is gone. The
> backup bind-mount (`./backups`) is on the host filesystem and is
> untouched by compose volume commands.

All three containers should report `Up` with `restart: unless-stopped`:

- `bbs-core-frontend-1`  → nginx + SPA, port 8080
- `bbs-core-backend-1`   → Node.js API on internal :4000, mariadb-client installed
- `bbs-core-db-1`        → MariaDB 11

## 3. Health verification

Replace `<VPS_IP>` with the server's public IP (e.g. `178.105.46.214`).

| URL                                         | Expected                                                       |
| ------------------------------------------- | -------------------------------------------------------------- |
| `http://<VPS_IP>:8080/health`               | Plain text: `BBS Core Frontend OK / Version: 0.1.2 / ...`       |
| `http://<VPS_IP>:8080/api/health`           | JSON with `"status":"ok"`, `"database":"connected"`, `version` |
| `http://<VPS_IP>:8080/api/backup/status`    | JSON with `scheduled`, `interval_hours`, `last_backup`         |
| `http://<VPS_IP>:8080/`                     | Login page (no freeze on input focus)                          |
| `http://<VPS_IP>:8080/dashboard`            | Admin dashboard after login, footer shows `v0.1.2`             |

Quick curl checks:

```bash
curl -s http://<VPS_IP>:8080/health
curl -s http://<VPS_IP>:8080/api/health | jq
curl -s http://<VPS_IP>:8080/api/backup/status | jq
```

## 4. Backup (v0.1.2)

The backend produces timestamped MariaDB dumps using `mariadb-dump`.

- **Storage path (container)**: `/backups`
- **Storage path (host)**: `./backups` in the project root
- **File naming**: `backup-YYYY-MM-DDTHH-MM-SS-sssZ.sql` (UTC, unique per run)
- **Manual trigger**: `POST /api/backup/run` (button on `/system-health`)
- **Status**: `GET /api/backup/status`
- **Scheduler**: enabled by default, every `BACKUP_INTERVAL_HOURS` hours

Configure via `.env`:

```env
BACKUP_ENABLED=true
BACKUP_INTERVAL_HOURS=24
BACKUP_PATH=/backups
```

### Test commands

```bash
# Trigger a manual backup
curl -s -X POST http://<VPS_IP>:8080/api/backup/run | jq

# Inspect status
curl -s http://<VPS_IP>:8080/api/backup/status | jq

# List backup files on the VPS
ls -lh /opt/bbs-core/backups

# Verify the dump opens cleanly
head -n 20 /opt/bbs-core/backups/backup-*.sql | head
```

### Backup safety rules

- Each run writes a **new timestamped file** (`O_EXCL`) — existing dumps
  are never overwritten.
- The MariaDB data volume (`bbs_db_data`) is **never touched** by the
  backup process; only read via a logical dump.
- Backup files live on the host (`./backups`) and survive container
  rebuilds. Rotate / off-site copy them yourself (rsync, restic, etc.).
- Never run `docker compose down -v`.

## 5. Logs

```bash
docker logs --tail=200 -f bbs-core-backend-1
docker logs --tail=200 -f bbs-core-frontend-1
docker logs --tail=200 -f bbs-core-db-1
```

Backend logs are structured JSON (one event per line). Backup-related
events: `backup_requested`, `backup_started`, `backup_completed`,
`backup_failed`, `backup_scheduler_started`, `backup_scheduler_disabled`.

## 6. Rollback

> Warning: rolling back the frontend / backend image is safe, but the
> MariaDB volume (`bbs_db_data`) is persistent. Never run
> `docker compose down -v` in production — it deletes the database.

Safe rollback to the previous git revision:

```bash
cd /opt/bbs-core
git log --oneline -n 10        # find the previous good commit
git checkout <previous-sha>
docker compose up -d --build
docker ps
curl -s http://<VPS_IP>:8080/api/health | jq
```

If a deploy leaves the stack in a bad state, the fastest recovery is:

```bash
docker compose down
git checkout <last-known-good-sha>
docker compose up -d --build
```

The database volume and `./backups` directory are preserved across all
of the above.

## 7. What's in v0.1.2 (backup-safety)

- Manual backup endpoint `POST /api/backup/run`
- Backup status endpoint `GET /api/backup/status`
- Scheduled backups (default: every 24h, env-configurable)
- Frontend "Biztonsági mentés" panel on `/system-health` with
  "Mentés indítása" button
- `mariadb-client` baked into the backend image
- Host-mounted `./backups:/backups` volume for durable dumps
- Version identity bumped to `v0.1.2` / build `backup-safety`

Carried over from v0.1.1: restart policies, `/health`, `/api/health`,
structured logging, login isolation.
