import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  timeout: 60000,
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
  reporter: "list",
});
