import express from "express";
import cors from "cors";
import os from "os";
import { config, validateEnvironment } from "./config.js";
import { logger, requestLogger } from "./logger.js";
import { ApiError, asyncHandler, errorHandler } from "./errors.js";
import { query, ping, migrateAndSeed } from "./db.js";
import { runBackup, getBackupStatus, startScheduler } from "./backup.js";

const startedAt = Date.now();
const log = logger.child("server");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger());

// ── Health ──────────────────────────────────────────────────────────────────
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

// ── System status ───────────────────────────────────────────────────────────
app.get(
  "/api/system/status",
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

// ── Login (placeholder, logs failed attempts) ───────────────────────────────
app.post("/api/login", (req, res, next) => {
  try {
    const username = String(req.body?.username || "");
    if (!username) {
      logger.warn("auth", "login_failed", { reason: "missing_username" });
      throw new ApiError("username required", 400, "bad_request");
    }
    logger.info("auth", "login_attempt", { username });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Backup ──────────────────────────────────────────────────────────────────
app.post(
  "/api/backup/run",
  asyncHandler(async (_req, res) => {
    logger.info("backup", "requested", { trigger: "manual" });
    const result = await runBackup({
      trigger: "manual",
      logger: (level, event, extra) => logger[level]?.("backup", event, extra),
    });
    res.status(result.status === "ok" ? 200 : 500).json(result);
  }),
);

app.get("/api/backup/status", (_req, res) => {
  res.json(getBackupStatus());
});

// ── Plugins ─────────────────────────────────────────────────────────────────
app.get(
  "/api/plugins",
  asyncHandler(async (_req, res) => {
    const rows = await query(
      "SELECT id, name, description, version, enabled FROM plugins ORDER BY id",
    );
    res.json(rows.map((r) => ({ ...r, enabled: !!r.enabled })));
  }),
);

app.post(
  "/api/plugins/toggle",
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

// ── Settings ────────────────────────────────────────────────────────────────
app.get(
  "/api/settings",
  asyncHandler(async (_req, res) => {
    const rows = await query("SELECT `key`, value FROM app_settings ORDER BY `key`");
    res.json(rows);
  }),
);

app.post(
  "/api/settings",
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

// ── Rollback points ─────────────────────────────────────────────────────────
app.get(
  "/api/rollback-points",
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

// ── Process-level safety net ───────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  logger.error("process", "uncaught_exception", { message: err?.message, stack: err?.stack });
});
process.on("unhandledRejection", (reason) => {
  logger.error("process", "unhandled_rejection", { reason: String(reason) });
});

// ── Boot ────────────────────────────────────────────────────────────────────
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
    log.error("startup_aborted", {
      reason: "invalid_environment",
      hint: "Fix the env errors above; the process will exit instead of restart-looping.",
    });
    // Slow exit so Docker doesn't hot-loop. Container should be marked unhealthy.
    setTimeout(() => process.exit(1), 5000);
    return;
  }
  log.info("env_validated");

  let dbReady = false;
  for (let i = 0; i < 30; i++) {
    if (await ping()) {
      dbReady = true;
      break;
    }
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

  app.listen(config.app.port, () => {
    log.info("server_started", { port: config.app.port });
    startScheduler((level, event, extra) => logger[level]?.("backup", event, extra));
  });
}

boot();
