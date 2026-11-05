import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: ".", testMatch: "*.spec.mjs", workers: 1, timeout: 30_000,
  outputDir: fileURLToPath(new URL("../../test-results", import.meta.url)),
  use: { baseURL: "http://127.0.0.1:4178", channel: "chrome", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: { command: "pnpm exec vite --config test/section-presentation/vite.config.mjs", cwd: fileURLToPath(new URL("../../", import.meta.url)), url: "http://127.0.0.1:4178", reuseExistingServer: false },
});
