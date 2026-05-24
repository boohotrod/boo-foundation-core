// Centralized API client for BBS Core.
// In production (Docker), nginx proxies /api → backend:4000.
// Override at build time with VITE_API_BASE_URL if needed.
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

const SESSION_KEY = "bbs_session";

export interface StoredSession {
  token: string;
  user: { id: number; username: string; email: string; role: string };
  ts: number;
}

export function getSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession | null;
    if (parsed && parsed.token && parsed.user?.username) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function setSession(s: StoredSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession() {
  try { window.localStorage.removeItem(SESSION_KEY); } catch {}
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  const auth = init?.auth !== false;
  const session = auth ? getSession() : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (session) headers["Authorization"] = `Bearer ${session.token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("A backend nem érhető el.", 0);
  }

  const ctype = res.headers.get("content-type") ?? "";

  if (res.status === 401 && auth && session) {
    // Token invalid/expired — purge and bounce to login.
    clearSession();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
  }

  if (!res.ok) {
    if (!ctype.includes("application/json")) {
      throw new ApiError(
        res.status === 404
          ? "A backend végpont nem érhető el. Ez a funkció csak a VPS telepítésen működik."
          : `Szerverhiba (${res.status}).`,
        res.status,
      );
    }
    let msg = res.statusText || `Request failed: ${res.status}`;
    let code: string | undefined;
    try {
      const j = await res.json();
      msg = j.error || j.message || msg;
      code = j.code;
    } catch {}
    throw new ApiError(msg, res.status, code);
  }
  if (!ctype.includes("application/json")) {
    throw new ApiError("A backend nem érhető el (nem JSON válasz).", 0);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  login: (username: string, password: string) =>
    request<{ ok: true; token: string; user: StoredSession["user"] }>("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      auth: false,
    }),
  logout: async () => {
    try { await request<{ ok: true }>("/logout", { method: "POST" }); } catch {}
    clearSession();
  },
};

export interface BackupStatus {
  status: "ok" | "error";
  last_backup: string | null;
  last_backup_id: string | null;
  last_error: string | null;
  next_backup: string | null;
  scheduled: boolean;
  interval_hours: number;
  backup_path: string;
  running: boolean;
}

export interface BackupRunResult {
  status: "ok" | "error";
  message: string;
  backup_id?: string;
  size_bytes?: number;
  timestamp: string;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "down" | "error";
  uptime: number;
  version: string;
  build?: string;
  environment?: string;
  database?: "connected" | "disconnected";
  service?: string;
  timestamp: string;
}

export interface SystemStatus {
  cpu: number;
  memory: { used: number; total: number };
  disk: { used: number; total: number };
  database: "connected" | "disconnected";
  uptime: number;
}

export interface Plugin {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
  version: string;
}

export interface AppSetting {
  key: string;
  value: string;
}

export interface RollbackPoint {
  id: number;
  label: string;
  created_at: string;
  size_bytes: number;
}
