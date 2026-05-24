// Standalone SPA build for the Docker/nginx deploy.
// Does NOT use @lovable.dev/vite-tanstack-config — that one targets
// TanStack Start SSR (Cloudflare Workers) and produces a bundle that
// crashes at runtime when served as static files behind nginx.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "src/routes",
      generatedRouteTree: "src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Swap the SSR-flavoured root (uses shellComponent + <Scripts />)
      // for a plain SPA root.
      [path.resolve(__dirname, "src/routes/__root.tsx")]: path.resolve(
        __dirname,
        "src/routes/__root.spa.tsx",
      ),
    },
  },
  build: {
    outDir: "dist-spa",
    emptyOutDir: true,
  },
});
