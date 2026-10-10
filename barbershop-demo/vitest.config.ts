import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts", "lib/**/*.test.ts"],
    // The database tests start a real PostgreSQL.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
