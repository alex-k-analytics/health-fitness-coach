import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ux-audit",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.UX_AUDIT_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: process.env.UX_AUDIT_BASE_URL ?? "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000
  }
});
