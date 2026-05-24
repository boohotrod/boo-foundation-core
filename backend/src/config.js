// BBS Core — central configuration + ENV validation
// All process.env reads happen here. Other modules import from this file.
import { accessSync, constants, mkdirSync } from "node:fs";

const APP_NAME = "BBS Core";
const APP_VERSION = "0.1.2";
const APP_BUILD = "production-foundation";

function readEnv(key, fallback = undefined) {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}

function ensureWritableDir(dir) {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// Validate critical configuration. Returns { ok, errors[], warnings[] }.
// We never throw here — boot() decides whether to exit or degrade.
export function validateEnvironment() {
  const errors = [];
  const warnings = [];

  // Database — required
  for (const key of ["DB_HOST", "DB_NAME", "DB_USER"]) {
    if (!readEnv(key)) errors.push(`Missing required env: ${key}`);
  }
  if (!readEnv("DB_PASSWORD")) {
    warnings.push("DB_PASSWORD is empty — only acceptable in local dev.");
  }

  // App secret — required for v0.2.x auth, warn-only for v0.1.x
  if (!readEnv("APP_SECRET")) {
    warnings.push(
      "APP_SECRET is not set. v0.1.x uses placeholder auth, but production must set this before v0.2.0.",
    );
  }

  // Writable directories
  const backupPath = readEnv("BACKUP_PATH", "/backups");
  const dirCheck = ensureWritableDir(backupPath);
  if (!dirCheck.ok) {
    errors.push(`Backup directory ${backupPath} not writable: ${dirCheck.error}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

export const config = Object.freeze({
  app: {
    name: APP_NAME,
    version: APP_VERSION,
    build: APP_BUILD,
    environment: readEnv("NODE_ENV", "production"),
    port: Number(readEnv("PORT", "4000")),
    secret: readEnv("APP_SECRET", ""),
  },
  log: {
    level: (readEnv("LOG_LEVEL", "info") || "info").toLowerCase(),
  },
  db: {
    host: readEnv("DB_HOST", "db"),
    port: Number(readEnv("DB_PORT", "3306")),
    name: readEnv("DB_NAME", "bbs_core"),
    user: readEnv("DB_USER", "bbs"),
    password: readEnv("DB_PASSWORD", ""),
  },
  urls: {
    frontend: readEnv("FRONTEND_URL", ""),
    backend: readEnv("BACKEND_URL", ""),
  },
  backup: {
    path: readEnv("BACKUP_PATH", "/backups"),
    enabled: String(readEnv("BACKUP_ENABLED", "true")).toLowerCase() === "true",
    intervalHours: Math.max(1, Number(readEnv("BACKUP_INTERVAL_HOURS", "24")) || 24),
  },
});
