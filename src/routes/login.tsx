import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — BBS Core" },
      { name: "description", content: "Sign in to the Boo Base System control panel." },
    ],
  }),
  component: LoginPage,
});

interface StoredUser {
  username: string;
  password: string;
  createdAt: number;
}

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem("bbs_users");
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!username || !password) {
      setError("Username and password are required.");
      return;
    }

    const users = loadUsers();
    // v0.1.0 placeholder auth — accept any credentials if no account exists yet
    // (first-run convenience), otherwise verify against the local store.
    if (users.length > 0) {
      const found = users.find(
        (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
      );
      if (!found) {
        setError("Invalid username or password.");
        return;
      }
    }

    localStorage.setItem(
      "bbs_session",
      JSON.stringify({ user: username, ts: Date.now() })
    );
    window.location.assign("/dashboard");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground">
            B
          </div>
          <h1 className="text-2xl font-semibold">BBS Core Login</h1>
          <p className="text-sm text-muted-foreground">Boo Base System · v0.1.0</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-md border border-border bg-card p-6"
        >
          <div>
            <label htmlFor="bbs-username" className="mb-1 block text-sm font-medium">
              Username
            </label>
            <input
              id="bbs-username"
              name="username"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="bbs-password" className="mb-1 block text-sm font-medium">
              Password
            </label>
            <input
              id="bbs-password"
              name="password"
              type="password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Sign in
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Don't have an account?{" "}
            <a href="/register" className="text-primary underline">
              Register
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
