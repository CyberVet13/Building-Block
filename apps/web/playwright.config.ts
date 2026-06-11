import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration.
 *
 * Setup (run once):
 *   cd apps/web && npx playwright install chromium
 *
 * Run tests:
 *   cd apps/web && npx playwright test
 *   cd apps/web && npx playwright test --ui   # interactive
 *
 * Tests require both servers running:
 *   make api    (port 3001, DEMO_MODE=true)
 *   make web    (port 3000)
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  reporter: [["html", { open: "never" }], ["line"]],
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start both dev servers automatically for CI
  webServer: [
    {
      command: "npx next dev --port 3000",
      port: 3000,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "..\\api\\.venv\\Scripts\\uvicorn build_block.dev_server:app --port 3001",
      cwd: "../api/src",
      port: 3001,
      reuseExistingServer: true,
      timeout: 30_000,
      env: { DEMO_MODE: "true" },
    },
  ],
});
