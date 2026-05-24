// BBS Core — authentication: bcrypt password hashing + JWT sessions.
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { query } from "./db.js";
import { logger } from "./logger.js";
import { ApiError } from "./errors.js";

const log = logger.child("auth");

export async function hashPassword(plain) {
  return bcrypt.hash(plain, config.auth.bcryptRounds);
}

export async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username, role: user.role },
    config.app.secret,
    { expiresIn: config.auth.jwtExpiresIn, issuer: "bbs-core" },
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.app.secret, { issuer: "bbs-core" });
  } catch {
    return null;
  }
}

export async function findUserByLogin(login) {
  const rows = await query(
    "SELECT id, username, email, password_hash, role, disabled FROM users WHERE username = ? OR email = ? LIMIT 1",
    [login, login],
  );
  return rows[0] || null;
}

export async function recordFailedLogin({ login, ip, reason }) {
  try {
    await query(
      "INSERT INTO failed_login_attempts (login, ip, reason) VALUES (?, ?, ?)",
      [String(login || "").slice(0, 190), String(ip || "").slice(0, 64), String(reason || "").slice(0, 190)],
    );
  } catch (e) {
    log.warn("failed_login_log_failed", { message: e?.message });
  }
}

export async function updateLastLogin(userId) {
  try {
    await query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [userId]);
  } catch (e) {
    log.warn("last_login_update_failed", { message: e?.message });
  }
}

// Express middleware — require a valid bearer token. Attaches req.user.
export function requireAuth(req, _res, next) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(new ApiError("Bejelentkezés szükséges.", 401, "unauthenticated"));
  const payload = verifyToken(token);
  if (!payload) return next(new ApiError("Érvénytelen vagy lejárt munkamenet.", 401, "invalid_token"));
  req.user = { id: Number(payload.sub), username: payload.username, role: payload.role };
  next();
}

// Seed the SuperAdmin user on first boot if no users exist.
export async function ensureSuperAdmin() {
  const [{ c }] = await query("SELECT COUNT(*) AS c FROM users");
  if (Number(c) > 0) return { created: false };
  const username = config.auth.superadminUsername;
  const email = config.auth.superadminEmail;
  const password = config.auth.superadminPassword;
  const hash = await hashPassword(password);
  await query(
    "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'superadmin')",
    [username, email, hash],
  );
  log.warn("superadmin_seeded", {
    username,
    email,
    hint: "Change the default password immediately after first login.",
  });
  return { created: true, username, email };
}
