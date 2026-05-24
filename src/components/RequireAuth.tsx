import { type ReactNode } from "react";

// Lightweight, synchronous auth guard for v0.1.2.
// Rules:
//  - reads localStorage ONCE during render (no useEffect, no state, no loop)
//  - if no session, hard-redirects to /login via window.location (the login
//    route is bootstrapped by spa-main.tsx outside the router, so this avoids
//    any router/AppShell rendering on the login page)
//  - on the login page itself this guard is never used
//  - SSR-safe: if window is undefined, render nothing
export function RequireAuth({ children }: { children: ReactNode }) {
  if (typeof window === "undefined") return null;

  let hasSession = false;
  try {
    const raw = window.localStorage.getItem("bbs_session");
    if (raw) {
      const parsed = JSON.parse(raw) as { user?: string; token?: string } | null;
      hasSession = !!(parsed && parsed.user);
    }
  } catch {
    hasSession = false;
  }

  if (!hasSession) {
    // Hard redirect — bypasses the router so AppShell never renders.
    if (window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          fontSize: "14px",
          color: "#4b5563",
        }}
      >
        Átirányítás a bejelentkezésre…
      </div>
    );
  }

  return <>{children}</>;
}
