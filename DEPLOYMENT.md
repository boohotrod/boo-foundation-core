# BBS Core — VPS deployment guide (v0.1.1)

Target: Hetzner VPS with Docker + Portainer. System nginx must remain
disabled — the frontend container's nginx serves the SPA on port 8080.

## 1. Prerequisites

- Docker + Docker Compose plugin installed
- Project cloned to the VPS (e.g. `/opt/bbs-core`)
- `.env` file with at minimum `DB_PASSWORD` and `APP_SECRET` set
  (copy from `.env.example`)

## 2. Standard deploy (pull + rebuild)

```bash
cd /opt/bbs-core
git pull
docker compose down
docker compose up -d --build
docker ps
```

All three containers should report `Up` with `restart: unless-stopped`:

- `bbs-core-frontend-1`  → nginx + SPA, port 8080
- `bbs-core-backend-1`   → Node.js API on internal :4000
- `bbs-core-db-1`        → MariaDB 11

## 3. Health verification

Replace `<VPS_IP>` with the server's public IP (e.g. `178.105.46.214`).

| URL                                         | Expected                                                       |
| ------------------------------------------- | -------------------------------------------------------------- |
| `http://<VPS_IP>:8080/health`               | Plain text: `BBS Core Frontend OK / Version: 0.1.1 / ...`       |
| `http://<VPS_IP>:8080/api/health`           | JSON with `"status":"ok"`, `"database":"connected"`, `version` |
| `http://<VPS_IP>:8080/`                     | Login page (no freeze on input focus)                          |
| `http://<VPS_IP>:8080/dashboard`            | Admin dashboard after login, footer shows `v0.1.1`             |

Quick curl checks:

```bash
curl -s http://<VPS_IP>:8080/health
curl -s http://<VPS_IP>:8080/api/health | jq
```

## 4. Logs

```bash
docker logs --tail=200 -f bbs-core-backend-1
docker logs --tail=200 -f bbs-core-frontend-1
docker logs --tail=200 -f bbs-core-db-1
```

Backend logs are structured JSON (one event per line) with events like
`server_starting`, `db_connected`, `db_connect_failed`, `login_attempt`,
`login_failed`, `api_error`, `uncaught_exception`.

## 5. Rollback

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

The database volume is preserved across all of the above.

## 6. What's in v0.1.1 (stabilization pack)

- Restart policy `unless-stopped` on all three services
- `/health` (frontend, plain text) and `/api/health` (backend JSON with DB check)
- Structured backend logging (startup, DB, login, API errors, unhandled errors)
- Version identity surfaced in admin footer + system-health panel
- This `DEPLOYMENT.md`

No functional/UI changes beyond the items above. Login isolation from the
previous emergency fix is preserved.
