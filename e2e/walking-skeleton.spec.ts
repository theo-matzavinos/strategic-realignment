import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { newPlayerContext } from './access';
import {
  attendees,
  expectNothingClipped,
  fillWhenReady,
  players,
  publicPlayerKeys,
  readViewSnapshot,
  showDay,
  stringsIn,
  viewKeys,
  waitingRoom,
} from './room-page';

const names = ['Ana', 'Ben', 'Chloe', 'Dimitri', 'Eleni'];

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
    await expect(host.getByRole('heading', { level: 1 })).toHaveText(
      'Your release ships in four sprints. One of you would rather it didn’t.',
    );
    await expectNothingClipped(host);
    const create = await fillWhenReady(host, 'New team calendar', { 'Your name': names[0] });
    const created = host.waitForResponse('**/_rpc/lobby/createRoom');
    await create.getByRole('button', { name: 'Create room' }).click();
    const setCookie = (await (await created).allHeaders())['set-cookie'];
    expect(setCookie).toMatch(
      /^sr_session=[\w-]{22}; Path=\/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax$/,
    );

    await expect(host).toHaveURL(/\/rooms\/[A-Z]{4}$/);
    const code = new URL(host.url()).pathname.split('/').at(-1)!;
    await expect(host.getByRole('heading', { level: 1 })).toHaveText(`Team calendar ${code}`);
    await expect(players(host)).toHaveText([/^\s*A\s*Ana \(you, host\)\s*Accepted\s*$/]);
    await expect(waitingRoom(host)).toContainText(`Organizer Ana (you) · join with code ${code}`);
    await expect(waitingRoom(host)).toContainText(
      '4 sprints · 5–10 attendees · one or two of you work for management',
    );

    // Below five players the host can't start, and the invite says how many more it needs.
    await expect(waitingRoom(host)).toContainText('Waiting for at least 4 more. Share the code.');
    await expect(host.getByText('Needs 5 to start.')).toBeVisible();
    await expect(host.getByRole('button', { name: 'Start sprint 1' })).toBeDisabled();
    await expectNothingClipped(host);

    // Four more players join by code, typed in lower case; everyone already in sees each arrival.
    for (let index = 0; index < guests.length; index++) {
      const guest = guests[index];
      await guest.goto('/');
      const join = await fillWhenReady(guest, 'Join with a code', {
        'Room code': code.toLowerCase(),
        'Your name': names[index + 1],
      });

      const clicked = performance.now();
      await join.getByRole('button', { name: 'Join room' }).click();
      await expect(guest).toHaveURL(`/rooms/${code}`);

      const seated = pages.slice(0, index + 2);
      await Promise.all(seated.map((page) => expect(players(page)).toHaveCount(index + 2)));
      const missing = names.length - (index + 2);
      if (missing > 0) {
        await Promise.all(
          seated.map((page) =>
            expect(waitingRoom(page)).toContainText(
              `Waiting for at least ${missing} more. Share the code.`,
            ),
          ),
        );
      }
      test.info().annotations.push({
        type: 'timing',
        description: `join ${index + 2}: click to all ${seated.length} pages ${Math.round(performance.now() - clicked)} ms`,
      });
    }

    for (const page of pages) {
      await expect(players(page)).toContainText(names);
      await expect(page.getByRole('status')).toHaveText('Live');
      await expect(waitingRoom(page).getByText(/^Waiting for at least/)).toHaveCount(0);
      // The room seats up to 10, from rules v0's maxPlayers.
      await expect(waitingRoom(page)).toContainText(
        '4 sprints · 5–10 attendees · one or two of you work for management',
      );
    }
    for (const guest of guests) {
      await expect(waitingRoom(guest)).toContainText(`Organizer Ana · join with code ${code}`);
      await expect(guest.getByText('Waiting for the host to start the game.')).toBeVisible();
      await expect(guest.getByRole('button', { name: 'Start sprint 1' })).toHaveCount(0);
    }
    await expect(host.getByText('Needs 5 to start.')).toHaveCount(0);
    await expectNothingClipped(host);
    await expectNothingClipped(guests[0]);

    // The server refuses a guest's start, even though the page never offers it.
    const refused = await contexts[1].request.post('/_rpc/room/startGame', {
      headers: { Origin: baseURL! },
      data: { input: { code } },
    });
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.code).toBe('NOT_HOST');
    await expect(players(host)).toHaveCount(5);
    await expect(host.getByRole('button', { name: 'Start sprint 1' })).toBeEnabled();

    // Ana starts; every page moves to sprint 1's booking with its own role and hand.
    const started = performance.now();
    await host.getByRole('button', { name: 'Start sprint 1' }).click();
    await Promise.all(
      pages.map(async (page) => {
        await expect(
          page.getByRole('list', { name: 'Sprints' }).locator('[aria-current="step"]'),
        ).toHaveText('Sprint 1 of 4');
        await expect(page.locator('[aria-current="date"]:visible')).toHaveText(
          /^\s*Tue–Wed\s*Contribute\s*$/,
        );
      }),
    );
    test.info().annotations.push({
      type: 'timing',
      description: `start: click to all 5 pages ${Math.round(performance.now() - started)} ms`,
    });

    let plants = 0;
    for (const page of pages) {
      const role = page.getByRole('region', { name: 'Your role' });
      await expect(role).toHaveText(
        /^\s*Your role\s*Only you can see this\s*(Management Plant|Delivery Team)\s*$/,
      );
      if ((await role.textContent())?.includes('Management Plant')) {
        plants++;
      }

      // In Contribute, the hand is where you choose your card.
      await expect(
        page.getByRole('region', { name: 'Your hand · 3 cards' }).getByRole('radio'),
      ).toHaveCount(3);
      await expect(await showDay(page, 'Demand')).toContainText('Required · from Leadership');
      await expect(attendees(page)).toHaveCount(5);
      for (const player of await attendees(page).all()) {
        await expect(player).toContainText('3 cards');
        await expect(player.locator('[data-slot="tag"]')).toHaveText(['Not booked']);
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
      expect(Object.keys(me).sort()).toEqual([
        'contribution',
        'hand',
        'otherPlant',
        'playerId',
        'role',
      ]);
      expect(me['hand']).toHaveLength(3);
      // One Plant at 5 players, so nobody has another Plant to know.
      expect(me['otherPlant']).toBeNull();
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
    const create = await fillWhenReady(ownerPage, 'New team calendar', { 'Your name': 'Ana' });
    await create.getByRole('button', { name: 'Create room' }).click();
    await expect(ownerPage).toHaveURL(/\/rooms\/[A-Z]{4}$/);
    const roomPath = new URL(ownerPage.url()).pathname;

    const page = await outsider.newPage();
    await page.goto(roomPath);
    const join = page.getByRole('region', { name: 'Join this room' });
    await expect(join).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Not in this room');
    await expect(waitingRoom(page)).toHaveCount(0);
    await expect(join.getByLabel('Room code')).toHaveCount(0);
    await expectNothingClipped(page);

    // Joining from the room page seats the outsider and opens the room.
    await join.getByLabel('Your name').fill('Ben');
    await join.getByRole('button', { name: 'Join room' }).click();
    await expect(players(page)).toHaveText([
      /^\s*A\s*Ana \(host\)\s*Accepted\s*$/,
      /^\s*B\s*Ben \(you\)\s*Accepted\s*$/,
    ]);
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

test('a room path that is not a room code says so, with a way back', async ({
  browser,
  baseURL,
}) => {
  const context = await newPlayerContext(browser, baseURL);

  try {
    const page = await context.newPage();
    await page.goto('/rooms/ab1');
    await expect(page.getByRole('heading', { name: "This isn't a room code." })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Not a room code');
    await expect(page.getByRole('button', { name: 'Reconnect' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to the lobby' })).toHaveAttribute(
      'href',
      '/',
    );
    await expectNothingClipped(page);
  } finally {
    await context.close();
  }
});
