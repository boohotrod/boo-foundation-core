import crypto from "crypto";

const TOKEN_TTL_SECONDS = 60 * 60 * 8;
const PASSWORD_ITERATIONS = 210000;
const PASSWORD_KEY_LENGTH = 32;

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function getSecret() {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("APP_SECRET must be set to a 32+ character value before auth can run.");
  }
  return secret;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, "sha256")
    .toString("hex");
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [algorithm, iterations, salt, expected] = String(storedHash || "").split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !expected) return false;

  const actual = crypto
    .pbkdf2Sync(password, salt, Number(iterations), Buffer.from(expected, "hex").length, "sha256")
    .toString("hex");

  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function signToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user.id),
    username: user.username,
    role: user.role,
    iss: "bbs-core",
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid token");

  const [encodedHeader, encodedPayload, signature] = parts;
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    throw new Error("Invalid token signature");
  }

  const header = JSON.parse(base64UrlDecode(encodedHeader));
  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (header.alg !== "HS256" || payload.iss !== "bbs-core") throw new Error("Invalid token");
  if (!payload.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
}