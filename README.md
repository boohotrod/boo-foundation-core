# BBS Core v0.2.0

The first stable foundation of the **Boo Base System** — a Docker-deployable
control panel with a React/Vite frontend, a Node.js (Express) backend API, and a
MariaDB database layer.

> Milestone: **v0.1.0** — foundation only. Plugins, system health, settings,
> and rollback-point views are wired end-to-end against the database. Full BBS
> features land in later milestones.

---

## Stack

| Layer    | Tech                             |
| -------- | -------------------------------- |
| Frontend | React 19 + Vite + TanStack Router + Tailwind |
| Backend  | Node.js 20 + Express             |
| Database | MariaDB 11                       |
| Runtime  | Docker + docker-compose          |
| Target   | Hetzner VPS with Docker & Portainer |

No Supabase, no Firebase, no serverless-only functions, no hardcoded secrets.

---

## Repository layout

```
.
├── src/                      # React/Vite frontend (TanStack Router)
│   ├── routes/               # Login, Dashboard, Plugins, System Health, Settings, Rollback Points
│   ├── components/           # AppShell, RequireAuth
│   └── lib/api.ts            # API client
├── backend/                  # Node.js Express API
│   ├── src/index.js          # HTTP server + routes
│   ├── src/db.js             # MariaDB pool + migrations/seed
│   └── Dockerfile
├── docker/
│   └── nginx.conf            # SPA + /api reverse proxy
├── Dockerfile                # Frontend build → nginx runtime
├── docker-compose.yml        # db + backend + frontend
├── .env.example              # Required environment variables
└── README.md
```

---

## Environment variables

Copy `.env.example` to `.env` and edit values. **Never commit `.env`.**

| Variable      | Purpose                                        |
| ------------- | ---------------------------------------------- |
| `DB_HOST`     | MariaDB host (use `db` inside compose network) |
| `DB_PORT`     | MariaDB port (default `3306`)                  |
| `DB_NAME`     | Database name                                  |
| `DB_USER`     | Database user                                  |
| `DB_PASSWORD` | Database password                              |
| `APP_SECRET`  | 32+ character server-side secret for JWT signing |
| `SUPERADMIN_USERNAME` | First login username when `users` is empty |
| `SUPERADMIN_PASSWORD` | First login password when `users` is empty |
| `PORT`        | Backend API port (default `4000`)              |

---

## API

All endpoints are served by the backend container under `/api/*` and proxied
through nginx on the frontend container.

| Method | Path                       | Description                          |
| ------ | -------------------------- | ------------------------------------ |
| GET    | `/api/health`              | Liveness + DB ping                   |
| POST   | `/api/login`               | Real DB-backed login, returns JWT    |
| GET    | `/api/me`                  | Current authenticated user           |
| POST   | `/api/logout`              | Logout acknowledgement               |
| GET    | `/api/system/status`       | CPU / memory / DB / uptime           |
| GET    | `/api/plugins`             | List installed plugins               |
| POST   | `/api/plugins/toggle`      | Toggle a plugin `{ id: number }`     |
| GET    | `/api/settings`            | List `{key, value}` settings         |
| POST   | `/api/settings`            | Upsert `[{key, value}, ...]`         |
| GET    | `/api/rollback-points`     | List rollback snapshots              |

`/api/health` and `/api/login` are public. Other `/api/*` routes require
`Authorization: Bearer <token>`.

The schema is created automatically on first boot (`users`, `plugins`,
`app_settings`, `rollback_points`) and seeded with sample data so the UI is
usable immediately.

---

## Run with Docker

```bash
cp .env.example .env
# edit .env and set strong values
docker compose up -d --build
```

Then open <http://localhost:8080>.

- Frontend (nginx): port `8080`
- Backend (Express): internal `4000`, reached via `/api/*`
- MariaDB: internal `3306`, persistent volume `bbs_db_data`

### Portainer (Hetzner VPS)

1. Add this repo as a **Stack** in Portainer.
2. Provide the environment variables from `.env.example`.
3. Deploy. Expose port `8080` (or put a reverse proxy in front for TLS).

---

## Local development (without Docker)

Terminal 1 — backend:

```bash
cd backend
npm install
DB_HOST=127.0.0.1 DB_PORT=3306 DB_NAME=bbs_core DB_USER=bbs \
DB_PASSWORD=secret APP_SECRET=dev-secret-minimum-32-characters PORT=4000 npm run dev
```

Terminal 2 — frontend (the Lovable preview also uses this):

```bash
npm install
npm run dev
```

Set `VITE_API_BASE_URL=http://localhost:4000/api` if you want the frontend dev
server to talk directly to the backend instead of going through nginx.

---

## Authentication

v0.2.0 ships real backend authentication. Login checks the `users` table,
rejects invalid credentials with `401`, and returns a signed JWT for valid
credentials. The frontend stores only the token and safe user session data.

First boot seeds a SuperAdmin only if the `users` table is empty:

- Username: `SUPERADMIN_USERNAME` (default `superadmin`)
- Password: `SUPERADMIN_PASSWORD` (default `ChangeMe!Admin123`)

Change the default password immediately after first login.

---

## Roadmap

- v0.2.0 — Server-side auth, RBAC, audit log
- v0.3.0 — Plugin runtime + dynamic loader
- v0.4.0 — Real rollback/restore engine
- v1.0.0 — Production hardening
