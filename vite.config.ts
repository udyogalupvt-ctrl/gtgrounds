import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ command, mode }) => {
  // Expose .env values (GOOGLE_API_KEY, FIREBASE_SERVICE_ACCOUNT, ...) to
  // server-side code during local dev. In production the host (e.g. Vercel)
  // provides these as real environment variables.
  const fileEnv = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(fileEnv)) {
    process.env[key] ??= value;
  }

  const plugins: PluginOption[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
  ];

  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    // No preset pinned: nitro auto-detects the deploy target (Vercel, Node, ...).
    plugins.push(nitro());
  }

  return {
    plugins,
    server: { host: "::", port: 8080 },
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
  };
});
