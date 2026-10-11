import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts", "lib/**/*.test.ts"],
    // The database tests each start a real PostgreSQL. A few at a time: five at
    // once, on a machine that is busy with something else, fail to start in time.
    maxWorkers: 3,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
