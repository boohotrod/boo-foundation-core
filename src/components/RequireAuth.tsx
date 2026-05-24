import { type ReactNode } from "react";
import { getSession } from "../lib/api";

// Synchronous auth guard. Reads localStorage once during render — no effects,
// no router calls — to preserve the no-freeze login behavior.
export function RequireAuth({ children }: { children: ReactNode }) {
  if (typeof window === "undefined") return null;

  const session = getSession();
  if (!session) {
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
