import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Bejelentkezés — BBS Core" },
      { name: "description", content: "BBS Core bejelentkezés." },
    ],
  }),
  component: LoginPage,
});

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
  outline: "1px solid transparent",
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

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem(
      "bbs_session",
      JSON.stringify({ user: username || "admin", token: "placeholder", ts: Date.now() }),
    );
    navigate({ to: "/dashboard" });
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
              value={username}
              onChange={(event) => setUsername(event.target.value)}
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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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