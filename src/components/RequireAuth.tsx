import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { api, clearAuthSession, getAuthSession } from "@/lib/api";

export function RequireAuth({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const session = getAuthSession();
    if (!session?.token) {
      navigate({ to: "/login" });
      return;
    }

    api.me()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        clearAuthSession();
        if (!cancelled) navigate({ to: "/login" });
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!ready) return null;
  return <>{children}</>;
}
