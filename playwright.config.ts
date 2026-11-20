import { defineConfig, devices } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

const testEnv = dotenv.config({ path: path.resolve(__dirname, "server/.env.test") }).parsed || {};

export default defineConfig({
  testDir: "./e2e/tests",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  outputDir: "./e2e/test-results",
  reporter: [["html", { outputFolder: "./e2e/playwright-report" }]],
  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
    },
  ],
  webServer: [
    {
      command: "bun run --cwd server src/index.ts",
      url: "http://localhost:3001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        ...testEnv,
      },
    },
    {
      command: "bun run --cwd client vite --host 0.0.0.0 --port 5174",
      url: "http://localhost:5174",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        VITE_API_URL: "http://localhost:3001",
      },
    },
  ],
});
