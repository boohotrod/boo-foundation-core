import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, HealthResponse, SystemStatus, Plugin } from "@/lib/api";
import { Activity, Puzzle, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Vezérlőpult — BBS Core" }] }),
  component: () => (
    <RequireAuth>
      <DashboardPage />
    </RequireAuth>
  ),
});

function DashboardPage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<HealthResponse>("/health"),
    refetchInterval: 10000,
  });
  const status = useQuery({
    queryKey: ["status"],
    queryFn: () => api.get<SystemStatus>("/system/status"),
    refetchInterval: 10000,
  });
  const plugins = useQuery({
    queryKey: ["plugins"],
    queryFn: () => api.get<Plugin[]>("/plugins"),
  });

  const enabledCount = plugins.data?.filter((p) => p.enabled).length ?? 0;

  return (
    <AppShell title="Vezérlőpult">
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="API állapot"
          value={health.data?.status ?? (health.isError ? "leállt" : "…")}
          icon={
            health.data?.status === "ok" ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )
          }
          sub={health.data ? `v${health.data.version}` : ""}
        />
        <Card
          title="Adatbázis"
          value={status.data?.database ?? (status.isError ? "nincs kapcsolat" : "…")}
          icon={<Activity className="h-5 w-5 text-primary" />}
          sub={status.data ? `üzemidő ${Math.round(status.data.uptime)} mp` : ""}
        />
        <Card
          title="Aktív bővítmények"
          value={`${enabledCount} / ${plugins.data?.length ?? 0}`}
          icon={<Puzzle className="h-5 w-5 text-primary" />}
          sub="Bővítmény-futtatókörnyezet"
        />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold">Üdvözlünk a BBS Core-ban</h2>
        <p className="text-sm text-muted-foreground">
          Ez a <code className="rounded bg-muted px-1.5 py-0.5">v0.1.0</code> mérföldkő — az
          alap. A bal oldali menüből elérhetők a bővítmények, a rendszerállapot, a beállítások
          és a visszaállítási pontok. A teljes BBS funkciókészlet a későbbi mérföldköveknél érkezik.
        </p>
      </div>
    </AppShell>
  );
}

function Card({
  title,
  value,
  icon,
  sub,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{title}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold capitalize">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
