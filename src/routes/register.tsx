import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Regisztráció — BBS Core" },
      { name: "description", content: "BBS Core felhasználói regisztráció." },
    ],
  }),
  component: RegisterDisabled,
});

function RegisterDisabled() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold">Regisztráció letiltva</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A BBS Core v0.2.0-tól a felhasználói fiókokat a rendszergazda hozza
          létre a háttérrendszerben. Az önregisztráció szándékosan ki van
          kapcsolva.
        </p>
        <div className="mt-6">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Vissza a bejelentkezésre
          </Link>
        </div>
      </div>
    </div>
  );
}
