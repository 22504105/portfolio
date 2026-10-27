import { defineConfig } from "@playwright/test";

// End-to-end tests run against a production build on its own port. Locally they
// use the Chrome already installed; in CI, the browser Playwright ships.
const PORT = 3300;
const channel = process.env.CI ? undefined : "chrome";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // A full parallel run loads the machine enough that a client-side navigation can take over the
  // default 5 s (seen on different steps of gate 1, never alone): assertions wait up to 10 s.
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", channel },
  projects: [
    // The student app's reference viewport (390×844) with touch, as inside Telegram.
    { name: "phone", use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
