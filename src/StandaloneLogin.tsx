import { type FormEvent } from "react";

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

const panelStyle = {
  width: "100%",
  maxWidth: "340px",
} as const;

const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
} as const;

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontSize: "14px",
} as const;

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

export function StandaloneLogin() {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "admin");

    localStorage.setItem(
      "bbs_session",
      JSON.stringify({ user: username || "admin", token: "placeholder", ts: Date.now() }),
    );
    window.location.href = "/dashboard";
  };

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <h1 style={{ margin: "0 0 8px", fontSize: "24px", lineHeight: 1.2 }}>BBS Core</h1>
        <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#4b5563" }}>
          Bejelentkezés
        </p>

        <form onSubmit={onSubmit} style={formStyle}>
          <div>
            <label htmlFor="bbs-username" style={labelStyle}>
              Felhasználónév
            </label>
            <input
              id="bbs-username"
              name="username"
              type="text"
              autoComplete="username"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="bbs-password" style={labelStyle}>
              Jelszó
            </label>
            <input
              id="bbs-password"
              name="password"
              type="password"
              autoComplete="current-password"
              style={inputStyle}
            />
          </div>

          <button type="submit" style={buttonStyle}>
            Bejelentkezés
          </button>
        </form>
      </section>
    </main>
  );
}