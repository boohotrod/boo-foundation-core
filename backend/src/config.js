// BBS Core — central configuration + ENV validation
// All process.env reads happen here. Other modules import from this file.
import { accessSync, constants, mkdirSync } from "node:fs";

const APP_NAME = "BBS Core";
const APP_VERSION = "0.2.0";
const APP_BUILD = "real-auth";

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
export function validateEnvironment() {
  const errors = [];
  const warnings = [];

  for (const key of ["DB_HOST", "DB_NAME", "DB_USER"]) {
    if (!readEnv(key)) errors.push(`Missing required env: ${key}`);
  }
  if (!readEnv("DB_PASSWORD")) {
    warnings.push("DB_PASSWORD is empty — only acceptable in local dev.");
  }

  // APP_SECRET is REQUIRED in v0.2.0 (used to sign JWT auth tokens).
  const secret = readEnv("APP_SECRET", "");
  if (!secret) {
    errors.push("APP_SECRET is required (>=32 chars) — used to sign auth tokens.");
  } else if (secret.length < 32) {
    warnings.push("APP_SECRET is shorter than 32 characters — regenerate with: openssl rand -base64 48");
  }

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
  auth: {
    jwtExpiresIn: readEnv("JWT_EXPIRES_IN", "7d"),
    bcryptRounds: Math.max(8, Number(readEnv("BCRYPT_ROUNDS", "10")) || 10),
    superadminUsername: readEnv("SUPERADMIN_USERNAME", "superadmin"),
    superadminEmail: readEnv("SUPERADMIN_EMAIL", "admin@bbs.local"),
    // Used ONLY on first boot to seed the SuperAdmin user. Change after first login.
    superadminPassword: readEnv("SUPERADMIN_PASSWORD", "ChangeMe!Admin123"),
  },
});
