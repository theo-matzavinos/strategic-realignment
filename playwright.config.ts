import { defineConfig } from '@playwright/test';

/**
 * By default the tests run against the production build on workerd (`wrangler dev`), the runtime
 * the app deploys to. `E2E_SERVER=dev` runs them against `ng serve` instead.
 *
 * The servers start with the `node` on PATH, so run Playwright with Node 24 first on PATH.
 */
const dev = process.env['E2E_SERVER'] === 'dev';

let port = 8787;
let command =
  'node node_modules/@angular/cli/bin/ng.js build && ' +
  'node node_modules/wrangler/bin/wrangler.js dev --ip 127.0.0.1 --port 8787';
if (dev) {
  port = 4200;
  command = 'node node_modules/@angular/cli/bin/ng.js serve --host 127.0.0.1 --port 4200';
}

const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL },
  webServer: {
    command,
    url: baseURL,
    env: { NG_CLI_ANALYTICS: 'false', WRANGLER_SEND_METRICS: 'false' },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
