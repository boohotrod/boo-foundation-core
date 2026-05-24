# BBS Core — Current Status

This file is the single source of truth for "where are we right now?".
Update it whenever a milestone closes or a known issue changes state.

Last updated: 2026-05-24

---

## Repository

- Source: GitHub (`bbs-core`) — single mainline branch.
- Working copy on the VPS: `/opt/bbs-core`
- Deploy method: `git pull` on the VPS followed by `docker compose up -d --build`.

## VPS

- Host: `178.105.46.214` (Hetzner)
- OS: Linux + Docker + Portainer
- Project path: `/opt/bbs-core`
- Compose file: `/opt/bbs-core/docker-compose.yml`
- Persistent paths:
  - `/opt/bbs-core/backups/` — MariaDB dumps
  - Docker named volume for the `db` service — **never `docker compose down -v`**

## Public URLs

- App:                `http://178.105.46.214:8080/`
- Login:              `http://178.105.46.214:8080/login`
- Frontend health:    `http://178.105.46.214:8080/health`
- Backend health:     `http://178.105.46.214:8080/api/health`
- System Status UI:   `http://178.105.46.214:8080/system-health`

## Containers (expected)

| Service    | Image (built locally) | Port (host:container) | Healthcheck                 |
| ---------- | --------------------- | --------------------- | --------------------------- |
| `db`       | `mariadb:11`          | internal only         | `mariadb-admin ping`        |
| `backend`  | `bbs-core-backend`    | internal only         | `GET /api/health` via node  |
| `frontend` | `bbs-core-frontend`   | `8080:80`             | `wget` against nginx        |

All three should report `Up` and (where defined) `healthy` in
`docker compose ps`.

## Current milestone

- **In progress / just shipped:** `v0.2.0 — Real Auth`
  - Backend: bcrypt + JWT, `users` + `failed_login_attempts` tables,
    `/api/login`, `/api/logout`, `/api/me`, `requireAuth` on all `/api/*`
    except `/api/health`.
  - Frontend: real login form, bearer-token API client, `RequireAuth`
    bounces unauthenticated visitors to `/login`.
  - SuperAdmin seeded on first boot from `SUPERADMIN_*` env vars.
- **Not yet gated:** the v0.2.0 checkpoints in `CHECKPOINTS.md` §5 must
  pass on the VPS before this milestone is officially closed.

## Known issues

1. **Placeholder login historically accepted anything.**
   Status: addressed in v0.2.0 (real backend validation, JWT, bcrypt).
   Risk if rolled back to v0.1.x: every credential is accepted again —
   never expose v0.1.x to the public internet without HTTP-basic in front
   of nginx.

2. **Deploy still requires terminal access.**
   `git pull` + `docker compose up -d --build` must be run by hand over
   SSH. There is no in-app deploy yet. This is the target of the v0.2.5
   milestone.

3. **No password-change UI.**
   The SuperAdmin's first-login password must be rotated from the shell
   (see DEPLOYMENT.md §11). A UI flow is out of scope for v0.2.0.

4. **No role/permission system.**
   All authenticated users currently share the same permissions on
   protected endpoints. Real RBAC arrives in v0.3.0.

5. **`docker compose down -v` is destructive.**
   It wipes the DB volume. Documented; not a code fix — operational
   discipline only.

## Next priority

Two candidates, pick **one** and close it before the other:

- **v0.2.5 — Deployment Center MVP** (recommended next)
  Rationale: removes the biggest operational risk (terminal-only deploys)
  and unblocks faster, safer iteration on every later milestone. Read-only
  status view first, action buttons after.

- **v0.3.0 — Roles and Permissions**
  Rationale: only worth doing once there are multiple human operators.
  Until then, the single SuperAdmin model is sufficient and v0.2.5
  produces more value per unit of risk.

**Recommendation:** proceed with **v0.2.5 Deployment Center MVP** next.

## Next safe step

1. Run the v0.2.0 checkpoints (`CHECKPOINTS.md` §5) on the VPS and record
   the results.
2. Rotate the SuperAdmin password away from the documented default.
3. Take a fresh backup (`./scripts/backup-db.sh`) and verify the dump is
   non-empty.
4. Only then open the v0.2.5 milestone scope from `MILESTONES.md`.
