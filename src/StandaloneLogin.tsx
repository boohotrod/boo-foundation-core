import { useState, type FormEvent } from "react";
import { api, setSession, ApiError } from "./lib/api";

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background: "#ffffff",
  color: "#111827",
  fontFamily: "Arial, sans-serif",
} as const;

const panelStyle = { width: "100%", maxWidth: "340px" } as const;
const formStyle = { display: "flex", flexDirection: "column", gap: "14px" } as const;
const labelStyle = { display: "block", marginBottom: "6px", fontSize: "14px" } as const;
const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px",
  fontSize: "16px",
  border: "1px solid #9ca3af",
  borderRadius: "4px",
  background: "#ffffff",
  color: "#111827",
  outline: "1px solid #111827",
} as const;
const buttonStyle = {
  width: "100%",
  padding: "10px",
  fontSize: "16px",
  border: "1px solid #111827",
  borderRadius: "4px",
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
} as const;
const errorStyle = {
  margin: "0 0 12px",
  padding: "8px 10px",
  fontSize: "13px",
  color: "#7f1d1d",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "4px",
} as const;

export function StandaloneLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await api.login(username.trim(), password);
      setSession({ token: res.token, user: res.user, ts: Date.now() });
      window.location.href = "/dashboard";
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : "Bejelentkezés sikertelen. Próbáld újra.";
      setError(msg || "Bejelentkezés sikertelen.");
      setBusy(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <h1 style={{ margin: "0 0 8px", fontSize: "24px", lineHeight: 1.2 }}>BBS Core</h1>
        <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#4b5563" }}>Bejelentkezés</p>

        {error && <div style={errorStyle} role="alert">{error}</div>}

        <form onSubmit={onSubmit} style={formStyle}>
          <div>
            <label htmlFor="bbs-username" style={labelStyle}>Felhasználónév vagy e-mail</label>
            <input
              id="bbs-username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="bbs-password" style={labelStyle}>Jelszó</label>
            <input
              id="bbs-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              disabled={busy}
            />
          </div>

          <button type="submit" style={buttonStyle} disabled={busy}>
            {busy ? "Bejelentkezés…" : "Bejelentkezés"}
          </button>
        </form>
      </section>
    </main>
  );
}
