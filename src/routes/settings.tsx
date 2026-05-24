import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, AppSetting } from "@/lib/api";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Beállítások — BBS Core" }] }),
  component: () => (
    <RequireAuth>
      <SettingsPage />
    </RequireAuth>
  ),
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<AppSetting[]>("/settings"),
  });

  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) setDraft(Object.fromEntries(data.map((s) => [s.key, s.value])));
  }, [data]);

  const save = useMutation({
    mutationFn: (payload: AppSetting[]) => api.post<AppSetting[]>("/settings", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  return (
    <AppShell title="Settings">
      <div className="max-w-2xl rounded-xl border border-border bg-card p-6">
        {data?.map((s) => (
          <div key={s.key} className="mb-4">
            <label className="mb-1 block text-sm font-medium">{s.key}</label>
            <input
              value={draft[s.key] ?? ""}
              onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        ))}
        <button
          onClick={() =>
            save.mutate(Object.entries(draft).map(([key, value]) => ({ key, value })))
          }
          disabled={save.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </button>
        {save.isSuccess && (
          <span className="ml-3 text-sm text-muted-foreground">Saved.</span>
        )}
      </div>
    </AppShell>
  );
}
