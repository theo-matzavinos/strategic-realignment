import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { newPlayerContext } from './access';

const names = ['Ana', 'Ben', 'Chloe', 'Dimitri', 'Eleni'];

function players(page: Page) {
  return page.getByRole('region', { name: 'Players' }).getByRole('listitem');
}

/**
 * Reads the first snapshot of this browser's own room.view stream, as the server sends it, so the
 * test sees the whole payload and not only what the page renders.
 */
async function readViewSnapshot(page: Page, code: string): Promise<Record<string, unknown>> {
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

/** Every string anywhere in a JSON value. */
function stringsIn(value: unknown): string[] {
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

const viewKeys = [
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
const publicPlayerKeys = ['handSize', 'hasContributed', 'isAudited', 'isHost', 'name', 'playerId'];
const secretValues = [
  'plant',
  'delivery',
  'feature',
  'workaround',
  'tests',
  'refactoring',
  'status',
  'workshop',
];

/** Waits for the browser app, since the lobby's buttons stay disabled until it runs. */
async function fillWhenReady(page: Page, region: string, fields: Record<string, string>) {
  const form = page.getByRole('region', { name: region });
  await expect(form.getByRole('button')).toBeEnabled();

  for (const [label, value] of Object.entries(fields)) {
    await form.getByLabel(label, { exact: true }).fill(value);
  }

  return form;
}

test('five isolated players create, join and start a game, each seeing only their own role and hand', async ({
  browser,
  baseURL,
}) => {
  const contexts: BrowserContext[] = [];
  const pageErrors: string[] = [];

  try {
    for (let index = 0; index < names.length; index++) {
      contexts.push(await newPlayerContext(browser, baseURL));
    }
    const pages: Page[] = [];
    for (const context of contexts) {
      const page = await context.newPage();
      page.on('pageerror', (error) => pageErrors.push(error.message));
      pages.push(page);
    }
    const [host, ...guests] = pages;

    // Ana creates the room.
    await host.goto('/');
    const create = await fillWhenReady(host, 'Create a room', { 'Your name': names[0] });
    const created = host.waitForResponse('**/_rpc/lobby/createRoom');
    await create.getByRole('button', { name: 'Create room' }).click();
    const setCookie = (await (await created).allHeaders())['set-cookie'];
    expect(setCookie).toMatch(
      /^sr_session=[\w-]{22}; Path=\/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax$/,
    );

    await expect(host).toHaveURL(/\/rooms\/[A-Z]{4}$/);
    const code = new URL(host.url()).pathname.split('/').at(-1)!;
    await expect(host.getByRole('heading', { level: 1 })).toHaveText(code);
    await expect(players(host)).toHaveText([/^Ana \(host\) \(you\)$/]);

    // Four more players join by code, typed in lower case; everyone already in sees each arrival.
    for (let index = 0; index < guests.length; index++) {
      const guest = guests[index];
      await guest.goto('/');
      const join = await fillWhenReady(guest, 'Join a room', {
        'Room code': code.toLowerCase(),
        'Your name': names[index + 1],
      });

      const clicked = performance.now();
      await join.getByRole('button', { name: 'Join room' }).click();
      await expect(guest).toHaveURL(`/rooms/${code}`);

      const seated = pages.slice(0, index + 2);
      await Promise.all(seated.map((page) => expect(players(page)).toHaveCount(index + 2)));
      test.info().annotations.push({
        type: 'timing',
        description: `join ${index + 2}: click to all ${seated.length} pages ${Math.round(performance.now() - clicked)} ms`,
      });
    }

    for (const page of pages) {
      await expect(players(page)).toContainText(names);
      await expect(page.getByRole('status')).toHaveText('Live');
      await expect(page.getByText('5/7')).toBeVisible();
    }
    for (const guest of guests) {
      await expect(guest.getByText('Waiting for the host to start the game.')).toBeVisible();
      await expect(guest.getByRole('button', { name: 'Start the game' })).toHaveCount(0);
    }

    // The server refuses a guest's start, even though the page never offers it.
    const refused = await contexts[1].request.post('/_rpc/room/startGame', {
      headers: { Origin: baseURL! },
      data: { input: { code } },
    });
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.code).toBe('NOT_HOST');
    await expect(players(host)).toHaveCount(5);
    await expect(host.getByRole('button', { name: 'Start the game' })).toBeEnabled();

    // Ana starts; every page moves to Contribute with its own role and hand.
    const started = performance.now();
    await host.getByRole('button', { name: 'Start the game' }).click();
    await Promise.all(
      pages.map((page) => expect(page.getByText('Sprint 1 · Contribute')).toBeVisible()),
    );
    test.info().annotations.push({
      type: 'timing',
      description: `start: click to all 5 pages ${Math.round(performance.now() - started)} ms`,
    });

    let plants = 0;
    for (const page of pages) {
      const role = page.getByRole('region', { name: 'Your role' });
      await expect(role).toHaveText(/Your role\s*(Management Plant|Delivery Team)/);
      if ((await role.textContent())?.includes('Management Plant')) {
        plants++;
      }

      await expect(
        page.getByRole('region', { name: 'Your hand' }).getByRole('listitem'),
      ).toHaveCount(3);
      await expect(page.getByRole('region', { name: "This sprint's demand" })).not.toBeEmpty();
      await expect(players(page)).toHaveCount(5);
      for (const player of await players(page).all()) {
        await expect(player).toContainText('3 cards · Contributed: no');
      }
    }
    expect(plants).toBe(1);

    // The payload each browser receives holds only that player's view: no other role or hand, no
    // server state, nothing beyond the approved PlayerView fields.
    const sessionIds = (await Promise.all(contexts.map((context) => context.cookies())))
      .flat()
      .filter((cookie) => cookie.name === 'sr_session')
      .map((cookie) => cookie.value);
    expect(sessionIds).toHaveLength(5);

    const seenPlayers = new Set<string>();
    let plantViews = 0;
    for (const page of pages) {
      const view = await readViewSnapshot(page, code);
      expect(Object.keys(view).sort()).toEqual(viewKeys);
      expect(view['phase']).toBe('contribute');

      const { me, ...everythingButMe } = view as { me: Record<string, unknown> };
      expect(Object.keys(me).sort()).toEqual(['contribution', 'hand', 'playerId', 'role']);
      expect(me['hand']).toHaveLength(3);
      seenPlayers.add(me['playerId'] as string);
      if (me['role'] === 'plant') {
        plantViews++;
      }

      for (const player of everythingButMe['players'] as Record<string, unknown>[]) {
        expect(Object.keys(player).sort()).toEqual(publicPlayerKeys);
      }
      const publicStrings = stringsIn(everythingButMe);
      for (const secret of [...secretValues, ...sessionIds]) {
        expect(publicStrings).not.toContain(secret);
      }
      expect(JSON.stringify(view)).not.toMatch(/sr_session|seats|seed/);
    }
    expect(seenPlayers.size).toBe(5);
    expect(plantViews).toBe(1);

    expect(pageErrors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('a browser without a seat gets a join form on the room page, and nothing else', async ({
  browser,
  baseURL,
  request,
}) => {
  const owner = await newPlayerContext(browser, baseURL);
  const outsider = await newPlayerContext(browser, baseURL);

  try {
    const ownerPage = await owner.newPage();
    await ownerPage.goto('/');
    const create = await fillWhenReady(ownerPage, 'Create a room', { 'Your name': 'Ana' });
    await create.getByRole('button', { name: 'Create room' }).click();
    await expect(ownerPage).toHaveURL(/\/rooms\/[A-Z]{4}$/);
    const roomPath = new URL(ownerPage.url()).pathname;

    const page = await outsider.newPage();
    await page.goto(roomPath);
    const join = page.getByRole('region', { name: 'Join this room' });
    await expect(join).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Not in this room');
    await expect(page.getByRole('region', { name: 'Players' })).toHaveCount(0);
    await expect(join.getByLabel('Room code')).toHaveCount(0);

    // Joining from the room page seats the outsider and opens the room.
    await join.getByLabel('Your name').fill('Ben');
    await join.getByRole('button', { name: 'Join room' }).click();
    await expect(players(page)).toHaveText([/^Ana \(host\)$/, /^Ben \(you\)$/]);
    await expect(players(ownerPage)).toHaveCount(2);

    // A refused join sets no cookie: the session cookie follows an accepted seat only. Codes never
    // use I, so this room can't exist.
    const missing = await request.post('/_rpc/lobby/joinRoom', {
      headers: { Origin: baseURL! },
      data: { input: { code: 'IIII', name: 'Chloe' } },
    });
    expect(missing.status()).toBe(404);
    expect((await missing.json()).error.code).toBe('ROOM_NOT_FOUND');
    expect(missing.headers()['set-cookie']).toBeUndefined();
  } finally {
    await Promise.all([owner.close(), outsider.close()]);
  }
});
