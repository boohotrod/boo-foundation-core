# BBS Core — Milestones

Every major development phase has a goal, a scope fence, mandatory tests, and
a rollback plan. **No milestone is considered "done" until its success
criteria are verifiable on the VPS.** Do not start the next milestone until
the current one is closed.

Order is strict — do not skip ahead. If a milestone cannot be closed, fix
the gap before moving on, or formally downgrade the scope in this document.

---

## v0.1.0 — Initial production boot

**Goal:** Get the stack running end-to-end on the VPS: MariaDB + Express
backend + nginx-served frontend, reachable on `:8080`.

**Allowed work**
- Initial Docker Compose stack (db, backend, frontend).
- Minimal `/api/health` endpoint.
- Static frontend served by nginx with SPA fallback.
- Placeholder login (localStorage only — explicitly temporary).

**Forbidden work**
- Any real authentication or RBAC.
- Plugins, AI builder, multi-tenant, payments.
- UI redesigns or animation libraries.

**Required tests**
- `docker compose ps` — all three containers `Up`.
- `curl http://VPS:8080/` returns the SPA index.
- `curl http://VPS:8080/api/health` returns JSON `{status:"ok"}`.

**Success criteria**
- Stack survives a `docker compose down && up -d` cycle.
- Frontend reachable, backend healthy, DB reachable from backend.

**Rollback plan**
- `git revert` the boot commit and `docker compose up -d --build`.
- DB volume retained — no destructive operations in this milestone.

---

## v0.1.1 — Stabilization

**Goal:** Eliminate the boot crashes, login freeze, and 404 noise that
appeared after the initial boot. No new features.

**Allowed work**
- Bugfixes to login isolation (StandaloneLogin outside the router).
- nginx SPA fallback fixes.
- Defensive error pages (404 / error boundary) in Hungarian.
- Minor logging additions.

**Forbidden work**
- Real auth.
- Backend schema changes beyond fixes.
- Any UI redesign.

**Required tests**
- Type into username/password without browser freeze.
- Hard-reload `/dashboard`, `/plugins`, `/system-health` — no white screen.
- Unknown route → branded 404, not nginx default.

**Success criteria**
- No reproducible freeze on `/login`.
- All known routes load cleanly after a hard refresh.

**Rollback plan**
- `git revert` the stabilization commits; previous v0.1.0 image still boots.

---

## v0.1.2 — Production Foundation

**Goal:** Make the deployment recoverable and observable: ENV validation,
structured logs, unified errors, Docker healthchecks, nginx hardening,
backup scripts, deployment docs.

**Allowed work**
- Backend: central config, structured JSON logger, ApiError + errorHandler.
- Infra: Docker healthchecks, nginx gzip + security headers + caching.
- Backups: `scripts/backup-db.sh`, `scripts/restore-db.sh`, scheduled dumps.
- Docs: DEPLOYMENT.md hardening.
- Minimal frontend touch-ups: System Status page, version labels, safe auth
  guard. **No redesigns.**

**Forbidden work**
- Real authentication (deferred to v0.2.0).
- Plugin manager, AI Builder, tenant system.
- UI redesign, animations, heavy visual effects.

**Required tests**
- `docker compose ps` — all services `healthy`.
- `curl /api/health` returns JSON with `version: "0.1.2"`,
  `build: "production-foundation"`.
- `./scripts/backup-db.sh` produces a timestamped dump in `/backups/`.
- Stopping the backend → `/system-health` shows "leállt" without crashing UI.

**Success criteria**
- A full `docker compose down && up -d --build` cycle restores a healthy
  stack with no manual intervention.
- A DB dump can be produced and inspected.

**Rollback plan**
- `git revert HEAD --no-edit && docker compose up -d --build`.
- Backups remain on disk; no schema-destructive changes were made.

---

## v0.2.0 — Real Auth

**Goal:** Replace placeholder login with backend-validated authentication.

**Allowed work**
- `users` + `failed_login_attempts` tables.
- bcrypt password hashing, JWT sessions signed with `APP_SECRET`.
- `POST /api/login`, `POST /api/logout`, `GET /api/me`.
- `requireAuth` middleware on all `/api/*` except `/api/health`.
- SuperAdmin seed on first boot (env-configurable).
- Frontend: real login form, bearer-token client, 401 → forced re-login.
- Disable self-registration (admin-created users only).

**Forbidden work**
- Roles / permissions UI (deferred to v0.3.0).
- Password-reset email flow.
- OAuth / SSO.
- Any UI redesign of the login page (must stay isolated and minimal).
- Re-introducing AppShell on `/login`.

**Required tests**
- Correct credentials → 200 + token; wrong credentials → 401 with Hungarian
  error.
- Protected endpoint without token → 401; with token → 200.
- `failed_login_attempts` row appears for each rejected login.
- Logout clears localStorage and bounces to `/login`.
- Login page still does not freeze while typing.

**Success criteria**
- No way to reach `/dashboard` without a valid backend-issued token.
- SuperAdmin can log in on a clean DB using documented credentials.

**Rollback plan**
- `git revert HEAD --no-edit && docker compose up -d --build`.
- `users` and `failed_login_attempts` tables remain (harmless to v0.1.x).

---

## v0.2.5 — Deployment Center MVP

**Goal:** Replace terminal-only deploys with a minimal in-app deployment
view. Read-only first, action buttons only after the read-only view is
trusted.

**Allowed work**
- Backend endpoints (auth-protected): `GET /api/deploy/status` (current
  commit, image tags, container health, last deploy timestamp).
- Optional: `POST /api/deploy/pull` and `POST /api/deploy/rebuild` behind
  SuperAdmin role and a confirmation flow. Each action shells out to a
  whitelisted script with no user-controlled arguments.
- Frontend: `/deploy` page in AppShell showing read-only status; action
  buttons gated behind explicit confirmation.
- Audit log table `deploy_events` (who, what, when, exit code).

**Forbidden work**
- Arbitrary command execution.
- Editing `docker-compose.yml` or `.env` from the UI.
- Plugin manager, AI builder, multi-tenant.
- Any UI redesign outside the new page.

**Required tests**
- Unauthenticated → 401 on every `/api/deploy/*`.
- Non-SuperAdmin → 403 on action endpoints.
- `GET /api/deploy/status` returns truthful container + commit info.
- Triggering rebuild from UI produces a `deploy_events` row and an updated
  container; failure path leaves a row with the non-zero exit code.

**Success criteria**
- A routine deploy (pull + rebuild) is doable from the UI by a SuperAdmin
  without opening a terminal.
- Read-only deploy status is visible to any authenticated user.

**Rollback plan**
- Action endpoints can be disabled with `DEPLOY_ACTIONS_ENABLED=false`
  without removing the page.
- `git revert` returns to v0.2.0; tables remain.

---

## v0.3.0 — Roles and Permissions

**Goal:** Replace the single `role` string with a real RBAC model so
features can be gated per user.

**Allowed work**
- Tables: `roles`, `permissions`, `role_permissions`, `user_roles`.
- Seed roles: `superadmin`, `admin`, `operator`, `viewer`.
- Backend: `requirePermission("...")` middleware; replace ad-hoc role
  checks with permission checks.
- Frontend: hide/disable controls the current user lacks permission for.
- Admin UI to assign roles to users (SuperAdmin only).

**Forbidden work**
- Public registration.
- Per-row ACLs (out of scope for v0.3.x).
- Multi-tenant scoping (separate milestone).

**Required tests**
- Operator cannot reach SuperAdmin-only endpoints (403).
- Removing a permission removes the UI control on next refresh.
- SuperAdmin can promote/demote users; demoted users immediately lose
  access on next request (token still valid, permission check fails).

**Success criteria**
- Every protected endpoint declares a permission; no endpoint relies on a
  bare `role === "..."` check.
- Role/permission seed is idempotent across deploys.

**Rollback plan**
- `git revert` to v0.2.5; v0.2.x continues to honor the legacy `role`
  column, which is preserved (not dropped) in v0.3.0.
