// BBS Core v0.1.2 — backup module
// Runs mariadb-dump against the configured DB and stores a timestamped
// .sql file under BACKUP_PATH. Also exposes a simple in-memory scheduler.
//
// Safety:
//  - never deletes existing files
//  - never touches the MariaDB data volume
//  - each backup file is uniquely timestamped
import { spawn } from "node:child_process";
import { mkdir, stat, readdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";

const {
  DB_HOST = "db",
  DB_PORT = "3306",
  DB_NAME = "bbs_core",
  DB_USER = "bbs",
  DB_PASSWORD = "",
  BACKUP_PATH = "/backups",
  BACKUP_ENABLED = "true",
  BACKUP_INTERVAL_HOURS = "24",
} = process.env;

export const backupConfig = {
  path: BACKUP_PATH,
  enabled: String(BACKUP_ENABLED).toLowerCase() === "true",
  intervalHours: Math.max(1, Number(BACKUP_INTERVAL_HOURS) || 24),
};

let lastBackupAt = null; // ISO string
let lastBackupId = null;
let lastBackupError = null;
let nextScheduledAt = null; // ISO string
let running = false;

function tsSlug(d = new Date()) {
  return d.toISOString().replace(/[:.]/g, "-");
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

function findDumpBinary() {
  // Prefer mariadb-dump, fall back to mysqldump for older base images.
  return new Promise((resolve) => {
    const probe = spawn("sh", ["-c", "command -v mariadb-dump || command -v mysqldump || true"]);
    let out = "";
    probe.stdout.on("data", (c) => (out += c.toString()));
    probe.on("close", () => resolve(out.trim().split("\n")[0] || null));
  });
}

export async function runBackup({ trigger = "manual", logger = console.log } = {}) {
  if (running) {
    return { status: "error", message: "Backup already running", timestamp: new Date().toISOString() };
  }
  running = true;
  const startedAt = new Date();
  const backupId = `backup-${tsSlug(startedAt)}`;
  const timestamp = startedAt.toISOString();

  try {
    await ensureDir(backupConfig.path);
    const bin = await findDumpBinary();
    if (!bin) throw new Error("mariadb-dump/mysqldump not found in backend image");

    const outFile = path.join(backupConfig.path, `${backupId}.sql`);
    logger("info", "backup_started", { backup_id: backupId, trigger, file: outFile });

    await new Promise((resolve, reject) => {
      const args = [
        `-h${DB_HOST}`,
        `-P${DB_PORT}`,
        `-u${DB_USER}`,
        `-p${DB_PASSWORD}`,
        "--single-transaction",
        "--quick",
        "--routines",
        "--triggers",
        DB_NAME,
      ];
      const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
      const ws = createWriteStream(outFile, { flags: "wx" }); // wx = fail if exists
      let stderr = "";
      child.stdout.pipe(ws);
      child.stderr.on("data", (c) => (stderr += c.toString()));
      child.on("error", reject);
      ws.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`dump exited ${code}: ${stderr.trim()}`));
      });
    });

    const st = await stat(outFile);
    lastBackupAt = timestamp;
    lastBackupId = backupId;
    lastBackupError = null;
    scheduleNext();
    logger("info", "backup_completed", { backup_id: backupId, bytes: st.size, trigger });
    return {
      status: "ok",
      message: "Backup completed",
      backup_id: backupId,
      size_bytes: st.size,
      timestamp,
    };
  } catch (err) {
    lastBackupError = err?.message || String(err);
    logger("error", "backup_failed", { backup_id: backupId, trigger, message: lastBackupError });
    return { status: "error", message: lastBackupError, timestamp };
  } finally {
    running = false;
  }
}

function scheduleNext() {
  if (!backupConfig.enabled) {
    nextScheduledAt = null;
    return;
  }
  nextScheduledAt = new Date(Date.now() + backupConfig.intervalHours * 3600_000).toISOString();
}

export function getBackupStatus() {
  return {
    status: "ok",
    last_backup: lastBackupAt,
    last_backup_id: lastBackupId,
    last_error: lastBackupError,
    next_backup: nextScheduledAt,
    scheduled: backupConfig.enabled,
    interval_hours: backupConfig.intervalHours,
    backup_path: backupConfig.path,
    running,
  };
}

export async function listBackupFiles() {
  try {
    await ensureDir(backupConfig.path);
    const entries = await readdir(backupConfig.path);
    return entries.filter((f) => f.endsWith(".sql")).sort().reverse();
  } catch {
    return [];
  }
}

export function startScheduler(logger = console.log) {
  if (!backupConfig.enabled) {
    logger("info", "backup_scheduler_disabled", {});
    return;
  }
  scheduleNext();
  const intervalMs = backupConfig.intervalHours * 3600_000;
  logger("info", "backup_scheduler_started", {
    interval_hours: backupConfig.intervalHours,
    next_backup: nextScheduledAt,
  });
  setInterval(() => {
    runBackup({ trigger: "scheduled", logger }).catch(() => {});
  }, intervalMs);
}
