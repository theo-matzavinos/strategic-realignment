import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import type { CardType } from '../src/game/cards';
import type { PlayerView } from '../src/game/view';
import { cardNames, cardRule, demandNames } from '../src/routes/rooms/$code/display-names';
import { newPlayerContext } from './access';
import { attendees, fillWhenReady, players, readViewSnapshot, showDay } from './room-page';

const names = ['Ana', 'Ben', 'Chloe', 'Dimitri', 'Eleni'];

/** One moment as the page played it: a CSS animation or transition starting, or a script animation. */
type Played = { kind: 'animation' | 'transition' | 'script'; name: string; text: string };

declare global {
  interface Window {
    /** Every moment the page played since it loaded, in order. Set by `recordMoments`. */
    played?: Played[];
    /** Every script animation the page started, by name, to check later how it ended. */
    moves?: { name: string; animation: Animation }[];
  }
}

/**
 * With motion on, one sprint's moments play on the changes a page receives, in the order the brief
 * sets, without taking focus or holding up a control. The reveal turns its rows over in the order of
 * the payload's `lastReveal.cards`. A reload plays nothing.
 */
test('the moments play on received changes, keep every control usable, and turn the reveal over in the payload’s order', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const contexts: BrowserContext[] = [];
  const pageErrors: string[] = [];

  try {
    const pages: Page[] = [];
    for (let index = 0; index < names.length; index++) {
      const context = await newPlayerContext(browser, baseURL, {
        reducedMotion: 'no-preference',
        viewport: { width: 1440, height: 900 },
      });
      contexts.push(context);
      await recordMoments(context);
      const page = await context.newPage();
      page.on('pageerror', (error) => pageErrors.push(error.message));
      pages.push(page);
    }
    const [watcher, ...others] = pages;
    const code = await openGame(pages);
    const reminder = watcher.locator('app-reminder');

    // Booking. Ben books: his slot settles in as Busy on Ana's screen.
    await book(others[0]);
    await expect.poll(() => namesPlayed(watcher, 'animation')).toContain('settle');
    // Ana books: the card she picked flies from her hand into her slot, and nothing is left over.
    const booked = await book(watcher);
    const slots = (await showDay(watcher, 'Contribute')).getByRole('listitem');
    await expect(slots.first()).toHaveText(new RegExp(`^\\s*Your slot\\s*${cardNames[booked]}`));
    await expect.poll(() => scriptsPlayed(watcher)).toContain('flight');
    await expect(watcher.locator('body > [data-slot="card"]')).toHaveCount(0);
    await book(others[1]);
    await book(others[2]);

    // Ana's focus is on the copy button when the last booking reveals the sprint.
    const copy = watcher.getByRole('button', { name: 'Copy room code' });
    await copy.focus();
    await clearPlayed(watcher);
    await book(others[3]);

    // The reveal's Reminder: it doesn't take focus, and the rows wait face down under it. These
    // checks are quick: the Reminder closes by itself after 2.5 s.
    await expect(reminder).toContainText('Now · Thursday');
    await expect(reminder).toContainText(/Sprint Review\s*\d contributions, shuffled\. Turning/);
    await expect(copy).toBeFocused();
    expect(await namesPlayed(watcher, 'animation')).not.toContain('turn');

    // A control beside the Reminder works at once, and the same press closes it.
    const retro = await showDay(watcher, 'Retro');
    const nominee = retro.getByRole('radio', { name: names[4], exact: true });
    await expect(reminder.getByRole('button', { name: 'Dismiss' })).toBeVisible();
    await nominee.locator('xpath=..').click();
    await expect(nominee).toBeChecked();
    await expect(reminder.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);

    const view = (await readViewSnapshot(watcher, code)) as PlayerView;
    const reveal = view.lastReveal!;
    const review = await showDay(watcher, 'Sprint Review');
    const rows = review.getByRole('list', { name: 'Revealed cards' }).getByRole('listitem');
    const payloadRows = revealRows(reveal);
    await expect(rows).toHaveText(payloadRows);

    // Then the columns re-flow and the rows turn over one by one, in the payload's order only.
    await expect.poll(() => rowsTurnedSoFar(watcher, payloadRows)).toEqual(payloadRows);
    expect(await scriptsPlayed(watcher)).toContain('reflow');
    await expect(watcher.locator('[aria-current="date"]:visible')).toHaveText(/Sprint Review/);
    await expect(review.getByRole('definition').first()).toHaveText(`+${reveal.outcome.progress}`);
    await expect.poll(() => namesPlayed(watcher, 'animation')).toContain('count');
    // The Progress bar fills with the notes, when the sprint moved it.
    if (view.board.progress > 0) {
      await expect.poll(() => namesPlayed(watcher, 'transition')).toContain('scale');
    }
    if (reveal.outcome.incident) {
      expect(await scriptsPlayed(watcher)).toContain('shake');
    }

    // The vote: Ana nominates; the last vote, someone else's, lands as a stamp on Ana's poll.
    await send(watcher, 'nominate', retro.getByRole('button', { name: /^Nominate/ }));
    const poll = retro.getByRole('region', { name: `Audit ${names[4]}?` });
    await send(watcher, 'vote', poll.getByRole('button', { name: 'Yes', exact: true }));
    for (let index = 0; index < others.length; index++) {
      const page = others[index];
      const theirPoll = (await showDay(page, 'Retro')).getByRole('region', { name: /^Audit / });
      const yes = index < 2;
      let answer = 'No';
      if (yes) {
        answer = 'Yes';
      }
      if (index === others.length - 1) {
        await clearPlayed(watcher);
      }
      await send(page, 'vote', theirPoll.getByRole('button', { name: answer, exact: true }));
    }
    await expect(poll).toContainText('The audit passed.');
    await expect.poll(() => namesPlayed(watcher, 'animation')).toContain('stamp');
    // A Morale pip drains.
    await expect(watcher.getByRole('region', { name: 'Board' })).toContainText(
      new RegExp(`Morale\\s*${view.board.morale - 1}`),
    );
    await expect.poll(() => namesPlayed(watcher, 'transition')).toContain('scale');

    // Ready: Ana first, so the new sprint reaches her as a change.
    await send(watcher, 'finishRetro', retro.getByRole('button', { name: 'Ready for sprint 2' }));
    await clearPlayed(watcher);
    for (const page of others) {
      await send(
        page,
        'finishRetro',
        (await showDay(page, 'Retro')).getByRole('button', { name: 'Ready for sprint 2' }),
      );
    }

    // The week slides on, and a Reminder announces the new demand on every screen. These checks are
    // quick: the Reminder closes by itself after 2.5 s.
    const [waits, dismisses, escapes] = others.map((page) => page.locator('app-reminder'));
    await Promise.all(
      [reminder, waits, dismisses, escapes].map((each) =>
        expect(each).toContainText('Now · Monday · Sprint 2'),
      ),
    );
    const announced = await reminder.textContent();
    expect(await scriptsPlayed(watcher)).toContain('slide');
    // Every way to close it: Dismiss, Esc, a press on a control, and by itself.
    await dismisses.getByRole('button', { name: 'Dismiss' }).click();
    await expect(dismisses.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
    await others[2].keyboard.press('Escape');
    await expect(escapes.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
    // Booking works while it shows.
    await expect(reminder.getByRole('button', { name: 'Dismiss' })).toBeVisible();
    await book(watcher);
    await expect(reminder.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
    await expect(waits.getByRole('button', { name: 'Dismiss' })).toHaveCount(0, { timeout: 4_000 });
    const next = (await readViewSnapshot(watcher, code)) as PlayerView;
    expect(announced).toContain(demandNames[next.demand!]);

    // A reload renders the settled state and plays nothing.
    await others[3].reload();
    await expect(attendees(others[3])).toHaveCount(names.length);
    await others[3].waitForTimeout(1_000);
    expect(await others[3].evaluate(() => window.played)).toEqual([]);
    await expect(others[3].locator('app-reminder')).toBeEmpty();

    expect(pageErrors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

/**
 * At phone width the Reminder's card and the reduced-motion banner let presses through: a tap over
 * either reaches the control under it at once, and the same tap closes the Reminder.
 */
test('at phone width, a tap over the Reminder reaches the control under it', async ({
  browser,
  baseURL,
}) => {
  const context = await newPlayerContext(browser, baseURL, {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const watcher = await context.newPage();
  const { code, seats } = await startTable(browser, baseURL, watcher);

  try {
    const reminder = watcher.locator('[data-slot="reminder"]');

    // Under reduced motion the reveal's Reminder is a banner under the top bar, over the day tabs.
    await bookAll(seats, code);
    await expect(reminder).toContainText('Sprint Review');
    const retro = watcher
      .getByRole('group', { name: 'Days' })
      .getByRole('button', { name: /Retro$/ });
    await expect(retro).toHaveAttribute('aria-pressed', 'false');
    await tapThrough(watcher, reminder, retro);
    await expect(retro).toHaveAttribute('aria-pressed', 'true');
    await expect(reminder).toHaveCount(0);

    // With motion, on a shorter screen, the next sprint's Reminder card sits over the hand.
    await watcher.emulateMedia({ reducedMotion: 'no-preference' });
    await watcher.setViewportSize({ width: 390, height: 600 });
    await allReady(seats, code);
    const demand = reminderSaying(watcher, 'Now · Monday · Sprint 2');
    await expect(demand).toBeVisible();
    // Measured once it has arrived.
    await expect.poll(() => runningAnimations(watcher)).not.toContain('reminder');
    const hand = watcher.getByRole('region', { name: /^Your hand/ });
    const covered = await coveredRadio(demand, hand.getByRole('radio'));
    await expect(covered).not.toBeChecked();
    await tapThrough(watcher, demand, covered.locator('xpath=..'));
    await expect(covered).toBeChecked();
    await expect(reminder).toHaveCount(0);
  } finally {
    await closeAll(context, seats);
  }
});

/**
 * Turning reduced motion on mid-game settles the moment at once: the held reveal lets go, the
 * Reminder becomes the banner, and nothing keeps moving. Turning it off moves only later moments:
 * neither the reveal nor a settled new sprint plays again.
 */
test('turning reduced motion on settles the moment at once, and turning it off replays nothing', async ({
  browser,
  baseURL,
}) => {
  const context = await motionContext(browser, baseURL);
  const watcher = await context.newPage();
  const { code, seats } = await startTable(browser, baseURL, watcher);

  try {
    const reminder = watcher.locator('[data-slot="reminder"]');
    const review = watcher.getByRole('region', { name: 'Sprint Review', exact: true });

    // The reveal is held behind its Reminder: the week keeps Tue–Wed's columns.
    await bookAll(seats, code);
    await expect(reminder).toContainText('Closes by itself');
    expect(await weekColumns(watcher)).toBe('1.1fr 2fr 1fr 0.9fr');
    await expect(review.locator('[data-held]')).toHaveCount(1);
    await expect.poll(() => namesPlayed(watcher, 'animation')).toContain('scrim');

    await clearPlayed(watcher);
    await watcher.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => weekColumns(watcher)).toBe('0.8fr 1fr 2fr 1.2fr');
    await expect(review.locator('[data-held]')).toHaveCount(0);
    // The card gives way to the banner without sliding out.
    await expect(reminder).toHaveCount(1);
    await expect(reminder).not.toContainText('Closes by itself');
    await expect(reminder.getByRole('button', { name: 'Dismiss' })).toBeVisible();
    await expect.poll(() => runningAnimations(watcher)).toEqual([]);
    const played = await namesPlayed(watcher, 'animation');
    expect(played).not.toContain('reminder-out');
    expect(played).not.toContain('scrim');

    // Motion comes back: the reveal that showed settled doesn't play.
    await reminder.getByRole('button', { name: 'Dismiss' }).click();
    await clearPlayed(watcher);
    await watcher.emulateMedia({ reducedMotion: 'no-preference' });
    await watcher.waitForTimeout(200);
    expect(await runningAnimations(watcher)).toEqual([]);
    await watcher.waitForTimeout(1_000);
    expect(await scriptsPlayed(watcher)).toEqual([]);

    // A later moment moves again: the next sprint slides in.
    await allReady(seats, code);
    const demand = reminderSaying(watcher, 'Now · Monday · Sprint 2');
    await expect(demand).toBeVisible();
    await expect.poll(() => scriptsPlayed(watcher)).toContain('slide');
    await demand.getByRole('button', { name: 'Dismiss' }).click();
    await expect.poll(() => runningAnimations(watcher)).toEqual([]);

    // Turning reduction on and off again, with no new view, doesn't replay the settled sprint.
    await clearPlayed(watcher);
    await watcher.emulateMedia({ reducedMotion: 'reduce' });
    await watcher.waitForTimeout(300);
    await watcher.emulateMedia({ reducedMotion: 'no-preference' });
    await watcher.waitForTimeout(200);
    expect(await runningAnimations(watcher)).toEqual([]);
    await watcher.waitForTimeout(800);
    expect(await scriptsPlayed(watcher)).toEqual([]);
    await expect(reminder).toHaveCount(0);
  } finally {
    await closeAll(context, seats);
  }
});

/**
 * An incident's shake waits for the meeting notes. When everyone is ready before then, the next
 * sprint arrives and the old shake never plays on it; when reduced motion turns on, it stops too.
 */
for (const supersede of ['everyone ready', 'reduced motion'] as const) {
  test(`a delayed incident shake stops on ${supersede}`, async ({ browser, baseURL }) => {
    const context = await motionContext(browser, baseURL);
    const watcher = await context.newPage();
    const { code, seats, picks } = await incidentTable(browser, baseURL, watcher);

    try {
      const reminder = watcher.locator('[data-slot="reminder"]');
      await bookAll(seats, code, picks);
      await expect(reminder).toContainText('Closes by itself');
      const view = (await readViewSnapshot(watcher, code)) as PlayerView;
      expect(view.lastReveal!.outcome.incident).toBe(true);

      // The reveal plays: the shake is scheduled for after the notes.
      await reminder.getByRole('button', { name: 'Dismiss' }).click();
      await expect.poll(() => movesNamed(watcher, 'shake')).toEqual(['running']);

      if (supersede === 'everyone ready') {
        await allReady(seats, code);
        await expect(reminderSaying(watcher, 'Now · Monday · Sprint 2')).toBeVisible();
        expect(await movesNamed(watcher, 'shake')).toEqual(['idle']);
        await expect.poll(() => scriptsPlayed(watcher)).toContain('slide');
      } else {
        await watcher.emulateMedia({ reducedMotion: 'reduce' });
        await expect.poll(() => movesNamed(watcher, 'shake')).toEqual(['idle']);
        await expect.poll(() => runningAnimations(watcher)).toEqual([]);
        const started = (await watcher.evaluate(() => window.moves!.length)) ?? 0;
        await watcher.emulateMedia({ reducedMotion: 'no-preference' });
        await watcher.waitForTimeout(200);
        expect(await runningAnimations(watcher)).toEqual([]);
        await watcher.waitForTimeout(2_000);
        expect(await watcher.evaluate(() => window.moves!.length)).toBe(started);
      }
    } finally {
      await closeAll(context, seats);
    }
  });
}

/**
 * The result can arrive while a moment is still showing: the last sprint's Reminder is open when the
 * last booking ends the game. The Reminder goes, and only the invite moves.
 */
test('the result arriving mid-moment ends that moment', async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const context = await motionContext(browser, baseURL);
  const watcher = await context.newPage();
  const { code, seats } = await startTable(browser, baseURL, watcher);

  try {
    const reminder = watcher.locator('[data-slot="reminder"]');
    for (let sprint = 1; ; sprint++) {
      if (sprint > 1) {
        await allReady(seats, code);
        // Book while the new sprint's Reminder is still open and the week still sliding.
        await expect(reminderSaying(watcher, `Now · Monday · Sprint ${sprint}`)).toBeVisible();
      }
      await bookAll(seats, code);

      const view = (await readViewSnapshot(watcher, code)) as PlayerView;
      if (view.phase === 'ended') {
        break;
      }
      await expect(reminderSaying(watcher, 'Sprint Review')).toBeVisible();
    }

    const invite = watcher.getByRole('dialog');
    await expect(invite).toBeVisible();
    await expect(reminder).toHaveCount(0, { timeout: 1_000 });
    const states = await watcher.evaluate(() => {
      const others: string[] = [];
      for (const { name, animation } of window.moves!) {
        if (name !== 'other' && animation.playState === 'running') {
          others.push(name);
        }
      }

      return others;
    });
    expect(states).toEqual([]);
  } finally {
    await closeAll(context, seats);
  }
});

/**
 * An audit can end the game while the reveal is still showing: the reveal leaves Morale at 1, and the
 * team audits before its rows have turned over. Ana's rows still wait behind the Reminder; Ben, who
 * dismissed his, sees them turning. The result settles both reviews: no row keeps turning over on the
 * final board, while the deciding stamp still lands.
 */
test('an audit ending the game mid-reveal settles the review', async ({ browser, baseURL }) => {
  test.setTimeout(300_000);
  const context = await motionContext(browser, baseURL);
  const watcher = await context.newPage();
  const { code, seats, picks, nominee } = await auditEndingTable(browser, baseURL, watcher);
  const player = seats[1].page;

  try {
    await player.setViewportSize({ width: 1440, height: 900 });
    await player.emulateMedia({ reducedMotion: 'no-preference' });
    // The page hears of the change when it next renders.
    await player.evaluate(() => new Promise((done) => requestAnimationFrame(done)));

    await bookAll(seats, code, picks);
    // Both show the Reminder's card, as motion is on for both.
    await expect(reminderSaying(watcher, 'Sprint Review')).toContainText('Closes by itself');
    await expect(reminderSaying(player, 'Sprint Review')).toContainText('Closes by itself');
    await player.keyboard.press('Escape');
    await expect(reminderSaying(player, 'Sprint Review')).toHaveCount(0);

    // Just before the audit: Ana's rows are held, Ben's are turning over.
    const [held, playing] = await Promise.all([reviewMotion(watcher), reviewMotion(player)]);
    await clearPlayed(watcher);
    await call(seats[0].context, 'room/nominate', { code, nominee });
    await Promise.all(seats.map((seat) => call(seat.context, 'room/vote', { code, yes: true })));
    expect(held.held, 'Ana’s rows wait behind the Reminder').toBe(true);
    expect(held.states).toContain('paused');
    expect(playing.held).toBe(false);
    expect(playing.states).toContain('running');

    for (const page of [watcher, player]) {
      const invite = page.getByRole('dialog');
      await expect(invite).toBeVisible();
      // The result has settled the review at once: nothing of the reveal is left to play.
      expect((await reviewMotion(page)).states).toEqual([]);

      // Back to the board: the final review shows every row and the notes, still.
      await invite.getByRole('button', { name: 'Back to the board' }).click();
      await expect(invite).toBeHidden();
      expect((await reviewMotion(page)).states).toEqual([]);
      const review = await showDay(page, 'Sprint Review');
      const rows = review.getByRole('list', { name: 'Revealed cards' }).getByRole('listitem');
      await expect(rows.first()).toBeVisible();
      for (const shown of [...(await rows.all()), review.locator('dl')]) {
        expect(await shown.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
      }
    }
    await expect.poll(() => namesPlayed(watcher, 'animation')).toContain('stamp');
  } finally {
    await closeAll(context, seats);
  }
});

/**
 * Focus on a Reminder's Dismiss stays on Dismiss when reduced motion turns the card into the banner:
 * Enter still closes it, and so do Esc and its timer, each putting focus back where it was. Focus
 * elsewhere stays where it is.
 */
test('turning reduced motion on keeps focus on the Reminder’s Dismiss', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const context = await motionContext(browser, baseURL);
  const watcher = await context.newPage();
  const { code, seats } = await startTable(browser, baseURL, watcher);
  const copy = watcher.getByRole('button', { name: 'Copy room code' });

  /** Brings on the next Reminder with motion, then turns reduced motion on while it shows. */
  async function reduceDuring(next: () => Promise<void>, text: string, focusDismiss: boolean) {
    await watcher.emulateMedia({ reducedMotion: 'no-preference' });
    await copy.focus();
    await next();
    const card = reminderSaying(watcher, text);
    await expect(card).toContainText('Closes by itself');
    if (focusDismiss) {
      await card.getByRole('button', { name: 'Dismiss' }).focus();
    }
    await watcher.emulateMedia({ reducedMotion: 'reduce' });
    const banner = watcher.locator('[data-slot="reminder"]', { hasNotText: 'Closes by itself' });
    await expect(banner).toBeVisible();
    // The card goes a frame later.
    await expect(watcher.locator('[data-slot="reminder"]')).toHaveCount(1);

    return banner.getByRole('button', { name: 'Dismiss' });
  }

  try {
    // Focus outside the Reminder stays where it is.
    await reduceDuring(() => bookAll(seats, code), 'Sprint Review', false);
    await expect(copy).toBeFocused();
    await watcher.keyboard.press('Escape');

    // Enter on the banner's Dismiss closes it.
    let dismiss = await reduceDuring(() => allReady(seats, code), 'Sprint 2', true);
    await expect(dismiss).toBeFocused();
    await watcher.keyboard.press('Enter');
    await expect(dismiss).toHaveCount(0);
    await expect(copy).toBeFocused();

    // So does Esc.
    dismiss = await reduceDuring(() => bookAll(seats, code), 'Sprint Review', true);
    await expect(dismiss).toBeFocused();
    await watcher.keyboard.press('Escape');
    await expect(dismiss).toHaveCount(0);
    await expect(copy).toBeFocused();

    // And its timer.
    dismiss = await reduceDuring(() => allReady(seats, code), 'Sprint 3', true);
    await expect(dismiss).toBeFocused();
    await expect(dismiss).toHaveCount(0, { timeout: 4_000 });
    await expect(copy).toBeFocused();
  } finally {
    await closeAll(context, seats);
  }
});

type Seat = { context: BrowserContext; page: Page };

/** Ana's page with motion on, on a desktop, recording the moments it plays. */
async function motionContext(browser: Browser, baseURL: string | undefined) {
  const context = await newPlayerContext(browser, baseURL, {
    reducedMotion: 'no-preference',
    viewport: { width: 1440, height: 900 },
  });
  await recordMoments(context);

  return context;
}

/**
 * Ana creates a room on `watcher`; the other four join and play through the RPCs, each with a page
 * to read its view. Returns every seat, Ana's first.
 */
async function startTable(
  browser: Browser,
  baseURL: string | undefined,
  watcher: Page,
): Promise<{ code: string; seats: Seat[] }> {
  await watcher.goto('/');
  const create = await fillWhenReady(watcher, 'New team calendar', { 'Your name': names[0] });
  await create.getByRole('button', { name: 'Create room' }).click();
  await expect(watcher).toHaveURL(/\/rooms\/[A-Z]{4}$/);
  const code = new URL(watcher.url()).pathname.split('/').at(-1)!;

  const seats: Seat[] = [{ context: watcher.context(), page: watcher }];
  for (const name of names.slice(1)) {
    const context = await newPlayerContext(browser, baseURL);
    await call(context, 'lobby/joinRoom', { code, name });
    const page = await context.newPage();
    await page.goto(`/rooms/${code}`);
    seats.push({ context, page });
  }
  await expect(players(watcher)).toHaveCount(names.length);
  await watcher.getByRole('button', { name: 'Start sprint 1' }).click();
  await expect(attendees(watcher)).toHaveCount(names.length);

  return { code, seats };
}

/**
 * A table whose first sprint will have an incident: enough players hold a Workaround to bring Debt
 * to 3, and everyone else can book something other than a Refactoring. Rooms are dealt at random,
 * so it deals new rooms until one is.
 */
async function incidentTable(browser: Browser, baseURL: string | undefined, watcher: Page) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const table = await startTable(browser, baseURL, watcher);
    const picks = new Map<Seat, CardType>();
    let workarounds = 0;
    let needed = 3;
    for (const seat of table.seats) {
      const view = (await readViewSnapshot(seat.page, table.code)) as PlayerView;
      if (view.demand === 'oneWeekSprint') {
        // One card is removed unseen.
        needed = 4;
      }
      const pick =
        view.me.hand.find((card) => card === 'workaround') ??
        view.me.hand.find((card) => card !== 'refactoring');
      if (pick === 'workaround') {
        workarounds++;
      }
      if (pick !== undefined) {
        picks.set(seat, pick);
      }
    }
    if (workarounds >= needed && picks.size === table.seats.length) {
      return { ...table, picks };
    }

    await closeAll(null, table.seats.slice(1));
  }

  throw new Error('No room was dealt enough Workarounds for an incident');
}

/** The cards a seat books to keep a sprint's Progress low: no Workshop, which meets any demand. */
const lowCards: CardType[] = ['refactoring', 'status', 'tests', 'feature', 'workaround'];
const cardProgress: Record<CardType, number> = {
  feature: 2,
  workaround: 3,
  tests: 1,
  refactoring: 0,
  status: 0,
  workshop: 0,
};

/**
 * A table about to reveal a sprint that leaves Morale at 1, with an audit left to end the game on.
 * Morale starts at 4: two missed Morale demands and one passed audit take it there. Rooms are dealt
 * at random, so it deals new rooms until one gets there. Returns the bookings that make that reveal,
 * and whom to audit.
 */
async function auditEndingTable(browser: Browser, baseURL: string | undefined, watcher: Page) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const table = await startTable(browser, baseURL, watcher);
    const ending = await playToMoraleOne(table.seats, table.code);
    if (ending !== null) {
      return { ...table, ...ending };
    }

    await closeAll(null, table.seats.slice(1));
  }

  throw new Error('No room was dealt Morale demands to miss before sprint 4');
}

async function playToMoraleOne(seats: Seat[], code: string) {
  const first = (await readViewSnapshot(seats[0].page, code)) as PlayerView;
  const nominee = first.players[4].playerId;
  for (let sprint = 1; sprint <= 3; sprint++) {
    const view = (await readViewSnapshot(seats[0].page, code)) as PlayerView;
    const { morale, auditsLeft } = view.board;
    const missable = view.demand === 'demoTomorrow' || view.demand === 'visibilityReview';
    const after = missable ? morale - 1 : morale;
    // Losses still needed before the ending audit, against the sprints and audits left for them.
    if (after < 1 || after - 1 > 3 - sprint + auditsLeft - 1) {
      return null;
    }

    const picks = new Map<Seat, CardType>();
    let progress = 0;
    for (const seat of seats) {
      const { me } = (await readViewSnapshot(seat.page, code)) as PlayerView;
      const pick = lowCards.find(
        (card) =>
          me.hand.includes(card) && !(view.demand === 'visibilityReview' && card === 'status'),
      );
      if (pick === undefined) {
        return null;
      }
      picks.set(seat, pick);
      progress += cardProgress[pick];
    }
    if (view.demand === 'demoTomorrow' && progress >= 5) {
      return null;
    }
    if (after === 1) {
      return { picks, nominee };
    }

    await bookAll(seats, code, picks);
    const retro = (await readViewSnapshot(seats[0].page, code)) as PlayerView;
    expect(retro.phase).toBe('retro');
    expect(retro.board.morale).toBe(after);
    if (auditsLeft === 2) {
      await call(seats[0].context, 'room/nominate', { code, nominee });
      for (const seat of seats) {
        await call(seat.context, 'room/vote', { code, yes: true });
      }
    }
    await allReady(seats, code);
  }

  return null;
}

/**
 * The Sprint Review's own animations now: the rows turning over, the notes and their count, each by
 * its play state, and whether the review is held.
 */
function reviewMotion(page: Page): Promise<{ held: boolean; states: string[] }> {
  return page.evaluate(() => {
    const states: string[] = [];
    for (const animation of document.getAnimations()) {
      const name = (animation as CSSAnimation).animationName;
      if (name === 'turn' || name === 'notes' || name === 'count') {
        states.push(animation.playState);
      }
    }

    return { held: document.querySelector('app-sprint-review [data-held]') !== null, states };
  });
}

/** Every seat books: its pick, or the first card in its hand. */
async function bookAll(seats: Seat[], code: string, picks = new Map<Seat, CardType>()) {
  for (const seat of seats) {
    let card = picks.get(seat);
    if (card === undefined) {
      const view = (await readViewSnapshot(seat.page, code)) as PlayerView;
      card = view.me.hand[0];
    }
    await call(seat.context, 'room/contribute', { code, card });
  }
}

async function allReady(seats: Seat[], code: string) {
  for (const seat of seats) {
    await call(seat.context, 'room/finishRetro', { code });
  }
}

async function call(context: BrowserContext, procedure: string, input: Record<string, unknown>) {
  const origin = new URL(test.info().project.use.baseURL!).origin;
  const response = await context.request.post(`/_rpc/${procedure}`, {
    headers: { Origin: origin },
    data: { input },
  });
  expect(response.status(), `${procedure}: ${await response.text()}`).toBe(200);
}

async function closeAll(watcher: BrowserContext | null, seats: Seat[]) {
  const contexts = new Set<BrowserContext>();
  if (watcher !== null) {
    contexts.add(watcher);
  }
  for (const seat of seats) {
    contexts.add(seat.context);
  }
  await Promise.all([...contexts].map((context) => context.close()));
}

/**
 * Taps a point that lies over both the Reminder and the control under it, once. Fails if they
 * don't overlap.
 */
async function tapThrough(page: Page, cover: Locator, control: Locator) {
  const over = (await cover.boundingBox())!;
  const under = (await control.boundingBox())!;
  const left = Math.max(over.x, under.x);
  const right = Math.min(over.x + over.width, under.x + under.width);
  const top = Math.max(over.y, under.y);
  const bottom = Math.min(over.y + over.height, under.y + under.height);
  expect(right - left, 'the Reminder covers the control').toBeGreaterThan(4);
  expect(bottom - top, 'the Reminder covers the control').toBeGreaterThan(4);

  await page.touchscreen.tap((left + right) / 2, (top + bottom) / 2);
}

/** The first of `radios` whose card lies partly under the Reminder. */
async function coveredRadio(cover: Locator, radios: Locator): Promise<Locator> {
  const over = (await cover.boundingBox())!;
  const count = await radios.count();
  for (let index = 0; index < count; index++) {
    const radio = radios.nth(index);
    const card = (await radio.locator('xpath=..').boundingBox())!;
    if (card.y < over.y + over.height - 8 && card.y + card.height > over.y + 8) {
      return radio;
    }
  }

  throw new Error('No card in the hand lies under the Reminder');
}

/** The Reminder saying `text`. Another may still be leaving beside it. */
function reminderSaying(page: Page, text: string): Locator {
  return page.locator('[data-slot="reminder"]', { hasText: text });
}

function weekColumns(page: Page): Promise<string> {
  return page
    .locator('app-week [style*="--week-columns"]')
    .evaluate((grid) => (grid as HTMLElement).style.getPropertyValue('--week-columns'));
}

/** The animations running on the page now, CSS ones by name. */
function runningAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const running: string[] = [];
    for (const animation of document.getAnimations()) {
      if (animation.playState === 'running') {
        running.push((animation as CSSAnimation).animationName ?? 'script');
      }
    }

    return running;
  });
}

/** How each script animation of this name has ended so far: running, finished or idle (stopped). */
function movesNamed(page: Page, name: string): Promise<string[]> {
  return page.evaluate((name) => {
    const states: string[] = [];
    for (const move of window.moves!) {
      if (move.name === name) {
        states.push(move.animation.playState);
      }
    }

    return states;
  }, name);
}

/** Creates the room on the first page, joins the others, and starts the game. */
async function openGame(pages: Page[]): Promise<string> {
  const [host, ...guests] = pages;

  await host.goto('/');
  const create = await fillWhenReady(host, 'New team calendar', { 'Your name': names[0] });
  await create.getByRole('button', { name: 'Create room' }).click();
  await expect(host).toHaveURL(/\/rooms\/[A-Z]{4}$/);
  const code = new URL(host.url()).pathname.split('/').at(-1)!;

  for (let index = 0; index < guests.length; index++) {
    const guest = guests[index];
    await guest.goto('/');
    const join = await fillWhenReady(guest, 'Join with a code', {
      'Room code': code,
      'Your name': names[index + 1],
    });
    await join.getByRole('button', { name: 'Join room' }).click();
    await expect(players(guest)).toHaveCount(index + 2);
  }

  await host.getByRole('button', { name: 'Start sprint 1' }).click();
  await Promise.all(pages.map((page) => expect(attendees(page)).toHaveCount(names.length)));

  return code;
}

/** Picks the first card in the hand and books it. Returns the card. */
async function book(page: Page) {
  const hand = page.getByRole('region', { name: /^Your hand · \d+ cards/ });
  const first = hand.getByRole('radio').first();
  await first.locator('xpath=..').click();
  await expect(first).toBeChecked();
  const view = (await readViewSnapshot(
    page,
    new URL(page.url()).pathname.split('/').at(-1)!,
  )) as PlayerView;
  const card = view.me.hand[0];
  await send(page, 'contribute', hand.getByRole('button', { name: `Book ${cardNames[card]}` }));

  return card;
}

async function send(page: Page, procedure: string, control: Locator): Promise<void> {
  const answered = page.waitForResponse(`**/_rpc/room/${procedure}`);
  await control.click();
  const response = await answered;
  expect(response.status(), `${procedure}: ${await response.text()}`).toBe(200);
}

/**
 * The Sprint Review's rows as the payload orders them: its cards, then the audited card, then the
 * removed one. Sprint 1 has no audited card.
 */
function revealRows(reveal: NonNullable<PlayerView['lastReveal']>): string[] {
  const rows: string[] = [];
  for (let index = 0; index < reveal.cards.length; index++) {
    const card = reveal.cards[index];
    if (index === reveal.mine) {
      rows.push(`${cardNames[card]} You · ${cardRule(card)}`);
    } else {
      rows.push(`${cardNames[card]} ${cardRule(card)}`);
    }
  }
  expect(reveal.audited).toBeNull();
  if (reveal.oneRemoved) {
    rows.push('1 removed, unseen');
  }

  return rows;
}

/** The Sprint Review rows that have turned over so far, in the order they turned. */
async function rowsTurnedSoFar(page: Page, rows: string[]): Promise<string[]> {
  const played = (await page.evaluate(() => window.played)) ?? [];
  const turned: string[] = [];
  for (const moment of played) {
    if (moment.kind !== 'animation' || moment.name !== 'turn') {
      continue;
    }
    const row = rows.find((text) => text.replace(/\s+/g, '') === moment.text.replace(/\s+/g, ''));
    turned.push(row ?? moment.text);
  }

  return turned;
}

async function namesPlayed(page: Page, kind: Played['kind']): Promise<string[]> {
  const played = (await page.evaluate(() => window.played)) ?? [];
  const names: string[] = [];
  for (const moment of played) {
    if (moment.kind === kind) {
      names.push(moment.name);
    }
  }

  return names;
}

/** The script animations played, named by what they move. */
function scriptsPlayed(page: Page): Promise<string[]> {
  return namesPlayed(page, 'script');
}

async function clearPlayed(page: Page): Promise<void> {
  await page.evaluate(() => window.played!.splice(0));
}

/**
 * Records every moment a page plays into `window.played`: CSS animations and transitions as they
 * start, and script animations as they're called, named by what they move.
 */
async function recordMoments(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const played: Played[] = [];
    window.played = played;
    const moves: { name: string; animation: Animation }[] = [];
    window.moves = moves;
    const textOf = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return '';
      }
      return (target.textContent ?? '').replace(/\s+/g, ' ').trim();
    };

    document.addEventListener(
      'animationstart',
      (event) =>
        played.push({ kind: 'animation', name: event.animationName, text: textOf(event.target) }),
      true,
    );
    document.addEventListener(
      'transitionstart',
      (event) =>
        played.push({ kind: 'transition', name: event.propertyName, text: textOf(event.target) }),
      true,
    );

    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const first = JSON.stringify(keyframes);
      let name = 'other';
      if (this.matches('[data-slot="card"]')) {
        name = 'flight';
      } else if (this.matches('section[aria-labelledby^="day-"]')) {
        name = 'reflow';
      } else if (first.includes('56px')) {
        name = 'slide';
      } else if (first.includes('-7px')) {
        name = 'shake';
      }
      played.push({ kind: 'script', name, text: textOf(this) });
      const animation = animate.call(this, keyframes, options);
      moves.push({ name, animation });

      return animation;
    };
  });
}
