import { createFileRoute } from "@tanstack/react-router";
import { StandaloneLogin } from "../StandaloneLogin";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Bejelentkezés — BBS Core" },
      { name: "description", content: "BBS Core bejelentkezés." },
    ],
  }),
  component: StandaloneLogin,
});