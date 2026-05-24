// Centralized API client for BBS Core.
// In production (Docker), nginx proxies /api → backend:4000.
// Override at build time with VITE_API_BASE_URL if needed.
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch {
    throw new ApiError("A backend nem érhető el.", 0);
  }
  const ctype = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    if (res.status === 404 || !ctype.includes("application/json")) {
      throw new ApiError(
        "A backend végpont nem érhető el. Ez a funkció csak a VPS telepítésen működik (Docker backend kontéenerrel).",
        res.status,
      );
    }
    let msg = res.statusText || `Request failed: ${res.status}`;
    try {
      const j = await res.json();
      msg = j.error || j.message || msg;
    } catch {}
    throw new ApiError(msg, res.status);
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
