// Centralized API client for BBS Core.
// In production (Docker), nginx proxies /api → backend:4000.
// Override at build time with VITE_API_BASE_URL if needed.
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

const SESSION_KEY = "bbs_session";

export interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getAuthSession();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(text || `Request failed: ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

export function getAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  localStorage.removeItem(SESSION_KEY);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  login: (username: string, password: string) =>
    request<AuthSession>("/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => request<{ user: AuthUser }>("/me"),
  logout: () => request<{ ok: true }>("/logout", { method: "POST" }),
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
