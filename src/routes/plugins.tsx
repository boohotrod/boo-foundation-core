import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, Plugin } from "@/lib/api";

export const Route = createFileRoute("/plugins")({
  head: () => ({ meta: [{ title: "Bővítmények — BBS Core" }] }),
  component: () => (
    <RequireAuth>
      <PluginsPage />
    </RequireAuth>
  ),
});

function PluginsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["plugins"],
    queryFn: () => api.get<Plugin[]>("/plugins"),
  });

  const toggle = useMutation({
    mutationFn: (id: number) => api.post<Plugin>("/plugins/toggle", { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plugins"] }),
  });

  return (
    <AppShell title="Plugins">
      {isLoading && <p className="text-sm text-muted-foreground">Loading plugins…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          Could not reach backend. Start the API server (see README).
        </p>
      )}
      <div className="grid gap-3">
        {data?.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-5"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{p.name}</h3>
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  v{p.version}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
            </div>
            <button
              onClick={() => toggle.mutate(p.id)}
              disabled={toggle.isPending}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                p.enabled
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border border-input bg-background hover:bg-accent"
              }`}
            >
              {p.enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
