import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build on its own port, in the
// Chrome already installed on the machine (no browser download).
const PORT = 3200;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome", viewport: { width: 1440, height: 900 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" } },
    // Firefox and WebKit (Safari's engine) on request: CROSS_BROWSER=1 npm run test:e2e, after `npx playwright install firefox webkit`.
    ...(process.env.CROSS_BROWSER
      ? [
          { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } } },
          { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
          { name: "iphone", use: { ...devices["iPhone 14"] } },
        ]
      : []),
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // These tests are about the site with no backend, whatever .env.local holds on this machine.
    // Variables that are already set, even to nothing, are not overwritten by the file.
    env: { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
