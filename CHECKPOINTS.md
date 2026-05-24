# BBS Core — Mandatory Checkpoints

These checkpoints are **gates**, not suggestions. After any of the actions
below, run the corresponding checks before doing anything else. If a check
fails, **stop immediately** and either fix forward or roll back — do not
layer a new change on top of an unverified system.

Conventions:
- `VPS` = `178.105.46.214` (replace with your host).
- All `curl` commands target `http://VPS:8080` unless stated otherwise.
- "Stop immediately" means: do not commit further changes, do not deploy
  again, open the rollback section of the relevant milestone.

---

## 1. After a GitHub update (`git pull` on the VPS)

**What to test**
- The working tree matches the remote.
- No local modifications were silently overwritten.

**Commands**
```bash
cd /opt/bbs-core
git status
git log --oneline -5
```

**Expected result**
- `git status` reports a clean working tree.
- The newest commit on `git log` matches what was just pushed.

**Stop immediately if**
- `git status` shows unexpected modified files.
- `git pull` reports a merge conflict.
- The latest commit hash on the VPS does not match the one pushed.

---

## 2. After a Docker rebuild (`docker compose up -d --build`)

**What to test**
- All containers came back up and report healthy.
- No container is in a restart loop.

**Commands**
```bash
docker compose ps
docker compose logs --tail=80 backend
docker compose logs --tail=40 frontend
docker compose logs --tail=40 db
```

**Expected result**
- `docker compose ps` shows every service as `Up` and (where defined)
  `healthy`.
- Backend log ends with `server_started` (or equivalent) and not a stack
  trace.
- No `Restarting (1)` or repeated `exit 1` lines.

**Stop immediately if**
- Any container is `Restarting`, `Exited`, or `unhealthy`.
- Backend log contains `env_invalid`, `startup_aborted`, or an unhandled
  exception.

---

## 3. After a backend change

**What to test**
- `/api/health` returns JSON with the expected version + build.
- A known protected endpoint still behaves correctly with and without a
  token.
- Logs are still structured JSON, not raw stack traces.

**Commands**
```bash
curl -s http://VPS:8080/api/health | jq
curl -s http://VPS:8080/api/plugins | jq            # expect 401 from v0.2.0
TOKEN=...                                            # obtain via /api/login
curl -s -H "Authorization: Bearer $TOKEN" \
  http://VPS:8080/api/plugins | jq
docker compose logs backend --tail=40
```

**Expected result**
- `version` and `build` match the milestone you intended to ship.
- Protected endpoints return 401 without a token and 200 with one.
- Logs contain `level`, `module`, `action` fields — no HTML, no raw stack
  traces leaking into the response body.

**Stop immediately if**
- `/api/health` returns 5xx or HTML.
- A previously protected endpoint now responds 200 without a token.
- Logs spam `uncaught_exception` or `unhandled_rejection`.

---

## 4. After a frontend change

**What to test**
- App loads on a hard refresh.
- Login page does not freeze while typing.
- Auth gate still bounces unauthenticated users to `/login`.

**Commands / URLs**
- `http://VPS:8080/` — should render.
- `http://VPS:8080/login` — must accept keystrokes immediately, with no
  delay or focus loss.
- Clear `localStorage.bbs_session` in devtools, then visit
  `http://VPS:8080/dashboard` — must redirect to `/login`.
- Browser devtools: Network tab shows no 404s on `/assets/*`, no CORS
  errors, no mixed-content warnings.

**Expected result**
- All three URLs render their intended page.
- Footer/sidebar version label matches the milestone (`v0.2.0`,
  `real-auth`, etc.).

**Stop immediately if**
- Login page freezes, drops keystrokes, or steals focus.
- `/dashboard` renders content without a valid session.
- AppShell renders on `/login`.
- White screen on any known route after a hard reload.

---

## 5. After an auth change

**What to test**
- Wrong credentials → 401 + readable Hungarian error.
- Correct credentials → token issued, dashboard reachable.
- Failed attempts are recorded.
- Logout invalidates the client session.

**Commands**
```bash
# wrong password
curl -s -X POST http://VPS:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"definitely-wrong"}' | jq

# correct password
TOKEN=$(curl -s -X POST http://VPS:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"<actual>"}' | jq -r .token)
echo "$TOKEN" | head -c 40; echo …

# protected endpoint with token
curl -s -H "Authorization: Bearer $TOKEN" \
  http://VPS:8080/api/me | jq

# failed attempts audit
docker compose exec -T db mariadb -ubbs -p"$DB_PASSWORD" bbs_core \
  -e "SELECT login, ip, reason, attempted_at \
      FROM failed_login_attempts ORDER BY id DESC LIMIT 5;"
```

**Expected result**
- Wrong password → HTTP 401, JSON body with `"Hibás felhasználónév vagy
  jelszó."`.
- Correct password → HTTP 200 with a non-empty `token`.
- `/api/me` returns the SuperAdmin record.
- `failed_login_attempts` contains a row for the wrong-password attempt.

**Stop immediately if**
- Wrong credentials are ever accepted (200 + token).
- The login response leaks a stack trace or a database error string.
- `/api/me` returns 200 with an empty or bogus token.
- `APP_SECRET` rotation does not invalidate old tokens (it must).

---

## 6. After an nginx or Docker change

**What to test**
- Frontend still serves on `:8080`.
- `/api` is still proxied to backend.
- SPA fallback still works for deep links.
- Healthchecks still pass.

**Commands**
```bash
docker compose ps
curl -I http://VPS:8080/                  # 200 text/html
curl -I http://VPS:8080/dashboard         # 200 text/html (SPA fallback)
curl -s http://VPS:8080/health            # frontend health, if exposed
curl -s http://VPS:8080/api/health | jq   # backend health via proxy
docker compose logs frontend --tail=40
```

**Expected result**
- `/` and any deep link return `200` with `Content-Type: text/html`.
- `/api/health` returns JSON (proxy working).
- `docker compose ps` shows `healthy` for frontend and backend.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`) still appear on `curl -I`.

**Stop immediately if**
- `/api/*` returns the SPA HTML (proxy is misrouted — this is the
  classic "Hiba: <!DOCTYPE html>" symptom).
- Deep links return 404 instead of the SPA shell.
- `docker compose ps` reports `unhealthy` after the change.
- Security headers disappear.

---

## 7. After a database change (migration, seed, or schema edit)

**What to test**
- The schema is what you expected.
- Migrations are idempotent (re-running the backend does not error).
- Existing rows are intact (no silent truncation).
- A fresh backup can be produced after the change.

**Commands**
```bash
docker compose exec -T db mariadb -ubbs -p"$DB_PASSWORD" bbs_core \
  -e "SHOW TABLES;"
docker compose exec -T db mariadb -ubbs -p"$DB_PASSWORD" bbs_core \
  -e "DESCRIBE users; DESCRIBE failed_login_attempts;"
docker compose restart backend
docker compose logs backend --tail=40 | grep -E 'db_schema_ready|migration'
./scripts/backup-db.sh
ls -lh backups/ | tail -5
```

**Expected result**
- `SHOW TABLES` lists every expected table, including any newly added
  ones.
- Backend log shows `db_schema_ready` after restart (no
  `db_migration_failed`).
- `backups/` contains a new timestamped `.sql` dump.

**Stop immediately if**
- A migration fails on restart.
- Row counts on a touched table dropped unexpectedly:
  ```bash
  docker compose exec -T db mariadb -ubbs -p"$DB_PASSWORD" bbs_core \
    -e "SELECT COUNT(*) FROM users;"
  ```
- The backup script fails or produces a 0-byte file.

**Never** run `docker compose down -v` — that wipes the DB volume. If a
restore is required, follow `scripts/restore-db.sh` against a copy first.
