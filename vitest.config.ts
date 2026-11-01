import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@/": path.join(root, "src") + "/",
      // "server-only" tira error fuera de un Server Component; en tests es un no-op.
      "server-only": path.join(root, "src/test/server-only-stub.ts"),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Los tests de fechas fijan el reloj; la zona del proceso no debe importar
    // (la lógica tiene que usar America/Argentina/Buenos_Aires explícitamente).
    env: { TZ: "UTC" },
  },
});
