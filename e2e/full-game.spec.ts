import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type Request,
} from '@playwright/test';
import { cardTypes, type CardType } from '../src/game/cards';
import { plantCount, type PlayerId, type Role } from '../src/game/game';
import type { PlayerView } from '../src/game/view';
import {
  cardEffects,
  cardFlavors,
  cardKinds,
  cardNames,
  cardRule,
  cardTags,
  demandNames,
  demandPenalties,
  demandRequirements,
  roleNames,
} from '../src/routes/rooms/$code/display-names';
import { newPlayerContext } from './access';
import {
  allowCuttingViewStreams,
  attendees,
  cutViewStreams,
  expectNothingClipped,
  fillWhenReady,
  players,
  publicPlayerKeys,
  readViewSnapshot,
  showDay,
  stringsIn,
  viewKeys,
} from './room-page';

const shortNames = ['Ana', 'Ben', 'Chloe', 'Dimitri', 'Eleni'];
/** The longest name a player can take, which the 7-player game plays at phone width. */
const longName = 'WWWWWWWWWWWWWWWWWWWW';
const sevenNames = ['Ana', 'Ben', longName, 'Dimitri', 'Eleni', 'Fotis', 'Giorgos'];
const tenNames = [...shortNames, 'Fotis', 'Giorgos', 'Hara', 'Ilias', 'Katerina'];
const phoneWidth = 390;

type Seat = {
  name: string;
  context: BrowserContext;
  page: Page;
  playerId: PlayerId;
  /** The role this player's page showed at the start. */
  role: Role;
};

/** What the server's game must be, from the actions the test took. */
type Expected = {
  version: number;
  phase: PlayerView['phase'];
  sprint: number;
  /** In `contribute`, plays face up this sprint; in `retro`, next sprint. */
  audited: PlayerId | null;
  /** This sprint's placements, in `contribute`. */
  placed: Map<PlayerId, CardType>;
  reveal: { sprint: number; placed: Map<PlayerId, CardType>; audited: PlayerId | null } | null;
  vote: { nominee: PlayerId; votes: Map<PlayerId, boolean> } | null;
  ready: Set<PlayerId>;
};

type Game = {
  code: string;
  baseURL: string;
  seats: Seat[];
  sessionIds: string[];
  expected: Expected;
  /** Each player's payload at the last step, in seat order. */
  views: PlayerView[];
  /** The one refusal message a page shows right now, by its control; every other page shows none. */
  alert: { playerId: PlayerId; message: string } | null;
};

const games = [
  { names: shortNames, width: null, timeout: 360_000 },
  { names: sevenNames, width: phoneWidth, timeout: 720_000 },
  { names: tenNames, width: null, timeout: 2_400_000 },
];

for (const { names, width, timeout } of games) {
  let screen = 'at desktop width';
  if (width !== null) {
    screen = `at ${width} px`;
  }

  test(`${names.length} isolated players play a full game ${screen}, each seeing only their own view at every step`, async ({
    browser,
    baseURL,
  }) => {
    // Every step reads every player's stream and checks every page. Locally that's about 30 s for
    // 5 players and 2 minutes for 7 (up to 4.5 on a loaded machine), since each snapshot's stream
    // lingers on workerd for ~30 s; the timeouts leave room for a slower machine or a deployment.
    // 10 players: two Plants, each of whom sees the other; 12 minutes locally, 17 on a loaded
    // machine, since the calendar table's page checks are heavier than the old panels'.
    test.setTimeout(timeout);
    const contexts: BrowserContext[] = [];
    const pageErrors: string[] = [];

    try {
      const pages: Page[] = [];
      for (let index = 0; index < names.length; index++) {
        const context = await newPlayerContext(browser, baseURL);
        contexts.push(context);
        const page = await context.newPage();
        await allowCuttingViewStreams(page);
        if (width !== null) {
          await page.setViewportSize({ width, height: 844 });
        }
        page.on('pageerror', (error) => pageErrors.push(error.message));
        pages.push(page);
      }

      const game = await openGame(names, contexts, pages, baseURL!);

      for (let sprint = 1; sprint <= 4; sprint++) {
        await playContribute(game, sprint);
        if (sprint < 4) {
          await playRetro(game, sprint);
        }
      }

      await checkEnd(game);
      expect(pageErrors).toEqual([]);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}

/** Creates the room on the first page, joins the others by code, and starts the game. */
async function openGame(
  names: string[],
  contexts: BrowserContext[],
  pages: Page[],
  baseURL: string,
): Promise<Game> {
  const [host, ...guests] = pages;

  await host.goto('/');
  await expectNothingClipped(host);
  const create = await fillWhenReady(host, 'New team calendar', { 'Your name': names[0] });
  await create.getByRole('button', { name: 'Create room' }).click();
  await expect(host).toHaveURL(/\/rooms\/[A-Z]{4}$/);
  const code = new URL(host.url()).pathname.split('/').at(-1)!;
  await expect(players(host)).toHaveCount(1);
  await expectNothingClipped(host);

  for (let index = 0; index < guests.length; index++) {
    const guest = guests[index];
    await guest.goto('/');
    const join = await fillWhenReady(guest, 'Join with a code', {
      'Room code': code,
      'Your name': names[index + 1],
    });
    await join.getByRole('button', { name: 'Join room' }).click();
    await expect(guest).toHaveURL(`/rooms/${code}`);
    await expect(players(guest)).toHaveCount(index + 2);
  }
  await Promise.all(pages.map((page) => expect(players(page)).toHaveCount(names.length)));
  await expectNothingClipped(guests.at(-1)!);
  if (names.length > 7) {
    await expectFitsPhone(guests.at(-1)!);
  }

  await host.getByRole('button', { name: 'Start sprint 1' }).click();
  await Promise.all(pages.map((page) => expect(attendees(page)).toHaveCount(names.length)));

  const sessionIds: string[] = [];
  for (const context of contexts) {
    for (const cookie of await context.cookies()) {
      if (cookie.name === 'sr_session') {
        sessionIds.push(cookie.value);
      }
    }
  }
  expect(sessionIds).toHaveLength(names.length);

  // Each page shows its own role; its stream says the same. One Plant, or two with 8–10 players.
  const seats: Seat[] = [];
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index];
    const role = page.getByRole('region', { name: 'Your role' });
    // checkPage pins the other Plant's name by value at every step.
    await expect(role).toHaveText(
      /^\s*Your role\s*Only you can see this\s*(Management Plant|Delivery Team)(\s*The other Plant:\s*\S[\s\S]*)?\s*$/,
    );
    let shownRole: Role = 'delivery';
    const roleText = await role.textContent();
    if (roleText?.includes(roleNames.plant)) {
      shownRole = 'plant';
    }

    const view = (await readViewSnapshot(page, code)) as PlayerView;
    expect(view.me.role).toBe(shownRole);
    seats.push({
      name: names[index],
      context: contexts[index],
      page,
      playerId: view.me.playerId,
      role: shownRole,
    });
  }
  expect(seats.filter((seat) => seat.role === 'plant')).toHaveLength(plantCount(names.length));

  const game: Game = {
    code,
    baseURL,
    seats,
    sessionIds,
    expected: {
      // 1 for the new room, 1 per join, 1 for the start.
      version: names.length + 1,
      phase: 'contribute',
      sprint: 1,
      audited: null,
      placed: new Map(),
      reveal: null,
      vote: null,
      ready: new Set(),
    },
    views: [],
    alert: null,
  };
  await checkStep(game);

  return game;
}

/** Every player books the first card their page offers; the last booking reveals the sprint. */
async function playContribute(game: Game, sprint: number): Promise<void> {
  const { seats, expected } = game;
  expect(expected.phase).toBe('contribute');
  expect(expected.sprint).toBe(sprint);

  for (let index = 0; index < seats.length; index++) {
    const seat = seats[index];
    const card = game.views[index].me.hand[0];

    const hand = handOf(seat.page);
    const firstCard = hand.getByRole('radio').first();
    await expect(firstCard).toHaveAccessibleName(cardNames[card]);
    await pick(firstCard);
    const book = hand.getByRole('button', { name: `Book ${cardNames[card]}` });
    if (sprint === 1 && index === 0) {
      await expect(book).toBeVisible();
      await expectNothingClipped(seat.page);
      // A Plant's page with every seat, its role box naming the other Plant.
      if (seats.length > 7) {
        await expectFitsPhone(seats.find((other) => other.role === 'plant')!.page);
      }
    }
    if (sprint === 1 && index === 1) {
      await checkPageRefusal(game, seat, book);
    }
    const accepted = await send(seat.page, 'contribute', book);
    game.alert = null;

    expected.version++;
    expect(accepted.version).toBe(expected.version);
    expected.placed.set(seat.playerId, card);
    if (expected.placed.size === seats.length) {
      expected.reveal = { sprint, placed: expected.placed, audited: expected.audited };
      expected.placed = new Map();
      expected.audited = null;
      expected.phase = 'retro';
      if (sprint === 4) {
        expected.phase = 'ended';
      }
    }
    await checkStep(game);

    if (sprint === 1 && index === 0) {
      await checkRefusedContributions(game);
    }
  }
}

/**
 * A refusal the server really makes, shown on the page: the page's own request is rewritten to
 * book a card that isn't in the hand. The message shows by the Book button, and nothing changes.
 */
async function checkPageRefusal(game: Game, seat: Seat, book: Locator): Promise<void> {
  const index = game.seats.indexOf(seat);
  const notInHand = cardTypes.find((card) => !game.views[index].me.hand.includes(card))!;
  const before = game.views;

  await seat.page.route('**/_rpc/room/contribute', async (route) => {
    const body = route.request().postDataJSON();
    body.input.card = notInHand;
    await route.continue({ postData: JSON.stringify(body) });
  });
  const answered = seat.page.waitForResponse('**/_rpc/room/contribute');
  await book.click();
  const response = await answered;
  await seat.page.unroute('**/_rpc/room/contribute');
  expect(response.status()).toBe(409);

  const message = "That card isn't in your hand.";
  game.alert = { playerId: seat.playerId, message };
  await expect(handOf(seat.page).getByRole('alert')).toHaveText(message);
  const after = await checkStep(game);
  expect(after).toEqual(before);
  // A refusal re-enables the control at once.
  await expect(book).toBeEnabled();
}

/** Direct calls the page never makes: the server refuses them with their declared errors. */
async function checkRefusedContributions(game: Game): Promise<void> {
  const [placed, choosing] = game.seats;
  const notInHand = cardTypes.find((card) => !game.views[1].me.hand.includes(card))!;

  await expectRefusal(game, placed, 'contribute', { card: 'feature' }, 409, {
    code: 'ALREADY_CONTRIBUTED',
    message: "You've already placed your card this sprint.",
  });
  await expectRefusal(game, choosing, 'contribute', { card: notInHand }, 409, {
    code: 'CARD_NOT_IN_HAND',
    message: "That card isn't in your hand.",
  });
  await expectRefusal(game, choosing, 'contribute', { card: 'coffee' }, 400, {
    code: 'INVALID_INPUT',
  });
  await expectRefusal(game, choosing, 'nominate', { nominee: placed.playerId }, 409, {
    code: 'WRONG_PHASE',
    message: 'Nominations happen only in the retro.',
  });
}

/**
 * Retro 1 holds a nomination that fails, retro 2 one that passes, retro 3 none. Then everyone
 * marks ready and the next sprint starts.
 */
async function playRetro(game: Game, sprint: number): Promise<void> {
  const { seats, expected } = game;
  expect(expected.phase).toBe('retro');

  if (sprint === 1) {
    const [first, nominator, nominee] = seats;

    await expectRefusal(game, nominator, 'nominate', { nominee: nominator.playerId }, 400, {
      code: 'SELF_NOMINATION',
      message: "You can't nominate yourself.",
    });
    await expectRefusal(game, first, 'vote', { yes: true }, 409, {
      code: 'NO_VOTE_OPEN',
      message: 'There is no audit vote to vote in.',
    });

    // A ready mark before the nomination is cleared by it.
    await markReady(game, first);
    await nominate(game, nominator, nominee);
    expect(expected.ready.size).toBe(0);

    await expectRefusal(game, first, 'finishRetro', {}, 409, {
      code: 'VOTE_OPEN',
      message: 'Wait until everyone has voted before marking ready.',
    });
    await checkDisabledReady(game, first);

    // Only the first two vote yes: not more than half.
    for (let index = 0; index < seats.length; index++) {
      await castVote(game, seats[index], index < 2);
    }
    expect(expected.audited).toBeNull();
  }

  if (sprint === 2) {
    const nominator = seats[3];
    const nominee = seats[1];
    await nominate(game, nominator, nominee);
    await castVoteWithLostResponse(game, seats[0]);
    for (const seat of seats.slice(1)) {
      await castVote(game, seat, true);
    }
    expect(expected.audited).toBe(nominee.playerId);
  }

  for (const seat of seats) {
    if (!expected.ready.has(seat.playerId)) {
      await markReady(game, seat);
    }
  }
}

async function nominate(game: Game, nominator: Seat, nominee: Seat): Promise<void> {
  const retro = await showDay(nominator.page, 'Retro');
  await pick(retro.getByRole('radio', { name: nominee.name, exact: true }));
  const button = retro.getByRole('button', { name: `Nominate ${nominee.name} for an audit` });
  // The button names the nominee, which only shows between picking and sending.
  await expect(button).toBeVisible();
  await expectNoSideScroll(nominator.page);
  await expectNothingClipped(nominator.page);
  const accepted = await send(nominator.page, 'nominate', button);

  game.expected.version++;
  expect(accepted.version).toBe(game.expected.version);
  game.expected.vote = { nominee: nominee.playerId, votes: new Map() };
  game.expected.ready = new Set();
  await checkStep(game);
}

async function castVote(game: Game, seat: Seat, yes: boolean): Promise<void> {
  const { expected, seats } = game;
  const vote = pollOf(await showDay(seat.page, 'Retro'));
  if (expected.vote!.votes.size === 0) {
    await expectNothingClipped(seat.page);
  }
  let button = 'No';
  if (yes) {
    button = 'Yes';
  }
  const accepted = await send(
    seat.page,
    'vote',
    vote.getByRole('button', { name: button, exact: true }),
  );

  expected.version++;
  expect(accepted.version).toBe(expected.version);
  const open = expected.vote!;
  open.votes.set(seat.playerId, yes);
  if (open.votes.size === seats.length) {
    let yesVotes = 0;
    for (const value of open.votes.values()) {
      if (value) {
        yesVotes++;
      }
    }
    if (yesVotes > seats.length / 2) {
      expected.audited = open.nominee;
    }
  }
  await checkStep(game);
}

/**
 * The Ready button looks disabled while a vote is open but stays focusable; clicking it or
 * pressing Enter or Space on it sends nothing.
 */
async function checkDisabledReady(game: Game, seat: Seat): Promise<void> {
  const sent: string[] = [];
  const listener = (request: Request) => {
    if (request.url().endsWith('/_rpc/room/finishRetro')) {
      sent.push(request.url());
    }
  };
  seat.page.on('request', listener);

  const ready = (await showDay(seat.page, 'Retro')).getByRole('button', {
    name: `Ready for sprint ${game.expected.sprint + 1}`,
  });
  await expect(ready).toBeDisabled();
  await ready.click({ force: true });
  await ready.focus();
  await seat.page.keyboard.press('Enter');
  await seat.page.keyboard.press('Space');

  // A step reads every stream and checks every page, which gives a sent request time to show.
  await checkStep(game);
  seat.page.off('request', listener);
  expect(sent).toEqual([]);
}

/**
 * The server applies this vote but its response never reaches the page. With the page's view
 * stream cut first, so the vote can't reach this page by its stream, the buttons are usable again
 * at once with an error, and a retry gets the vote's declared refusal. Once the stream is back,
 * every view matches.
 */
async function castVoteWithLostResponse(game: Game, seat: Seat): Promise<void> {
  const { page } = seat;
  const status = page.getByRole('status');
  await cutViewStreams(page);
  await expect(status).toHaveText('Connection lost');

  const sent: string[] = [];
  const listener = (request: Request) => {
    if (request.url().endsWith('/_rpc/room/vote')) {
      sent.push(request.url());
    }
  };
  page.on('request', listener);
  await page.route('**/_rpc/room/vote', async (route) => {
    await route.fetch();
    await route.abort();
  });

  const vote = pollOf(await showDay(page, 'Retro'));
  const yes = vote.getByRole('button', { name: 'Yes', exact: true });
  const failed = page.waitForEvent('requestfailed', (request) =>
    request.url().endsWith('/_rpc/room/vote'),
  );
  await yes.click();
  await failed;
  await page.unroute('**/_rpc/room/vote');

  await expect(vote.getByRole('alert')).toHaveText("Couldn't reach the server. Try again.");
  await expect(yes).toBeEnabled();
  await expectHeaderFits(page);

  const retried = page.waitForResponse('**/_rpc/room/vote');
  await yes.click();
  const refusal = await retried;
  expect(refusal.status()).toBe(409);
  const body = await refusal.json();
  expect(body.error.code).toBe('ALREADY_VOTED');
  const message = "You've already voted.";
  await expect(vote.getByRole('alert')).toHaveText(message);
  await expect(yes).toBeEnabled();
  page.off('request', listener);
  expect(sent).toHaveLength(2);

  await page.getByRole('button', { name: 'Reconnect' }).click();
  await expect(status).toHaveText('Live');
  await expect(vote).toContainText('You voted Yes.');

  // The vote shows, so the message about it goes; every later step checks it stays gone.
  await expect(vote.getByRole('alert')).toHaveCount(0);
  game.alert = null;
  game.expected.version++;
  game.expected.vote!.votes.set(seat.playerId, true);
  await checkStep(game);
}

async function markReady(game: Game, seat: Seat): Promise<void> {
  const { expected, seats } = game;
  const retro = await showDay(seat.page, 'Retro');
  const accepted = await send(
    seat.page,
    'finishRetro',
    retro.getByRole('button', { name: `Ready for sprint ${expected.sprint + 1}` }),
  );

  expected.version++;
  expect(accepted.version).toBe(expected.version);
  expected.ready.add(seat.playerId);
  if (expected.ready.size === seats.length) {
    expected.phase = 'contribute';
    expected.sprint++;
    expected.vote = null;
    expected.ready = new Set();
    // A message by a retro control goes with the retro.
    game.alert = null;
  }
  await checkStep(game);
}

/** The game always reaches the end of sprint 4, and every page shows the same result. */
async function checkEnd(game: Game): Promise<void> {
  const views = await checkStep(game);
  const plants: [PlayerId, Role][] = [];
  for (const seat of game.seats) {
    if (seat.role === 'plant') {
      plants.push([seat.playerId, 'plant']);
    }
  }

  for (const view of views) {
    expect(view.phase).toBe('ended');
    expect(view.sprint).toBe(4);
    // One passed audit and at most two Morale demands missed: Morale 4 − 3 at worst.
    expect(view.board.morale).toBeGreaterThanOrEqual(1);
    expect(view.result).toEqual(views[0].result);

    const shownPlants = Object.entries(view.result!.roles).filter(([, role]) => role === 'plant');
    expect(shownPlants).toEqual(plants);
  }

  let winnerText = 'The Management Plant wins';
  if (plants.length === 2) {
    winnerText = 'The Management Plants win';
  }
  if (views[0].result!.winner === 'delivery') {
    winnerText = 'The Delivery Team wins';
  }
  for (const seat of game.seats) {
    const board = seat.page.getByRole('region', { name: 'Board' });
    await expect(board).toContainText(winnerText);
  }

  // Every seat's role fits on a phone too, in the invite and on the final board.
  if (game.seats.length > 7) {
    const { page } = game.seats[0];
    const original = page.viewportSize()!;
    await page.setViewportSize({ width: phoneWidth, height: 844 });
    await page
      .getByRole('region', { name: 'Board' })
      .getByRole('button', { name: 'Show result' })
      .click();
    const invite = page.getByRole('dialog');
    await expect(invite.getByRole('list', { name: 'Roles' }).getByRole('listitem')).toHaveCount(
      game.seats.length,
    );
    await expectNothingClipped(page);
    await expectNoSideScroll(page);
    await invite.getByRole('button', { name: 'Back to the board' }).click();
    await expect(invite).toBeHidden();
    await expectNothingClipped(page);
    await expectNoSideScroll(page);
    await page.setViewportSize(original);
  }
}

/**
 * The 10-player game plays at desktop width; this checks a page of it at phone size too, where every
 * seat must still fit: nothing clipped and no sideways scroll. The viewport is restored afterwards.
 */
async function expectFitsPhone(page: Page): Promise<void> {
  const original = page.viewportSize()!;
  await page.setViewportSize({ width: phoneWidth, height: 844 });
  await expectNothingClipped(page);
  await expectNoSideScroll(page);
  await page.setViewportSize(original);
}

/** At phone width nothing, however long, scrolls the page sideways. */
async function expectNoSideScroll(page: Page): Promise<void> {
  if (page.viewportSize()?.width !== phoneWidth) {
    return;
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
}

/**
 * The top bar's room code, current sprint, status and Reconnect each show whole, inside the bar,
 * without overlapping: "Connection lost" and Reconnect are its widest contents.
 */
async function expectHeaderFits(page: Page): Promise<void> {
  const banner = page.getByRole('banner');
  const parts = [
    banner.getByRole('heading', { level: 1 }),
    banner.getByRole('list', { name: 'Sprints' }).locator('[aria-current="step"]'),
    banner.getByRole('status'),
    banner.getByRole('button', { name: 'Reconnect' }),
  ];
  const bar = (await banner.boundingBox())!;
  const boxes: { x: number; y: number; width: number; height: number }[] = [];
  for (const part of parts) {
    const box = (await part.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(bar.x);
    expect(box.x + box.width).toBeLessThanOrEqual(bar.x + bar.width);
    expect(box.y).toBeGreaterThanOrEqual(bar.y);
    expect(box.y + box.height).toBeLessThanOrEqual(bar.y + bar.height);
    for (const other of boxes) {
      const apart =
        box.x >= other.x + other.width ||
        other.x >= box.x + box.width ||
        box.y >= other.y + other.height ||
        other.y >= box.y + box.height;
      expect(apart).toBe(true);
    }
    boxes.push(box);
  }
  await expectNoSideScroll(page);
}

/** Picks a card or player the way a player does: by clicking its tile, the radio's label. */
async function pick(radio: Locator): Promise<void> {
  await radio.locator('xpath=..').click();
  await expect(radio).toBeChecked();
}

/**
 * Clicks a control and waits for the mutation it sends to be answered. Returns the room version the
 * server says the action produced; the caller checks every view then shows that version.
 */
async function send(page: Page, procedure: string, control: Locator): Promise<{ version: number }> {
  const answered = page.waitForResponse(`**/_rpc/room/${procedure}`);
  await control.click();
  const response = await answered;
  expect(response.status(), `${procedure}: ${await response.text()}`).toBe(200);

  const body = await response.json();
  expect(body).toEqual({ version: expect.any(Number) });

  return body;
}

/**
 * A direct call the server refuses with its declared error. Every player's whole view is the same
 * after it as before.
 */
async function expectRefusal(
  game: Game,
  seat: Seat,
  procedure: string,
  input: Record<string, unknown>,
  status: number,
  error: { code: string; message?: string },
): Promise<void> {
  const before = game.views;
  const response = await seat.context.request.post(`/_rpc/room/${procedure}`, {
    headers: { Origin: game.baseURL },
    data: { input: { code: game.code, ...input } },
  });
  expect(response.status()).toBe(status);

  const body = await response.json();
  expect(body.error.code).toBe(error.code);
  if (error.message !== undefined) {
    expect(body.error.message).toBe(error.message);
  }

  const after = await checkStep(game);
  expect(after).toEqual(before);
}

/**
 * One step: reads every browser's own stream payload and checks it against what the test expects
 * and against the hidden-information rules, then checks that every page shows that state.
 */
async function checkStep(game: Game): Promise<PlayerView[]> {
  const raw = await Promise.all(game.seats.map((seat) => readViewSnapshot(seat.page, game.code)));

  const views: PlayerView[] = [];
  for (let index = 0; index < game.seats.length; index++) {
    views.push(checkView(game, game.seats[index], raw[index]));
  }

  await Promise.all(game.seats.map((seat, index) => checkPage(game, seat, views[index])));
  game.views = views;

  return views;
}

function checkView(game: Game, seat: Seat, raw: Record<string, unknown>): PlayerView {
  const { expected, seats } = game;
  const ids = seats.map((other) => other.playerId);
  const json = JSON.stringify(raw);

  // Exactly the PlayerView fields, at every level.
  expect(Object.keys(raw).sort()).toEqual(viewKeys);
  const view = raw as PlayerView;
  expect(Object.keys(view.me).sort()).toEqual([
    'contribution',
    'hand',
    'otherPlant',
    'playerId',
    'role',
  ]);
  expect(Object.keys(view.board).sort()).toEqual([
    'auditsLeft',
    'debt',
    'morale',
    'progress',
    'target',
  ]);
  for (const player of view.players) {
    expect(Object.keys(player).sort()).toEqual(publicPlayerKeys);
  }

  // No server state: seed, deck, seats, session ids, the removed card or anyone's placement.
  expect(json).not.toMatch(
    /"(seed|random|deck|discard|seats|sessionId|removed|contributions|unusedDemands|log)":/,
  );
  for (const sessionId of game.sessionIds) {
    expect(json).not.toContain(sessionId);
  }

  expect(view.code).toBe(game.code);
  expect(view.version).toBe(expected.version);
  expect(view.phase).toBe(expected.phase);
  expect(view.sprint).toBe(expected.sprint);

  // Me.
  expect(view.me.playerId).toBe(seat.playerId);
  expect(view.me.role).toBe(seat.role);
  expect(view.me.otherPlant).toBe(otherPlantOf(game, seat));
  let contribution: CardType | null = null;
  if (expected.phase === 'contribute') {
    contribution = expected.placed.get(seat.playerId) ?? null;
  }
  expect(view.me.contribution).toBe(contribution);

  // Everyone, publicly.
  expect(view.players.map((player) => player.playerId)).toEqual(ids);
  for (let index = 0; index < seats.length; index++) {
    const player = view.players[index];
    const placed = expected.phase === 'contribute' && expected.placed.has(player.playerId);
    let handSize = 2;
    if (expected.phase === 'contribute' && !placed) {
      handSize = 3;
    }

    expect(player.name).toBe(seats[index].name);
    expect(player.isHost).toBe(index === 0);
    expect(player.handSize).toBe(handSize);
    expect(player.hasContributed).toBe(placed);
    expect(player.isAudited).toBe(
      expected.phase !== 'ended' && player.playerId === expected.audited,
    );
  }
  expect(view.me.hand).toHaveLength(view.players[ids.indexOf(seat.playerId)].handSize);

  // No other player's hand, contribution or role outside the fields that may hold cards and roles.
  const { me, lastReveal, result, ...rest } = view;
  const publicStrings = stringsIn(rest);
  for (const secret of [...cardTypes, 'plant', 'delivery']) {
    expect(publicStrings).not.toContain(secret);
  }

  checkReveal(game, seat, view);
  checkVote(game, seat, view);

  let ready: PlayerId[] = [];
  if (expected.phase === 'retro') {
    ready = ids.filter((id) => expected.ready.has(id));
  }
  expect(view.retroReady).toEqual(ready);

  if (expected.phase !== 'ended') {
    expect(view.result).toBeNull();
  } else {
    expect(Object.keys(view.result!).sort()).toEqual(['roles', 'winner']);
    expect(Object.keys(view.result!.roles).sort()).toEqual([...ids].sort());
    for (const other of seats) {
      expect(view.result!.roles[other.playerId]).toBe(other.role);
    }
    expect(['delivery', 'plant']).toContain(view.result!.winner);
  }

  return view;
}

/** The other Plant, by what every page showed at the start: only a Plant in a two-Plant game. */
function otherPlantOf(game: Game, seat: Seat): PlayerId | null {
  if (seat.role !== 'plant') {
    return null;
  }

  for (const other of game.seats) {
    if (other !== seat && other.role === 'plant') {
      return other.playerId;
    }
  }

  return null;
}

/** The reveal holds exactly the placed cards, minus the audited and any removed one. */
function checkReveal(game: Game, seat: Seat, view: PlayerView): void {
  const expected = game.expected.reveal;
  if (expected === null) {
    expect(view.lastReveal).toBeNull();
    return;
  }

  const reveal = view.lastReveal!;
  expect(Object.keys(reveal).sort()).toEqual([
    'audited',
    'cards',
    'mine',
    'oneRemoved',
    'outcome',
    'sprint',
  ]);
  expect(Object.keys(reveal.outcome).sort()).toEqual(['demandMet', 'incident', 'progress']);
  expect(reveal.sprint).toBe(expected.sprint);

  const demands = [...view.pastDemands, view.demand];
  expect(reveal.oneRemoved).toBe(demands[expected.sprint - 1] === 'oneWeekSprint');

  if (expected.audited === null) {
    expect(reveal.audited).toBeNull();
  } else {
    expect(reveal.audited).toEqual({
      playerId: expected.audited,
      card: expected.placed.get(expected.audited),
    });
  }

  // Every revealed card is a face-down placement; under One Week exactly one is missing.
  const unrevealed: CardType[] = [];
  for (const seatOrder of game.seats) {
    if (seatOrder.playerId !== expected.audited) {
      unrevealed.push(expected.placed.get(seatOrder.playerId)!);
    }
  }
  for (const card of reveal.cards) {
    const index = unrevealed.indexOf(card);
    expect(index).not.toBe(-1);
    unrevealed.splice(index, 1);
  }
  let removed = 0;
  if (reveal.oneRemoved) {
    removed = 1;
  }
  expect(unrevealed).toHaveLength(removed);

  const mine = expected.placed.get(seat.playerId)!;
  if (seat.playerId === expected.audited) {
    expect(reveal.mine).toBeNull();
  } else if (reveal.mine === null) {
    // Only the removed card's owner has no card among the revealed ones.
    expect(reveal.oneRemoved).toBe(true);
    expect(unrevealed).toEqual([mine]);
  } else {
    expect(reveal.cards[reveal.mine]).toBe(mine);
  }
}

/** Who has voted shows at once; how anyone voted only once everyone has. */
function checkVote(game: Game, seat: Seat, view: PlayerView): void {
  const { expected, seats } = game;
  if (expected.phase !== 'retro' || expected.vote === null) {
    expect(view.vote).toBeNull();
    return;
  }

  const vote = view.vote!;
  expect(Object.keys(vote).sort()).toEqual(['mine', 'nominee', 'outcome', 'voted']);
  expect(vote.nominee).toBe(expected.vote.nominee);

  const { votes } = expected.vote;
  const voted: PlayerId[] = [];
  const yes: PlayerId[] = [];
  const no: PlayerId[] = [];
  for (const other of seats) {
    if (!votes.has(other.playerId)) {
      continue;
    }
    voted.push(other.playerId);
    if (votes.get(other.playerId)) {
      yes.push(other.playerId);
    } else {
      no.push(other.playerId);
    }
  }
  expect(vote.voted).toEqual(voted);
  expect(vote.mine).toBe(votes.get(seat.playerId) ?? null);

  if (voted.length < seats.length) {
    expect(vote.outcome).toBeNull();
  } else {
    expect(vote.outcome).toEqual({ passed: yes.length > seats.length / 2, yes, no });
  }
}

/** The page shows the state its own stream payload holds. */
async function checkPage(game: Game, seat: Seat, view: PlayerView): Promise<void> {
  const { page } = seat;
  const nameOf = (playerId: PlayerId) =>
    game.seats.find((other) => other.playerId === playerId)!.name;
  const namesOf = (playerIds: PlayerId[]) => {
    if (playerIds.length === 0) {
      return 'nobody';
    }
    return playerIds.map(nameOf).join(', ');
  };

  // After the game, the result covers the board: check it first, then go back to the board.
  if (view.phase === 'ended') {
    await checkEndInvite(page, view, nameOf);
  }

  // Where the table is: the sprint, and the day the phase is on.
  await expect(
    page.getByRole('list', { name: 'Sprints' }).locator('[aria-current="step"]'),
  ).toHaveText(`Sprint ${view.sprint} of 4`);
  await expect(page.locator('[aria-current="date"]:visible')).toHaveText(currentDay(view));

  // Your role box holds exactly your role, and names the other Plant only to a Plant in a two-Plant
  // game.
  const role = page.getByRole('region', { name: 'Your role' });
  let otherPlantLine = '';
  if (view.me.otherPlant === null) {
    await expect(role).not.toContainText('other Plant');
  } else {
    await expect(role).toContainText(`The other Plant: ${nameOf(view.me.otherPlant)}`);
    otherPlantLine = `\\s*The other Plant:\\s*${escaped(nameOf(view.me.otherPlant))}`;
  }
  await expect(role).toHaveText(
    new RegExp(
      `^\\s*Your role\\s*Only you can see this\\s*${roleNames[seat.role]}${otherPlantLine}\\s*$`,
    ),
  );

  const { board } = view;
  await expect(page.getByRole('region', { name: 'Board' })).toHaveText(
    new RegExp(
      `^\\s*Progress\\s*${board.progress}\\s*/\\s*${board.target} target\\s*Morale\\s*${board.morale}\\s*` +
        `Debt\\s*${board.debt}\\s*incident at 3\\s*Audits left\\s*${board.auditsLeft}\\s*`,
    ),
  );

  // Attendees, in seat order: each row holds exactly that player's name, hand size and state tags,
  // and the tags are tag elements.
  const rows: RegExp[] = [];
  const tags: string[] = [];
  for (const player of view.players) {
    rows.push(attendeeRow(view, player));
    tags.push(...attendeeTags(view, player));
  }
  await expect(attendees(page)).toHaveText(rows);
  await expect(attendees(page).locator('[data-slot="tag"]')).toHaveText(tags);

  await expectNoSideScroll(page);

  // The one refusal message showing, by its control, or none.
  const alerts = page.getByRole('alert');
  if (game.alert?.playerId === seat.playerId) {
    await expect(alerts).toHaveText([game.alert.message]);
  } else {
    await expect(alerts).toHaveCount(0);
  }

  // Monday: the demand, and the earlier ones.
  const demand = await showDay(page, 'Demand');
  if (view.demand !== null) {
    await expect(demand).toContainText(demandNames[view.demand]);
    await expect(demand).toContainText(demandRequirements[view.demand]);
    const penalty = demandPenalties[view.demand];
    if (penalty !== null) {
      await expect(demand).toContainText(`If missed: ${penalty}.`);
    }
  }
  const earlier: string[] = [];
  for (let index = 0; index < view.pastDemands.length; index++) {
    earlier.push(`Sprint ${index + 1}: ${demandNames[view.pastDemands[index]]}`);
  }
  await expect(demand.getByRole('listitem')).toHaveText(earlier);

  // Tuesday to Wednesday: one slot per player in seat order, showing only whether they booked.
  const slots: (string | RegExp)[] = [];
  for (const player of view.players) {
    slots.push(slotText(view, player));
  }
  await expect((await showDay(page, 'Contribute')).getByRole('listitem')).toHaveText(slots);

  // Your hand, and the booking action.
  const hand = handOf(page);
  await expect(hand.getByRole('heading')).toHaveText(
    new RegExp(`^\\s*Your hand · ${view.me.hand.length} cards`),
  );
  if (view.phase === 'contribute' && view.me.contribution === null) {
    const radios = hand.getByRole('radio');
    await expect(radios).toHaveCount(view.me.hand.length);
    for (let index = 0; index < view.me.hand.length; index++) {
      await expect(radios.nth(index)).toHaveAccessibleName(cardNames[view.me.hand[index]]);
      // The rule, the Workshop's cost included, is announced with the choice.
      const card = view.me.hand[index];
      await expect(radios.nth(index)).toHaveAccessibleDescription(
        [cardEffects[card], cardTags[card]].filter((part) => part !== null).join(' '),
      );
    }
    // Each choice shows the whole card face, effect and footer included, as the hand does.
    await expect(hand.locator('label')).toHaveText(view.me.hand.map((card) => cardText(card)));
    const meAudited = view.players.find((player) => player.playerId === seat.playerId)!.isAudited;
    if (meAudited) {
      await expect(hand).toContainText("You're audited this sprint");
    } else {
      await expect(hand).not.toContainText("You're audited this sprint");
    }
  } else {
    await expect(hand.getByRole('radio')).toHaveCount(0);
    await expect(hand.getByRole('listitem')).toHaveText(view.me.hand.map((card) => cardText(card)));
  }
  if (view.phase === 'contribute' && view.me.contribution !== null) {
    const waiting = view.players.filter((player) => !player.hasContributed);
    await expect(hand).toContainText(
      `You booked ${cardNames[view.me.contribution]}. Waiting on: ` +
        `${namesOf(waiting.map((player) => player.playerId))}.`,
    );
  }

  // Thursday: the reveal, during the retro and after the game.
  const review = await showDay(page, 'Sprint Review');
  const revealed = review.getByRole('list', { name: 'Revealed cards' }).getByRole('listitem');
  if (view.phase === 'contribute' || view.lastReveal === null) {
    await expect(revealed).toHaveCount(0);
  } else {
    const { lastReveal } = view;
    // One row per card in the payload's order, yours marked on the row the payload says, then the
    // audited card, attributed, and the removed one.
    const expectedRows: string[] = [];
    for (let index = 0; index < lastReveal.cards.length; index++) {
      const card = lastReveal.cards[index];
      if (index === lastReveal.mine) {
        expectedRows.push(`${cardNames[card]} You · ${cardRule(card)}`);
      } else {
        expectedRows.push(`${cardNames[card]} ${cardRule(card)}`);
      }
    }
    if (lastReveal.audited !== null) {
      const { card, playerId } = lastReveal.audited;
      expectedRows.push(`${cardNames[card]} ${nameOf(playerId)} · audited · ${cardRule(card)}`);
    }
    if (lastReveal.oneRemoved) {
      expectedRows.push('1 removed, unseen');
    }
    await expect(revealed).toHaveText(expectedRows);
    // Every revealed or audited Workshop shows its cost, whoever holds one.
    const workshops = revealed.filter({ hasText: cardNames.workshop });
    await expect(workshops.filter({ hasNotText: 'Other cards −2 Progress' })).toHaveCount(0);
    let marked = 1;
    if (lastReveal.mine === null) {
      marked = 0;
    }
    await expect(review.getByText(/^\s*You · /)).toHaveCount(marked);

    const { outcome } = lastReveal;
    let demandOutcome: RegExp = /^\s*No requirement\s*$/;
    if (outcome.demandMet === true) {
      demandOutcome = /^\s*Met\s*$/;
    }
    if (outcome.demandMet === false) {
      demandOutcome = /^\s*Missed: (−1 Morale|\+2 Debt)\s*$/;
    }
    let incident = 'None';
    if (outcome.incident) {
      incident = '−5 Progress, −3 Debt';
    }
    await expect(review.getByRole('definition')).toHaveText([
      `+${outcome.progress}`,
      demandOutcome,
      incident,
    ]);

    // Only the removed card's owner: no revealed card is theirs, and they weren't audited.
    const ownerLine = 'Your card was the one removed: none of the revealed cards is yours.';
    const removedWasMine =
      lastReveal.oneRemoved &&
      lastReveal.mine === null &&
      lastReveal.audited?.playerId !== seat.playerId;
    if (removedWasMine) {
      await expect(review).toContainText(ownerLine);
    } else {
      await expect(review).not.toContainText(ownerLine);
    }
  }

  // Friday: the retro.
  if (view.phase === 'retro') {
    const retro = await showDay(page, 'Retro');
    const { vote } = view;

    if (vote === null) {
      await expect(retro.getByRole('button', { name: /^Nominate/ })).toBeVisible();
    } else {
      const poll = retro.getByRole('region', { name: `Audit ${nameOf(vote.nominee)}?` });
      await expect(poll).toContainText(
        `Yes needs more than half: ${Math.floor(view.players.length / 2) + 1} of ${view.players.length}.`,
      );
      if (vote.outcome === null) {
        await expect(poll).toContainText(
          `${vote.voted.length} of ${view.players.length} have voted. Votes show once everyone is in.`,
        );
      } else {
        let outcome = 'The audit failed.';
        if (vote.outcome.passed) {
          outcome = 'The audit passed.';
        }
        await expect(poll).toContainText(outcome);
        await expect(poll).toContainText(`Yes: ${namesOf(vote.outcome.yes)}`);
        await expect(poll).toContainText(`No: ${namesOf(vote.outcome.no)}`);
      }
      if (vote.mine === null) {
        await expect(poll.getByRole('button', { name: 'Yes', exact: true })).toBeEnabled();
      } else {
        let mine = 'No';
        if (vote.mine) {
          mine = 'Yes';
        }
        await expect(poll).toContainText(`You voted ${mine}.`);
        await expect(poll.getByRole('button')).toHaveCount(0);
      }
    }

    const audited = view.players.find((player) => player.isAudited);
    if (audited !== undefined) {
      await expect(retro).toContainText(`${audited.name} plays face up next sprint.`);
    }

    if (view.retroReady.includes(seat.playerId)) {
      await expect(retro).toContainText("You're ready.");
    } else {
      const ready = retro.getByRole('button', { name: `Ready for sprint ${view.sprint + 1}` });
      const voteOpen = vote !== null && vote.outcome === null;
      if (voteOpen) {
        await expect(ready).toBeDisabled();
      } else {
        await expect(ready).toBeEnabled();
      }
    }
  }

  if (view.phase === 'ended') {
    const retro = await showDay(page, 'Retro');
    if (view.vote === null) {
      await expect(retro).toContainText('No retro: the game is over.');
    } else {
      await expect(retro).toContainText('The game ended on this audit: Morale reached 0.');
    }
  }
}

/**
 * The end-of-game invite: it opens by itself, or from "Show result" once closed. It names the
 * winner and every role, then "Back to the board" closes it.
 */
async function checkEndInvite(
  page: Page,
  view: PlayerView,
  nameOf: (playerId: PlayerId) => string,
): Promise<void> {
  const result = view.result!;
  let plants = 0;
  for (const role of Object.values(result.roles)) {
    if (role === 'plant') {
      plants++;
    }
  }
  let title = 'Strategic Realignment: an exciting new chapter';
  let winner = 'the Management Plant wins.';
  if (plants === 2) {
    winner = 'the Management Plants win.';
  }
  if (result.winner === 'delivery') {
    title = 'Q3 Platform Excellence has shipped';
    winner = 'the Delivery Team wins.';
  }

  const invite = page.getByRole('dialog', { name: title });
  if (!(await invite.isVisible())) {
    await page
      .getByRole('region', { name: 'Board' })
      .getByRole('button', { name: 'Show result' })
      .click();
  }
  await expect(invite).toBeVisible();
  await expect(invite).toContainText(`Result: ${winner}`);

  const roles: RegExp[] = [];
  for (const player of view.players) {
    const name = nameOf(player.playerId);
    const role = roleNames[result.roles[player.playerId]];
    roles.push(
      new RegExp(
        `^\\s*${escaped(Array.from(name)[0])}\\s*${escaped(name)}\\s*(\\(you\\))?\\s*${role}\\s*$`,
      ),
    );
  }
  await expect(invite.getByRole('list', { name: 'Roles' }).getByRole('listitem')).toHaveText(roles);
  await expect(invite.getByRole('link', { name: 'New room' })).toHaveAttribute('href', '/');
  await expectInviteScrolls(page, invite);

  await invite.getByRole('button', { name: 'Back to the board' }).click();
  await expect(invite).toBeHidden();
}

/**
 * On a short screen, portrait or landscape, the invite opens at its title and a wheel scroll reaches
 * its footer: the invite scrolls itself rather than clipping. The viewport is restored afterwards.
 */
async function expectInviteScrolls(page: Page, invite: Locator): Promise<void> {
  const original = page.viewportSize()!;
  const footer = invite.getByRole('button', { name: 'Back to the board' });
  for (const size of [
    { width: 390, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await invite.evaluate((dialog) => dialog.scrollTo(0, 0));
    await expect(invite.getByRole('heading', { level: 2 })).toBeInViewport();
    expect(await invite.evaluate((dialog) => dialog.scrollHeight > dialog.clientHeight)).toBe(true);
    await invite.hover({ position: { x: 20, y: 20 } });
    await page.mouse.wheel(0, 3000);
    await expect(footer).toBeInViewport();
  }
  await page.setViewportSize(original);
}

/** The day the phase is on: booking on Tue–Wed, the reveal on Thursday, a vote on Friday. */
function currentDay(view: PlayerView): RegExp {
  if (view.phase === 'contribute') {
    return /^\s*Tue–Wed\s*Contribute\s*$/;
  }
  if (view.vote === null) {
    return /^\s*Thu\s*Sprint Review\s*$/;
  }
  return /^\s*Fri\s*Retro\s*$/;
}

/** An attendee row: initial, name, "(you)", "host", hand size, then exactly its state tags. */
function attendeeRow(view: PlayerView, player: PlayerView['players'][number]): RegExp {
  let you = '';
  if (player.playerId === view.me.playerId) {
    you = '\\s*\\(you\\)';
  }
  let host = '';
  if (player.isHost) {
    host = '\\s*host ·';
  }
  const initial = Array.from(player.name)[0].toUpperCase();
  const tags = attendeeTags(view, player).map(escaped).join('\\s*');

  return new RegExp(
    `^\\s*${escaped(initial)}\\s*${escaped(player.name)}${you}${host}\\s*` +
      `${player.handSize} cards\\s*${tags}\\s*$`,
  );
}

/** An attendee's public state tags in this phase. */
function attendeeTags(view: PlayerView, player: PlayerView['players'][number]): string[] {
  const tags: string[] = [];
  if (view.phase === 'contribute') {
    if (player.hasContributed) {
      tags.push('Booked');
    } else {
      tags.push('Not booked');
    }
  }
  if (view.phase === 'retro') {
    const { vote } = view;
    const voteOpen = vote !== null && vote.outcome === null;
    if (voteOpen && vote.nominee === player.playerId) {
      tags.push('Nominee');
    }
    if (voteOpen && vote.voted.includes(player.playerId)) {
      tags.push('Voted');
    } else if (voteOpen) {
      tags.push('Voting…');
    } else if (view.retroReady.includes(player.playerId)) {
      tags.push('Ready');
    } else {
      tags.push('Not ready');
    }
  }
  if (view.phase === 'ended') {
    tags.push(roleNames[view.result!.roles[player.playerId]]);
  }
  if (player.isAudited) {
    tags.push('Audited');
  }
  return tags;
}

/** A Tue–Wed slot: "Busy" or "Open" for others, the audited player named, your own card once booked. */
function slotText(view: PlayerView, player: PlayerView['players'][number]): string | RegExp {
  if (view.phase !== 'contribute') {
    return 'Busy';
  }

  if (player.playerId === view.me.playerId) {
    const card = view.me.contribution;
    if (card === null && player.isAudited) {
      return 'Your slot · audited, books face up';
    }
    if (card === null) {
      return 'Your slot';
    }
    let audited = '';
    if (player.isAudited) {
      audited = '\\s*· audited, face up';
    }
    return new RegExp(
      `^\\s*Your slot${audited}\\s*${escaped(cardNames[card])}\\s*${escaped(cardEffects[card])}\\s*$`,
    );
  }

  if (player.isAudited && player.hasContributed) {
    return `${player.name} · audited, booked face up`;
  }
  if (player.isAudited) {
    return `${player.name} · audited, books face up`;
  }
  if (player.hasContributed) {
    return 'Busy · private';
  }
  return 'Open';
}

/** The tray's hand region, named for the cards it holds. */
function handOf(page: Page): Locator {
  return page.getByRole('region', { name: /^Your hand · \d+ cards/ });
}

/** The audit poll in the retro's lane. */
function pollOf(retro: Locator): Locator {
  return retro.getByRole('region', { name: /^Audit .+\?$/ });
}

/** A card's face: its band, name, effect, flavor line and footer tag. */
function cardText(card: CardType): RegExp {
  let tag = '';
  if (cardTags[card] !== null) {
    tag = `\\s*${escaped(cardTags[card])}`;
  }

  return new RegExp(
    `^\\s*${escaped(cardKinds[card])}\\s*Contribution\\s*${escaped(cardNames[card])}\\s*` +
      `${escaped(cardEffects[card])}\\s*“${escaped(cardFlavors[card])}”${tag}\\s*$`,
  );
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
