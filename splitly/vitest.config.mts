import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: { alias: { "server-only": here("./tests/server-only.ts"), "@": here("./") } },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    // Database tests each start a PostgreSQL of their own; a few at a time is plenty for this machine.
    maxWorkers: 3,
  },
});
