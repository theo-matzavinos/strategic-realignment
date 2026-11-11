import { defineConfig, type PlaywrightTestConfig } from '@playwright/test';
import { accessHeaders } from './e2e/access';

/**
 * By default the tests run against the production build on workerd (`wrangler dev`), the runtime
 * the app deploys to. `E2E_SERVER=dev` runs them against `ng serve` instead.
 *
 * `E2E_BASE_URL=https://<host>` runs them against a deployment instead, starting no server. Cloudflare
 * Access lets them through with a service token from `CF_ACCESS_CLIENT_ID` and
 * `CF_ACCESS_CLIENT_SECRET`; e2e/access.ts adds it to every browser context.
 *
 * The servers start with the `node` on PATH, so run Playwright with Node 24 first on PATH.
 */
const deployedURL = process.env['E2E_BASE_URL'];
const dev = process.env['E2E_SERVER'] === 'dev';

let port = 8787;
let command =
  'node node_modules/@angular/cli/bin/ng.js build && ' +
  'node node_modules/wrangler/bin/wrangler.js dev --ip 127.0.0.1 --port 8787';
if (dev) {
  port = 4200;
  command = 'node node_modules/@angular/cli/bin/ng.js serve --host 127.0.0.1 --port 4200';
}

const baseURL = deployedURL ?? `http://127.0.0.1:${port}`;

let webServer: PlaywrightTestConfig['webServer'] = {
  command,
  url: baseURL,
  env: { NG_CLI_ANALYTICS: 'false', WRANGLER_SEND_METRICS: 'false' },
  reuseExistingServer: false,
  timeout: 180_000,
};
if (deployedURL) {
  webServer = undefined;
}

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL, extraHTTPHeaders: accessHeaders() },
  webServer,
});
