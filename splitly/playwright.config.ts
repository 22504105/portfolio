import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build on its own port. Locally
// they use the Chrome already installed; in CI, the browser Playwright ships.
const PORT = 3300;
const channel = process.env.CI ? undefined : "chrome";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    // A phone first: that is where Splitly lives.
    { name: "phone", use: { ...devices["Pixel 7"], channel } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel, viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    // The suite runs on the demo alone, the same on every machine: whatever .env.local holds is switched off,
    // so no test can reach a real database or bot.
    env: { DATABASE_URL: "", TELEGRAM_BOT_TOKEN: "", SESSION_SECRET: "", TELEGRAM_BOT_USERNAME: "" },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
