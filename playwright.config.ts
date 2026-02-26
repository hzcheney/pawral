import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5180",
    viewport: { width: 1440, height: 900 },
    screenshot: "on",
  },
  webServer: [
    {
      command: "cd packages/server && npx tsx src/index.ts serve --port 3002 --workers 6 --workspace /tmp/pawral-workspaces",
      port: 3002,
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: "cd packages/web && npx vite --port 5180",
      port: 5180,
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  reporter: [["list"]],
  outputDir: "./e2e/results",
});
