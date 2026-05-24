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
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(text || `Request failed: ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
};

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
