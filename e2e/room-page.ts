import { expect, type Locator, type Page } from '@playwright/test';

/** The rows of the waiting list, while the room waits for the host to start. */
export function players(page: Page) {
  return page.getByRole('region', { name: 'Players' }).getByRole('listitem');
}

/** The rows of the attendee list, once the game is on. */
export function attendees(page: Page) {
  return page.getByRole('region', { name: /^Attendees · \d+$/ }).getByRole('listitem');
}

/** Below 1280 px the table is a day view: one day's lane at a time, picked by its tab. */
export function isPhone(page: Page): boolean {
  return page.viewportSize()!.width < 1280;
}

export type DayName = 'Demand' | 'Contribute' | 'Sprint Review' | 'Retro';

/**
 * One day's lane of the week. At phone width it taps the day's tab first, as a player does, since
 * only the selected day shows.
 */
export async function showDay(page: Page, day: DayName): Promise<Locator> {
  if (isPhone(page)) {
    const tab = page
      .getByRole('group', { name: 'Days' })
      .getByRole('button', { name: new RegExp(`${day}$`) });
    if ((await tab.getAttribute('aria-pressed')) !== 'true') {
      await tab.click();
    }
    await expect(tab).toHaveAttribute('aria-pressed', 'true');
  }

  const lane = page.getByRole('region', { name: day, exact: true });
  await expect(lane).toBeVisible();

  return lane;
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

/** The window widths between the phone and the full week, where the day view stretches. */
const middleWidths = [721, 800, 1024, 1279];

/**
 * No text or control on the page is cut off: no text runs past an ancestor that hides overflow (or
 * past the screen, outside a sideways scroller), and no button's or label's content is wider than
 * it. On the day view it checks each day's lane, then returns to the day that was shown. From a desktop
 * width it also checks the widths in between, then restores the window.
 */
export async function expectNothingClipped(page: Page): Promise<void> {
  const viewport = page.viewportSize()!;
  const widths = [viewport.width];
  if (!isPhone(page)) {
    widths.unshift(...middleWidths);
  }

  for (const width of widths) {
    await page.setViewportSize({ width, height: viewport.height });
    const tabs = page.getByRole('group', { name: 'Days' });
    if (!isPhone(page)) {
      expect(await page.evaluate(findClipping), `at ${width} px`).toEqual([]);
      continue;
    }

    const shown = tabs.locator('[aria-pressed="true"]');
    const shownName = (await shown.textContent())!;
    const buttons = tabs.getByRole('button');
    for (let index = 0; index < 4; index++) {
      const day = buttons.nth(index);
      await day.click();
      await expect(day).toHaveAttribute('aria-pressed', 'true');
      const name = await day.textContent();
      expect(await page.evaluate(findClipping), `at ${width} px on ${name}`).toEqual([]);
    }
    const back = buttons.filter({ hasText: shownName });
    await back.click();
    await expect(back).toHaveAttribute('aria-pressed', 'true');
  }
}

/** Runs in the page: a description of each piece of text or control that's cut off. */
function findClipping(): string[] {
  const cut: string[] = [];
  const describe = (element: Element) =>
    `<${element.tagName.toLowerCase()}> ${(element.textContent ?? '').replace(/\s+/g, ' ').trim()}`;
  const isHidden = (element: Element) =>
    element.closest('[aria-hidden="true"]') !== null || !element.checkVisibility();
  const hides = (value: string) => value === 'hidden' || value === 'clip';
  const scrolls = (value: string) => value === 'auto' || value === 'scroll';

  const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let text = texts.nextNode(); text !== null; text = texts.nextNode()) {
    const parent = text.parentElement!;
    const box = parent.getBoundingClientRect();
    // Visually hidden text, such as an sr-only label, is a 1 px box by design.
    if (!text.textContent!.trim() || isHidden(parent) || box.width <= 1 || box.height <= 1) {
      continue;
    }

    const limit = {
      left: 0,
      right: document.documentElement.clientWidth,
      top: -Infinity,
      bottom: Infinity,
    };
    let clipper: Element | null = null;
    for (let node: Element | null = parent; node !== null; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (scrolls(style.overflowX)) {
        limit.left = -Infinity;
        limit.right = Infinity;
      }
      if (
        clipper === null &&
        node !== document.documentElement &&
        (hides(style.overflowX) || hides(style.overflowY))
      ) {
        clipper = node;
      }
    }
    if (clipper !== null) {
      const clip = clipper.getBoundingClientRect();
      limit.left = Math.max(limit.left, clip.left);
      limit.right = Math.min(limit.right, clip.right);
      limit.top = clip.top;
      limit.bottom = clip.bottom;
    }

    const range = document.createRange();
    range.selectNodeContents(text);
    for (const line of range.getClientRects()) {
      const past = Math.max(
        limit.left - line.left,
        line.right - limit.right,
        limit.top - line.top,
        line.bottom - limit.bottom,
      );
      if (line.width > 0 && past > 0.5) {
        cut.push(`${describe(parent)} is cut by ${Math.round(past)} px`);
        break;
      }
    }
  }

  for (const control of document.querySelectorAll('button, label, a, [role="status"]')) {
    if (isHidden(control) || control.getBoundingClientRect().width <= 1) {
      continue;
    }
    const over = control.scrollWidth - control.clientWidth;
    if (over > 0) {
      cut.push(`${describe(control)} overflows by ${over} px`);
    }
  }

  return cut;
}
