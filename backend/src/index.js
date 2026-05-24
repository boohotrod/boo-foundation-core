import express from "express";
import cors from "cors";
import morgan from "morgan";
import os from "os";
import { query, ping, migrateAndSeed } from "./db.js";
import { runBackup, getBackupStatus, startScheduler } from "./backup.js";

const PORT = Number(process.env.PORT || 4000);
const APP_VERSION = "0.1.2";
const APP_BUILD = "backup-safety";
const APP_ENV = process.env.NODE_ENV || "production";
const startedAt = Date.now();

// ── Structured logger ──────────────────────────────────────────────────────
function log(level, event, extra = {}) {
  const entry = {
    level,
    event,
    service: "backend",
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    ...extra,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else console.log(line);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

// ── Health ──────────────────────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  const db = await ping();
  res.status(db ? 200 : 503).json({
    status: db ? "ok" : "error",
    service: "backend",
    version: APP_VERSION,
    build: APP_BUILD,
    environment: APP_ENV,
    database: db ? "connected" : "disconnected",
    uptime: (Date.now() - startedAt) / 1000,
    timestamp: new Date().toISOString(),
  });
});

// ── System status ───────────────────────────────────────────────────────────
app.get("/api/system/status", async (_req, res) => {
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
    version: APP_VERSION,
    build: APP_BUILD,
    environment: APP_ENV,
  });
});

// ── Login (placeholder, logs failed attempts) ───────────────────────────────
app.post("/api/login", (req, res) => {
  const username = String(req.body?.username || "");
  // v0.1.x: client-side placeholder auth. Backend only logs the attempt.
  if (!username) {
    log("warn", "login_failed", { reason: "missing_username" });
    return res.status(400).json({ error: "username required" });
  }
  log("info", "login_attempt", { username });
  res.json({ ok: true });
});

// ── Backup ──────────────────────────────────────────────────────────────────
app.post("/api/backup/run", async (_req, res) => {
  log("info", "backup_requested", { trigger: "manual" });
  const result = await runBackup({ trigger: "manual", logger: log });
  res.status(result.status === "ok" ? 200 : 500).json(result);
});

app.get("/api/backup/status", (_req, res) => {
  res.json(getBackupStatus());
});

// ── Plugins ─────────────────────────────────────────────────────────────────
app.get("/api/plugins", async (_req, res, next) => {
  try {
    const rows = await query(
      "SELECT id, name, description, version, enabled FROM plugins ORDER BY id"
    );
    res.json(rows.map((r) => ({ ...r, enabled: !!r.enabled })));
  } catch (e) {
    next(e);
  }
});

app.post("/api/plugins/toggle", async (req, res, next) => {
  try {
    const id = Number(req.body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Valid plugin id is required." });
    }
    const [existing] = await query("SELECT id, enabled FROM plugins WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ error: "Plugin not found." });
    const next = existing.enabled ? 0 : 1;
    await query("UPDATE plugins SET enabled = ? WHERE id = ?", [next, id]);
    const [updated] = await query(
      "SELECT id, name, description, version, enabled FROM plugins WHERE id = ?",
      [id]
    );
    res.json({ ...updated, enabled: !!updated.enabled });
  } catch (e) {
    next(e);
  }
});

// ── Settings ────────────────────────────────────────────────────────────────
app.get("/api/settings", async (_req, res, next) => {
  try {
    const rows = await query("SELECT `key`, value FROM app_settings ORDER BY `key`");
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

app.post("/api/settings", async (req, res, next) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : [];
    for (const item of payload) {
      if (!item || typeof item.key !== "string" || typeof item.value !== "string") {
        return res.status(400).json({ error: "Each setting requires {key, value}." });
      }
      if (item.key.length > 128 || item.value.length > 4096) {
        return res.status(400).json({ error: "Setting too large." });
      }
      await query(
        "INSERT INTO app_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
        [item.key, item.value]
      );
    }
    const rows = await query("SELECT `key`, value FROM app_settings ORDER BY `key`");
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// ── Rollback points ─────────────────────────────────────────────────────────
app.get("/api/rollback-points", async (_req, res, next) => {
  try {
    const rows = await query(
      "SELECT id, label, size_bytes, created_at FROM rollback_points ORDER BY created_at DESC"
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        label: r.label,
        size_bytes: Number(r.size_bytes),
        created_at:
          r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      }))
    );
  } catch (e) {
    next(e);
  }
});

// ── Error handler ───────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  log("error", "api_error", {
    path: req.path,
    method: req.method,
    message: err?.message,
    stack: err?.stack,
  });
  res.status(500).json({ error: "Internal server error" });
});

// ── Process-level safety net ───────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  log("error", "uncaught_exception", { message: err?.message, stack: err?.stack });
});
process.on("unhandledRejection", (reason) => {
  log("error", "unhandled_rejection", { reason: String(reason) });
});

// ── Boot ────────────────────────────────────────────────────────────────────
async function boot() {
  log("info", "server_starting", { port: PORT, version: APP_VERSION, build: APP_BUILD });

  let dbReady = false;
  for (let i = 0; i < 30; i++) {
    if (await ping()) {
      dbReady = true;
      break;
    }
    log("warn", "db_waiting", { attempt: i + 1 });
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (dbReady) log("info", "db_connected");
  else log("error", "db_connect_failed", { attempts: 30 });

  try {
    await migrateAndSeed();
    log("info", "db_schema_ready");
  } catch (e) {
    log("error", "db_migration_failed", { message: e?.message, stack: e?.stack });
  }

  app.listen(PORT, () => {
    log("info", "server_started", { port: PORT });
  });
}

boot();
