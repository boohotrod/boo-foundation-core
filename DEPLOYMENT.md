# BBS Core — Deployment & Operations Guide

**Version:** v0.1.2
**Build:** production-foundation
**Target:** Hetzner VPS, Docker + Portainer
**Containers:** `bbs_db`, `bbs_backend`, `bbs_frontend`

---

## 1. Initial deploy

```bash
cd /opt/bbs-core
git pull
cp .env.example .env   # first time only — set DB_PASSWORD and APP_SECRET
docker compose up -d --build
docker compose ps
```

Expected `docker compose ps` after ~60s:

| NAME           | STATUS                       |
|----------------|------------------------------|
| `bbs_db`       | `Up (healthy)`               |
| `bbs_backend`  | `Up (healthy)`               |
| `bbs_frontend` | `Up (healthy)`               |

---

## 2. Update / rebuild

```bash
cd /opt/bbs-core
git pull

# Rebuild only what changed:
docker compose up -d --build backend     # backend code change
docker compose up -d --build frontend    # frontend or nginx change
docker compose up -d --build             # everything
```

Frontend changes go live the moment the new container is healthy. Browsers
that already have `index.html` cached will pick up the new build on next
navigation (we send `Cache-Control: no-store` for `index.html`).

---

## 3. Healthchecks

Endpoints:

```bash
# Frontend nginx
curl -s http://178.105.46.214:8080/health

# Backend API + DB
curl -s http://178.105.46.214:8080/api/health | jq

# Backup status
curl -s http://178.105.46.214:8080/api/backup/status | jq
```

Container health:

```bash
docker compose ps
docker inspect --format '{{.State.Health.Status}}' bbs_backend
docker inspect --format '{{.State.Health.Status}}' bbs_frontend
docker inspect --format '{{.State.Health.Status}}' bbs_db
```

Possible values: `starting`, `healthy`, `unhealthy`. `unhealthy` containers
keep running; investigate via logs (see §5).

---

## 4. Database backups

Backups are timestamped `.sql` files in `./backups/` on the host (mounted
to `/backups` inside the backend container).

### Manual backup

```bash
./scripts/backup-db.sh
ls -lh backups/
```

Filename pattern: `bbs-<DB_NAME>-v<VERSION>-<UTC_TIMESTAMP>.sql`
Example: `bbs-bbs_core-v0.1.2-2026-05-24T20-15-00Z.sql`

You can also trigger via API:

```bash
curl -X POST http://178.105.46.214:8080/api/backup/run
```

### Restore — DESTRUCTIVE

> **WARNING:** restoring OVERWRITES the current database. Always take a
> fresh backup first.

```bash
./scripts/backup-db.sh                                   # safety net
./scripts/restore-db.sh backups/<backup-file>.sql        # type RESTORE to confirm
```

### Backup retention

Manual for now. Suggested:

```bash
# Keep the 20 newest backups; delete older
ls -1t backups/*.sql | tail -n +21 | xargs -r rm --
```

> **Never** run `docker compose down -v` — the `-v` flag deletes the
> `bbs_db_data` volume and all customer data with it.

---

## 5. Logs & inspection

```bash
# Tail logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db

# Last 200 lines, all services
docker compose logs --tail=200

# Filter backend logs by level (logs are JSON, one entry per line)
docker compose logs backend | grep '"level":"error"'

# Inspect a container
docker inspect bbs_backend | less
```

---

## 6. Rollback

### A. Code rollback (most common)

```bash
cd /opt/bbs-core
git log --oneline -10
git revert <bad-sha> --no-edit
docker compose up -d --build
docker compose ps
```

### B. Last-resort: pin to a previous commit

```bash
git checkout <good-sha>
docker compose up -d --build
# When stable, fast-forward main on the build host.
```

### C. Database rollback

```bash
./scripts/restore-db.sh backups/<known-good>.sql
```

---

## 7. Failed deploy recovery

If the new build is broken or a container is `unhealthy`:

```bash
# 1. Check what's failing
docker compose ps
docker compose logs --tail=200 backend
docker compose logs --tail=200 frontend

# 2. Restart the affected service
docker compose restart backend
# or hard restart of everything
docker compose down && docker compose up -d

# 3. If still broken, roll the code back (see §6)

# 4. If the DB itself is wedged
docker compose restart db
```

---

## 8. Emergency restart

```bash
# Single container (no rebuild)
docker compose restart backend

# Whole stack (no rebuild, no data loss)
docker compose down && docker compose up -d

# Full rebuild from source
docker compose down && docker compose up -d --build
```

`docker compose down` (without `-v`) is safe — it stops and removes
containers but keeps the named volume `bbs_db_data`.

---

## 9. Required environment variables

Set in `.env` next to `docker-compose.yml`:

| Variable                | Required | Default               | Notes                                  |
|-------------------------|----------|-----------------------|----------------------------------------|
| `DB_PASSWORD`           | yes      | —                     | MariaDB user password                  |
| `APP_SECRET`            | yes      | —                     | App secret, used by v0.2.0+ auth       |
| `DB_HOST`               | no       | `db`                  | Compose service name                   |
| `DB_PORT`               | no       | `3306`                |                                        |
| `DB_NAME`               | no       | `bbs_core`            |                                        |
| `DB_USER`               | no       | `bbs`                 |                                        |
| `PORT`                  | no       | `4000`                | Backend listen port                    |
| `LOG_LEVEL`             | no       | `info`                | `debug` / `info` / `warn` / `error`    |
| `BACKUP_ENABLED`        | no       | `true`                | Scheduler on/off                       |
| `BACKUP_INTERVAL_HOURS` | no       | `24`                  | Min 1                                  |
| `BACKUP_PATH`           | no       | `/backups`            | Inside backend container               |

---

## 10. Common URLs

- App:               `http://178.105.46.214:8080/`
- Frontend health:   `http://178.105.46.214:8080/health`
- Backend health:    `http://178.105.46.214:8080/api/health`
- System status:     `http://178.105.46.214:8080/api/system/status`
- Backup status:     `http://178.105.46.214:8080/api/backup/status`
- System Status UI:  `http://178.105.46.214:8080/system-health`

---

## 11. v0.2.0 — Real Authentication

The placeholder login is replaced with backend-validated auth (bcrypt + JWT).

### First-login credentials

On the very first boot, if the `users` table is empty, BBS Core seeds a
SuperAdmin from these env vars (defaults shown):

| Variable               | Default                |
| ---------------------- | ---------------------- |
| `SUPERADMIN_USERNAME`  | `superadmin`           |
| `SUPERADMIN_EMAIL`     | `admin@bbs.local`      |
| `SUPERADMIN_PASSWORD`  | `ChangeMe!Admin123`    |

**Change the password immediately after first login.** Subsequent boots do
not re-seed and do not overwrite an existing user.

### Required ENV

- `APP_SECRET` is now **required** (>=32 chars). It signs JWT auth tokens.
  Rotating it invalidates every active session.
- Optional: `JWT_EXPIRES_IN` (default `7d`), `BCRYPT_ROUNDS` (default `10`).

### Auth endpoints

| Method | Path           | Auth | Purpose                                 |
| ------ | -------------- | ---- | --------------------------------------- |
| POST   | `/api/login`   | no   | `{username|email, password}` → `{token, user}` |
| POST   | `/api/logout`  | no   | Stateless ack; client discards token    |
| GET    | `/api/me`      | yes  | Current user from bearer token          |

All other `/api/*` endpoints (plugins, settings, backup, system status,
rollback-points) now require `Authorization: Bearer <token>`.
`/api/health` stays public for Docker healthchecks.

### Test commands

```bash
# 1. Login as SuperAdmin (use the values you set in .env)
TOKEN=$(curl -s -X POST http://178.105.46.214:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"ChangeMe!Admin123"}' | jq -r .token)
echo "$TOKEN"

# 2. Wrong password → 401 + Hungarian error
curl -s -X POST http://178.105.46.214:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"wrong"}' | jq

# 3. Protected endpoint without token → 401
curl -s http://178.105.46.214:8080/api/plugins | jq

# 4. Protected endpoint with token → 200
curl -s http://178.105.46.214:8080/api/plugins \
  -H "Authorization: Bearer $TOKEN" | jq

# 5. Current user
curl -s http://178.105.46.214:8080/api/me \
  -H "Authorization: Bearer $TOKEN" | jq

# 6. Failed login audit log
docker compose exec -T db mariadb -ubbs -p"$DB_PASSWORD" bbs_core \
  -e "SELECT login, ip, reason, attempted_at FROM failed_login_attempts ORDER BY id DESC LIMIT 10;"
```

### Deploy

```bash
cd /opt/bbs-core
git pull
docker compose up -d --build backend frontend
docker compose logs backend --tail=50
```

Expect `superadmin_created` in the logs on the very first boot only.

### Rollback

```bash
git log --oneline -5
git revert HEAD --no-edit
docker compose up -d --build backend frontend
```

The `users` and `failed_login_attempts` tables remain (safe to keep — they
are simply unused by v0.1.x).
