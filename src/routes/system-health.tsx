import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, HealthResponse, SystemStatus } from "@/lib/api";

export const Route = createFileRoute("/system-health")({
  head: () => ({ meta: [{ title: "Rendszerállapot — BBS Core" }] }),
  component: () => (
    <RequireAuth>
      <SystemHealthPage />
    </RequireAuth>
  ),
});

function fmtBytes(n: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

function SystemHealthPage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<HealthResponse>("/health"),
    refetchInterval: 5000,
  });
  const status = useQuery({
    queryKey: ["status"],
    queryFn: () => api.get<SystemStatus>("/system/status"),
    refetchInterval: 5000,
  });

  return (
    <AppShell title="Rendszerállapot">
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="API">
          <Row label="Állapot" value={health.data?.status ?? "—"} />
          <Row label="Verzió" value={health.data?.version ?? "—"} />
          <Row
            label="Üzemidő"
            value={health.data ? `${Math.round(health.data.uptime)} mp` : "—"}
          />
          <Row label="Időbélyeg" value={health.data?.timestamp ?? "—"} />
        </Panel>
        <Panel title="Rendszer">
          <Row label="Adatbázis" value={status.data?.database ?? "—"} />
          <Row label="CPU" value={status.data ? `${status.data.cpu.toFixed(1)} %` : "—"} />
          <Row
            label="Memória"
            value={
              status.data
                ? `${fmtBytes(status.data.memory.used)} / ${fmtBytes(status.data.memory.total)}`
                : "—"
            }
          />
          <Row
            label="Lemez"
            value={
              status.data
                ? `${fmtBytes(status.data.disk.used)} / ${fmtBytes(status.data.disk.total)}`
                : "—"
            }
          />
        </Panel>
      </div>
    </AppShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <dl className="space-y-2 text-sm">{children}</dl>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
