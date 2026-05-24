import express from "express";
import cors from "cors";
import morgan from "morgan";
import os from "os";
import { query, ping, migrateAndSeed } from "./db.js";

const PORT = Number(process.env.PORT || 4000);
const APP_VERSION = "0.1.0";
const startedAt = Date.now();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

// ── Health ──────────────────────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  const db = await ping();
  res.json({
    status: db ? "ok" : "degraded",
    uptime: (Date.now() - startedAt) / 1000,
    version: APP_VERSION,
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
    // Disk metrics require a native lib; report container-rootfs approximation.
    disk: { used: 0, total: 0 },
    database: db ? "connected" : "disconnected",
    uptime: (Date.now() - startedAt) / 1000,
  });
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
app.use((err, _req, res, _next) => {
  console.error("[bbs-core]", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Boot ────────────────────────────────────────────────────────────────────
async function boot() {
  // Wait for the database to become available (compose starts it in parallel).
  for (let i = 0; i < 30; i++) {
    if (await ping()) break;
    console.log("[bbs-core] waiting for database…");
    await new Promise((r) => setTimeout(r, 2000));
  }
  try {
    await migrateAndSeed();
    console.log("[bbs-core] schema ready");
  } catch (e) {
    console.error("[bbs-core] migration failed", e);
  }
  app.listen(PORT, () => {
    console.log(`[bbs-core] API listening on :${PORT}`);
  });
}

boot();
