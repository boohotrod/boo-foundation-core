import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, RollbackPoint } from "@/lib/api";

export const Route = createFileRoute("/rollback-points")({
  head: () => ({ meta: [{ title: "Visszaállítási pontok — BBS Core" }] }),
  component: () => (
    <RequireAuth>
      <RollbackPointsPage />
    </RequireAuth>
  ),
});

function fmtBytes(n: number) {
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${u[i]}`;
}

function RollbackPointsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["rollback-points"],
    queryFn: () => api.get<RollbackPoint[]>("/rollback-points"),
  });

  return (
    <AppShell title="Rollback Points">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Label</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium text-right">Size</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-destructive">
                  Could not reach backend.
                </td>
              </tr>
            )}
            {data?.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono">{r.id}</td>
                <td className="px-4 py-3">{r.label}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono">{fmtBytes(r.size_bytes)}</td>
              </tr>
            ))}
            {data && data.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No rollback points yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
