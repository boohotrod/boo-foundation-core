import express from "express";
import cors from "cors";
import os from "os";
import { config, validateEnvironment } from "./config.js";
import { logger, requestLogger } from "./logger.js";
import { ApiError, asyncHandler, errorHandler } from "./errors.js";
import { query, ping, migrateAndSeed } from "./db.js";
import { runBackup, getBackupStatus, startScheduler } from "./backup.js";
import {
  ensureSuperAdmin,
  findUserByLogin,
  verifyPassword,
  signToken,
  updateLastLogin,
  recordFailedLogin,
  requireAuth,
} from "./auth.js";

const startedAt = Date.now();
const log = logger.child("server");

const app = express();
app.set("trust proxy", true);
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger());

// ── Health (public) ─────────────────────────────────────────────────────────
app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    const db = await ping();
    res.status(db ? 200 : 503).json({
      status: db ? "ok" : "error",
      service: "backend",
      version: config.app.version,
      build: config.app.build,
      environment: config.app.environment,
      database: db ? "connected" : "disconnected",
      uptime: (Date.now() - startedAt) / 1000,
      timestamp: new Date().toISOString(),
    });
  }),
);

// ── Auth: login / logout / me ──────────────────────────────────────────────
app.post(
  "/api/login",
  asyncHandler(async (req, res) => {
    const login = String(req.body?.username || req.body?.email || "").trim();
    const password = String(req.body?.password || "");
    const ip = req.ip || req.headers["x-forwarded-for"] || "";

    if (!login || !password) {
      await recordFailedLogin({ login, ip, reason: "missing_credentials" });
      logger.warn("auth", "login_failed", { login, reason: "missing_credentials" });
      throw new ApiError("Add meg a felhasználónevet és a jelszót.", 400, "bad_request");
    }

    const user = await findUserByLogin(login);
    if (!user) {
      await recordFailedLogin({ login, ip, reason: "user_not_found" });
      logger.warn("auth", "login_failed", { login, reason: "user_not_found" });
      throw new ApiError("Hibás felhasználónév vagy jelszó.", 401, "invalid_credentials");
    }
    if (user.disabled) {
      await recordFailedLogin({ login, ip, reason: "user_disabled" });
      logger.warn("auth", "login_failed", { login, reason: "user_disabled" });
      throw new ApiError("A felhasználói fiók le van tiltva.", 403, "user_disabled");
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      await recordFailedLogin({ login, ip, reason: "bad_password" });
      logger.warn("auth", "login_failed", { login, reason: "bad_password" });
      throw new ApiError("Hibás felhasználónév vagy jelszó.", 401, "invalid_credentials");
    }

    const token = signToken(user);
    await updateLastLogin(user.id);
    logger.info("auth", "login_success", { user_id: user.id, username: user.username });

    res.json({
      ok: true,
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  }),
);

// JWT is stateless — logout is a client-side token discard. Endpoint exists
// for symmetry and future server-side revocation lists.
app.post("/api/logout", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, asyncHandler(async (req, res) => {
  const rows = await query(
    "SELECT id, username, email, role, last_login_at, created_at FROM users WHERE id = ? LIMIT 1",
    [req.user.id],
  );
  if (!rows[0]) throw new ApiError("Felhasználó nem található.", 404, "not_found");
  res.json(rows[0]);
}));

// ── System status (protected) ───────────────────────────────────────────────
app.get(
  "/api/system/status",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const db = await ping();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const load = os.loadavg()[0];
    const cpuCount = os.cpus().length || 1;
    res.json({
      cpu: Math.min(100, (load / cpuCount) * 100),
      memory: { used: totalMem - freeMem, total: totalMem },
      disk: { used: 0, total: 0 },
      database: db ? "connected" : "disconnected",
      uptime: (Date.now() - startedAt) / 1000,
      version: config.app.version,
      build: config.app.build,
      environment: config.app.environment,
    });
  }),
);

// ── Backup (protected) ──────────────────────────────────────────────────────
app.post(
  "/api/backup/run",
  requireAuth,
  asyncHandler(async (req, res) => {
    logger.info("backup", "requested", { trigger: "manual", user_id: req.user.id });
    const result = await runBackup({
      trigger: "manual",
      logger: (level, event, extra) => logger[level]?.("backup", event, extra),
    });
    res.status(result.status === "ok" ? 200 : 500).json(result);
  }),
);

app.get("/api/backup/status", requireAuth, (_req, res) => {
  res.json(getBackupStatus());
});

// ── Plugins (protected) ─────────────────────────────────────────────────────
app.get(
  "/api/plugins",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await query(
      "SELECT id, name, description, version, enabled FROM plugins ORDER BY id",
    );
    res.json(rows.map((r) => ({ ...r, enabled: !!r.enabled })));
  }),
);

app.post(
  "/api/plugins/toggle",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError("Valid plugin id is required.", 400, "bad_request");
    }
    const [existing] = await query("SELECT id, enabled FROM plugins WHERE id = ?", [id]);
    if (!existing) throw new ApiError("Plugin not found.", 404, "not_found");
    const next = existing.enabled ? 0 : 1;
    await query("UPDATE plugins SET enabled = ? WHERE id = ?", [next, id]);
    const [updated] = await query(
      "SELECT id, name, description, version, enabled FROM plugins WHERE id = ?",
      [id],
    );
    res.json({ ...updated, enabled: !!updated.enabled });
  }),
);

// ── Settings (protected) ────────────────────────────────────────────────────
app.get(
  "/api/settings",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await query("SELECT `key`, value FROM app_settings ORDER BY `key`");
    res.json(rows);
  }),
);

app.post(
  "/api/settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = Array.isArray(req.body) ? req.body : [];
    for (const item of payload) {
      if (!item || typeof item.key !== "string" || typeof item.value !== "string") {
        throw new ApiError("Each setting requires {key, value}.", 400, "bad_request");
      }
      if (item.key.length > 128 || item.value.length > 4096) {
        throw new ApiError("Setting too large.", 400, "bad_request");
      }
      await query(
        "INSERT INTO app_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
        [item.key, item.value],
      );
    }
    const rows = await query("SELECT `key`, value FROM app_settings ORDER BY `key`");
    res.json(rows);
  }),
);

// ── Rollback points (protected) ─────────────────────────────────────────────
app.get(
  "/api/rollback-points",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await query(
      "SELECT id, label, size_bytes, created_at FROM rollback_points ORDER BY created_at DESC",
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        label: r.label,
        size_bytes: Number(r.size_bytes),
        created_at:
          r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      })),
    );
  }),
);

// ── 404 + error handler ─────────────────────────────────────────────────────
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found", code: "not_found" });
});
app.use(errorHandler);

process.on("uncaughtException", (err) => {
  logger.error("process", "uncaught_exception", { message: err?.message, stack: err?.stack });
});
process.on("unhandledRejection", (reason) => {
  logger.error("process", "unhandled_rejection", { reason: String(reason) });
});

async function boot() {
  log.info("server_starting", {
    port: config.app.port,
    version: config.app.version,
    build: config.app.build,
    environment: config.app.environment,
  });

  const env = validateEnvironment();
  for (const w of env.warnings) log.warn("env_warning", { message: w });
  if (!env.ok) {
    for (const e of env.errors) log.error("env_invalid", { message: e });
    log.error("startup_aborted", { reason: "invalid_environment" });
    setTimeout(() => process.exit(1), 5000);
    return;
  }
  log.info("env_validated");

  let dbReady = false;
  for (let i = 0; i < 30; i++) {
    if (await ping()) { dbReady = true; break; }
    log.warn("db_waiting", { attempt: i + 1 });
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (dbReady) log.info("db_connected");
  else log.error("db_connect_failed", { attempts: 30 });

  try {
    await migrateAndSeed();
    log.info("db_schema_ready");
  } catch (e) {
    log.error("db_migration_failed", { message: e?.message, stack: e?.stack });
  }

  try {
    const seed = await ensureSuperAdmin();
    if (seed.created) log.info("superadmin_created", { username: seed.username });
  } catch (e) {
    log.error("superadmin_seed_failed", { message: e?.message });
  }

  app.listen(config.app.port, () => {
    log.info("server_started", { port: config.app.port });
    startScheduler((level, event, extra) => logger[level]?.("backup", event, extra));
  });
}

boot();
