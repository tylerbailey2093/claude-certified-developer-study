import { defineConfig } from '@playwright/test';
import fs from 'node:fs';

// E2E runs against the production build under the real GitHub Pages base path,
// because base-path handling (links, manifest, service worker) is where
// regressions have shipped before.
const BASE_PATH = process.env.BASE_PATH || '/claude-certified-developer-study';
const exe = process.env.PW_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
// An empty PW_CHROMIUM_PATH (CI) means: use Playwright's own installed browser.

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:4322${BASE_PATH}/`,
    launchOptions: fs.existsSync(exe) ? { executablePath: exe } : {},
  },
  webServer: {
    command: `npx astro preview --port 4322`,
    url: `http://localhost:4322${BASE_PATH}/`,
    reuseExistingServer: !process.env.CI,
    env: { BASE_PATH },
    timeout: 60_000,
  },
});
