import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, HealthResponse, SystemStatus, BackupStatus, BackupRunResult } from "@/lib/api";

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
      <BackupSection />
      <div className="mb-4 rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Rendszer összegzés
        </h3>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <Row label="Frontend" value="OK (v0.1.2)" />
          <Row
            label="Backend"
            value={
              health.isError
                ? "leállt"
                : health.data
                  ? `${health.data.status} (v${health.data.version})`
                  : "…"
            }
          />
          <Row label="Adatbázis" value={status.data?.database ?? (status.isError ? "nincs kapcsolat" : "…")} />
          <Row label="Build" value={health.data?.build ?? "production-foundation"} />
          <Row label="Környezet" value={health.data?.environment ?? "production"} />
          <Row label="Időbélyeg" value={new Date().toLocaleString("hu-HU")} />
        </dl>
      </div>
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

function fmtTime(s: string | null | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("hu-HU");
  } catch {
    return s;
  }
}

function BackupSection() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const backup = useQuery({
    queryKey: ["backup-status"],
    queryFn: () => api.get<BackupStatus>("/backup/status"),
    refetchInterval: 10000,
  });
  const run = useMutation({
    mutationFn: () => api.post<BackupRunResult>("/backup/run"),
    onSuccess: (r) => {
      setMsg({
        kind: r.status === "ok" ? "ok" : "error",
        text: r.status === "ok" ? `Mentés sikeres: ${r.backup_id}` : `Hiba: ${r.message}`,
      });
      qc.invalidateQueries({ queryKey: ["backup-status"] });
    },
    onError: (e: Error) => setMsg({ kind: "error", text: `Hiba: ${e.message}` }),
  });

  const d = backup.data;
  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Biztonsági mentés
        </h3>
        <button
          type="button"
          onClick={() => {
            setMsg(null);
            run.mutate();
          }}
          disabled={run.isPending || d?.running}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {run.isPending || d?.running ? "Mentés folyamatban…" : "Mentés indítása"}
        </button>
      </div>
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        <Row label="Utolsó mentés" value={fmtTime(d?.last_backup)} />
        <Row label="Következő mentés" value={fmtTime(d?.next_backup)} />
        <Row label="Időköz (óra)" value={d ? String(d.interval_hours) : "—"} />
        <Row
          label="Ütemezett mentés"
          value={d ? (d.scheduled ? "aktív" : "inaktív") : "—"}
        />
        <Row label="Mentési mappa" value={d?.backup_path ?? "—"} />
        <Row label="Utolsó hiba" value={d?.last_error ?? "—"} />
      </dl>
      {msg && (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            msg.kind === "ok"
              ? "border-green-500/40 text-green-600"
              : "border-destructive/40 text-destructive"
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
