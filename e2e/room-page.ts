import { expect, type Page } from '@playwright/test';

/** The rows of the room page's player list. */
export function players(page: Page) {
  return page.getByRole('region', { name: 'Players' }).getByRole('listitem');
}

/** Waits for the browser app, since the lobby's buttons stay disabled until it runs. */
export async function fillWhenReady(page: Page, region: string, fields: Record<string, string>) {
  const form = page.getByRole('region', { name: region });
  await expect(form.getByRole('button')).toBeEnabled();

  for (const [label, value] of Object.entries(fields)) {
    await form.getByLabel(label, { exact: true }).fill(value);
  }

  return form;
}

/**
 * Reads the first snapshot of this browser's own room.view stream, as the server sends it, so the
 * test sees the whole payload and not only what the page renders.
 */
export async function readViewSnapshot(page: Page, code: string): Promise<Record<string, unknown>> {
  return page.evaluate(async (roomCode) => {
    const response = await fetch('/_rpc/room/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ input: { code: roomCode } }),
    });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          throw new Error(`The stream ended before a snapshot: ${buffer}`);
        }
        buffer += decoder.decode(value, { stream: true });
        const match = /event: value\r?\ndata: (.*)\r?\n\r?\n/.exec(buffer);
        if (match) {
          return JSON.parse(match[1]);
        }
      }
    } finally {
      await reader.cancel();
    }
  }, code);
}

declare global {
  interface Window {
    /** Set by `allowCuttingViewStreams`. */
    cutRoomViewStreams?: () => void;
  }
}

/**
 * Lets `cutViewStreams` drop this page's open room.view streams later. Call it before the page
 * loads: it wraps `fetch`, passing every response through unchanged until a cut.
 */
export async function allowCuttingViewStreams(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const cuts = new Set<() => void>();
    const send = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const response = await send(input, init);
      let url = String(input);
      if (input instanceof Request) {
        url = input.url;
      }
      const isView = new URL(url, location.href).pathname === '/_rpc/room/view';
      if (!isView || response.body === null) {
        return response;
      }

      const body = response.body.pipeThrough(
        new TransformStream({
          start(controller) {
            cuts.add(() => controller.error(new TypeError('The test cut this stream')));
          },
        }),
      );

      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    };

    window.cutRoomViewStreams = () => {
      for (const cut of cuts) {
        cut();
      }
      cuts.clear();
    };
  });
}

/** Drops this page's open room.view streams as a lost connection would: their reads fail. */
export async function cutViewStreams(page: Page): Promise<void> {
  await page.evaluate(() => window.cutRoomViewStreams!());
}

/** Every string anywhere in a JSON value. */
export function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(stringsIn);
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(stringsIn);
  }
  return [];
}

/** The approved PlayerView fields, sorted. */
export const viewKeys = [
  'board',
  'code',
  'demand',
  'lastReveal',
  'me',
  'pastDemands',
  'phase',
  'players',
  'result',
  'retroReady',
  'sprint',
  'version',
  'vote',
];
export const publicPlayerKeys = [
  'handSize',
  'hasContributed',
  'isAudited',
  'isHost',
  'name',
  'playerId',
];
