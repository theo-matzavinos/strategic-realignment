import type { Browser, BrowserContext } from '@playwright/test';

/**
 * The Cloudflare Access service-token headers for a deployed run, or none locally. Every request a
 * test makes carries them, so Access lets the test's browsers through without a login.
 */
export function accessHeaders(): Record<string, string> | undefined {
  const id = process.env['CF_ACCESS_CLIENT_ID'];
  const secret = process.env['CF_ACCESS_CLIENT_SECRET'];
  if (!id || !secret) {
    return undefined;
  }

  return { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret };
}

/** A fresh, isolated player: its own cookies, and through Access when the run is deployed. */
export function newPlayerContext(
  browser: Browser,
  baseURL: string | undefined,
): Promise<BrowserContext> {
  return browser.newContext({ baseURL, extraHTTPHeaders: accessHeaders() });
}
