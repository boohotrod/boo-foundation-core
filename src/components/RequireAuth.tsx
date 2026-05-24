import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = typeof window !== "undefined" ? localStorage.getItem("bbs_session") : null;
    if (!session) {
      navigate({ to: "/login" });
    } else {
      setReady(true);
    }
  }, [navigate]);

  if (!ready) return null;
  return <>{children}</>;
}
