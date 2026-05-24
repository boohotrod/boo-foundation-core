import * as mariadb from "mariadb";
import { hashPassword } from "./auth.js";

const {
  DB_HOST = "localhost",
  DB_PORT = "3306",
  DB_NAME = "bbs_core",
  DB_USER = "bbs",
  DB_PASSWORD = "",
} = process.env;

export const pool = mariadb.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  connectionLimit: 10,
  acquireTimeout: 10000,
});

export async function query(sql, params = []) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(sql, params);
    // mariadb adds `meta` to result arrays — strip it for JSON safety.
    if (Array.isArray(rows)) return rows.map((r) => ({ ...r }));
    return rows;
  } finally {
    conn.release();
  }
}

export async function ping() {
  try {
    await query("SELECT 1 AS ok");
    return true;
  } catch {
    return false;
  }
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS plugins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    version VARCHAR(32) NOT NULL DEFAULT '0.1.0',
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS app_settings (
    \`key\` VARCHAR(128) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS rollback_points (
    id INT AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(128) NOT NULL UNIQUE,
    email VARCHAR(255) NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(64) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const SEED_PLUGINS = [
  ["core-auth", "Authentication and session management.", "0.1.0", 1],
  ["core-logger", "Centralized structured logging.", "0.1.0", 1],
  ["core-backup", "Scheduled rollback-point snapshots.", "0.1.0", 0],
  ["core-metrics", "Host and process metrics collection.", "0.1.0", 0],
];

const SEED_SETTINGS = [
  ["site_name", "BBS Core"],
  ["timezone", "UTC"],
  ["log_level", "info"],
  ["retain_rollbacks", "10"],
];

const SEED_ROLLBACKS = [
  ["v0.1.0 initial", 1024 * 1024 * 12],
  ["pre-plugin-migration", 1024 * 1024 * 18],
];

export async function migrateAndSeed() {
  for (const stmt of SCHEMA) await query(stmt);

  const [{ c: userCount }] = await query("SELECT COUNT(*) AS c FROM users");
  if (Number(userCount) === 0) {
    const username = process.env.SUPERADMIN_USERNAME || "superadmin";
    const password = process.env.SUPERADMIN_PASSWORD || "ChangeMe!Admin123";
    await query(
      "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [username, `${username}@local.bbs`, hashPassword(password), "superadmin"]
    );
  }

  const [{ c: pluginCount }] = await query("SELECT COUNT(*) AS c FROM plugins");
  if (Number(pluginCount) === 0) {
    for (const p of SEED_PLUGINS) {
      await query(
        "INSERT INTO plugins (name, description, version, enabled) VALUES (?, ?, ?, ?)",
        p
      );
    }
  }

  const [{ c: settingsCount }] = await query("SELECT COUNT(*) AS c FROM app_settings");
  if (Number(settingsCount) === 0) {
    for (const s of SEED_SETTINGS) {
      await query("INSERT INTO app_settings (`key`, value) VALUES (?, ?)", s);
    }
  }

  const [{ c: rbCount }] = await query("SELECT COUNT(*) AS c FROM rollback_points");
  if (Number(rbCount) === 0) {
    for (const r of SEED_ROLLBACKS) {
      await query("INSERT INTO rollback_points (label, size_bytes) VALUES (?, ?)", r);
    }
  }
}
