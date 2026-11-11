import { applyAction, type RuleError } from './apply-action';
import { cardTypes, type CardType } from './cards';
import type { DemandType } from './demands';
import {
  addPlayer,
  createGame,
  currentDemand,
  type AuditVote,
  type Game,
  type LoggedAction,
  type PlayerId,
  type Sprint,
} from './game';
import { replay } from './replay';
import { inEnded, inRetro } from './testing/narrow';
import { randomGame } from './testing/random-play';
import { roomFor } from './testing/room';
import { act, allReady, audit, demands, findScenario, sprint, started } from './testing/scenario';
import { viewFor, type PlayerView } from './view';

// docs/rules.md, Who sees what, checked for every player after every step of seeded random games.

const gamesPerPlayerCount = 70;

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

type Coverage = {
  games: number;
  steps: number;
  reveals: number;
  revealsInSeatOrder: number;
  removed: number;
  removedWithAudited: number;
  passedAudits: number;
  failedAudits: number;
  endedByAudit: number;
  winners: Record<string, number>;
};

const coverage: Coverage = {
  games: 0,
  steps: 0,
  reveals: 0,
  revealsInSeatOrder: 0,
  removed: 0,
  removedWithAudited: 0,
  passedAudits: 0,
  failedAudits: 0,
  endedByAudit: 0,
  winners: {},
};

function apply(game: Game, { playerId, action }: LoggedAction): Game {
  const result: Game | RuleError = applyAction(game, playerId, action);
  if ('code' in result) {
    throw new Error(`${action.type} by ${playerId} was refused: ${result.code}`);
  }
  return result;
}

/** Collects what's wrong with the views; one assertion per game keeps 100,000 views fast. */
class Problems {
  readonly found: string[] = [];
  #where = '';

  at(where: string): void {
    this.#where = where;
  }

  check(ok: boolean, problem: string): void {
    if (!ok) {
      this.found.push(`${this.#where}: ${problem}`);
    }
  }

  same(actual: unknown, expected: unknown, what: string): void {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    this.check(actualJson === expectedJson, `${what} is ${actualJson}, expected ${expectedJson}`);
  }
}

function keysOf(value: object): string[] {
  return Object.keys(value).sort();
}

/** Every key the view may have, at every level; anything else is a leak. */
function checkOnlyViewFields(problems: Problems, view: PlayerView, game: Game): void {
  problems.same(keysOf(view), viewKeys, 'view keys');
  problems.same(
    keysOf(view.board),
    ['auditsLeft', 'debt', 'morale', 'progress', 'target'],
    'board keys',
  );
  problems.same(keysOf(view.me), ['contribution', 'hand', 'playerId', 'role'], 'me keys');
  for (const player of view.players) {
    problems.same(
      keysOf(player),
      ['handSize', 'hasContributed', 'isAudited', 'isHost', 'name', 'playerId'],
      'player keys',
    );
  }

  if (view.lastReveal !== null) {
    problems.same(
      keysOf(view.lastReveal),
      ['audited', 'cards', 'mine', 'oneRemoved', 'outcome', 'sprint'],
      'lastReveal keys',
    );
    problems.same(
      keysOf(view.lastReveal.outcome),
      ['demandMet', 'incident', 'progress'],
      'outcome keys',
    );
    if (view.lastReveal.audited !== null) {
      problems.same(keysOf(view.lastReveal.audited), ['card', 'playerId'], 'audited keys');
    }
  }

  if (view.vote !== null) {
    problems.same(keysOf(view.vote), ['mine', 'nominee', 'outcome', 'voted'], 'vote keys');
    if (view.vote.outcome !== null) {
      problems.same(keysOf(view.vote.outcome), ['no', 'passed', 'yes'], 'vote outcome keys');
    }
  }

  if (view.result !== null) {
    problems.same(keysOf(view.result), ['roles', 'winner'], 'result keys');
    problems.same(Object.keys(view.result.roles), game.players, 'result roles');
  }
}

function occurrences(json: string, card: CardType): number {
  return json.split(`"${card}"`).length - 1;
}

/**
 * The view's JSON names exactly `visible`, the cards this player may see, worked out without the
 * view: no other hand, no deck and no removed card.
 */
function checkOnlyVisibleCards(problems: Problems, view: PlayerView, visible: CardType[]): void {
  const json = JSON.stringify(view);
  for (const card of cardTypes) {
    let expected = 0;
    for (const seen of visible) {
      if (seen === card) {
        expected++;
      }
    }
    problems.same(occurrences(json, card), expected, `"${card}" in the JSON`);
  }
}

/** The cards placed in the sprint of the game's last reveal, known from the log, not the engine. */
type Placed = {
  sprint: Sprint;
  demand: DemandType;
  cards: Record<PlayerId, CardType>;
  /** Placed face up that sprint. */
  audited: PlayerId | null;
};

/** What the last reveal may show, from the placements and the stored removed card. */
type ExpectedReveal = {
  /** Every card placed face down but the removed one, in seat order. */
  faceDown: CardType[];
  audited: { playerId: PlayerId; card: CardType } | null;
  removedFrom: PlayerId | null;
};

/**
 * The server keeps which card One Week removed; check that it is one of that sprint's face-down
 * placements, then work out the public reveal from the placements alone.
 */
function expectedReveal(problems: Problems, game: Game, placed: Placed): ExpectedReveal | null {
  if (game.phase === 'lobby' || game.lastReveal === null) {
    problems.check(false, 'no stored reveal after a reveal');
    return null;
  }

  const stored = game.lastReveal;
  problems.same(stored.sprint, placed.sprint, "the stored reveal's sprint");

  const oneWeek = placed.demand === 'oneWeekSprint';
  problems.check(
    (stored.removed !== null) === oneWeek,
    'a removed card without One Week, or none under it',
  );

  let removedFrom: PlayerId | null = null;
  if (stored.removed !== null) {
    removedFrom = stored.removed.playerId;
    problems.check(removedFrom !== placed.audited, 'the audited card removed');
    problems.same(stored.removed.card, placed.cards[removedFrom], 'the removed card');
  }

  const faceDown: CardType[] = [];
  for (const player of game.players) {
    if (player !== placed.audited && player !== removedFrom) {
      faceDown.push(placed.cards[player]);
    }
  }

  let audited: ExpectedReveal['audited'] = null;
  if (placed.audited !== null) {
    audited = { playerId: placed.audited, card: placed.cards[placed.audited] };
  }

  return { faceDown, audited, removedFrom };
}

function sortedCards(cards: CardType[]): CardType[] {
  return [...cards].sort();
}

/** `placed` is null until the first reveal. */
function checkHiddenInformation(
  problems: Problems,
  game: Game,
  version: number,
  placed: Placed | null,
): void {
  const room = roomFor(game, version);

  problems.at(`version ${version}, phase ${game.phase}`);
  let expected: ExpectedReveal | null = null;
  if (placed !== null) {
    expected = expectedReveal(problems, game, placed);
  }

  for (const playerId of game.players) {
    problems.at(`version ${version}, phase ${game.phase}, ${playerId}`);
    const view = viewFor(room, playerId);
    const json = JSON.stringify(view);

    checkOnlyViewFields(problems, view, game);
    problems.check(!json.includes('session-of-'), 'a session id');

    const visible: CardType[] = [];
    if (game.phase !== 'lobby') {
      visible.push(...game.hands[playerId]);
    }
    if (game.phase === 'contribute' && Object.hasOwn(game.contributions, playerId)) {
      visible.push(game.contributions[playerId]);
    }
    if (expected !== null) {
      visible.push(...expected.faceDown);
      if (expected.audited !== null) {
        visible.push(expected.audited.card);
      }
    }
    checkOnlyVisibleCards(problems, view, visible);

    if (game.phase === 'lobby') {
      problems.same(view.me.role, null, 'role');
      problems.same(view.me.hand, [], 'hand');
      continue;
    }

    // Your own hand and role; everyone else's hand only as a size.
    problems.same(view.me.hand, game.hands[playerId], 'hand');
    problems.same(view.me.role, game.roles[playerId], 'role');
    for (const player of view.players) {
      problems.same(player.handSize, game.hands[player.playerId].length, 'hand size');
    }

    if (game.phase === 'ended') {
      problems.same(view.result, { winner: game.winner, roles: game.roles }, 'result');
    } else {
      problems.same(view.result, null, 'result');
      const withoutMyRole = JSON.stringify({ ...view, me: { ...view.me, role: null } });
      problems.check(!withoutMyRole.includes('"plant"'), 'a Plant role before the end');
      problems.check(!withoutMyRole.includes('"delivery"'), 'a Delivery role before the end');
    }

    problems.check((view.lastReveal === null) === (placed === null), 'lastReveal before a reveal');
    const stored = game.lastReveal;
    if (view.lastReveal !== null && stored !== null && placed !== null && expected !== null) {
      const shown = view.lastReveal;

      // Exactly the face-down cards placed, but the removed one, in the stored shuffled order.
      problems.same(sortedCards(shown.cards), sortedCards(expected.faceDown), 'revealed cards');
      const storedOrder: CardType[] = [];
      for (const { card } of stored.cards) {
        storedOrder.push(card);
      }
      problems.same(shown.cards, storedOrder, 'revealed card order');
      problems.same(shown.audited, expected.audited, 'audited card');
      problems.same(shown.oneRemoved, placed.demand === 'oneWeekSprint', 'oneRemoved');

      let storedMine: number | null = null;
      for (let index = 0; index < stored.cards.length; index++) {
        if (stored.cards[index].playerId === playerId) {
          storedMine = index;
        }
      }
      problems.same(shown.mine, storedMine, 'mine');
      const faceUpOrRemoved = playerId === placed.audited || playerId === expected.removedFrom;
      if (faceUpOrRemoved) {
        problems.same(shown.mine, null, 'mine for a face-up or removed card');
      } else if (shown.mine === null) {
        problems.check(false, 'no mine for a face-down card that was shown');
      } else {
        problems.same(shown.cards[shown.mine], placed.cards[playerId], 'the card at mine');
      }
    }

    let held: AuditVote | null = null;
    if (game.phase === 'retro') {
      held = game.vote;
    }
    if (game.phase === 'ended') {
      // Only the vote that ended the game is kept, for everyone to see.
      const endedByVote = game.log[game.log.length - 1].action.type === 'vote';
      problems.check(
        (game.vote !== null) === endedByVote,
        'a kept vote, exactly when one ended it',
      );
      held = game.vote;
    }

    if (held === null) {
      problems.same(view.vote, null, 'vote');
      continue;
    }

    const votes = held.votes;
    const voted: PlayerId[] = [];
    const yes: PlayerId[] = [];
    const no: PlayerId[] = [];
    for (const player of game.players) {
      if (!Object.hasOwn(votes, player)) {
        continue;
      }
      voted.push(player);
      if (votes[player]) {
        yes.push(player);
      } else {
        no.push(player);
      }
    }

    problems.same(view.vote?.nominee, held.nominee, 'nominee');
    problems.same(view.vote?.voted, voted, 'voted');
    problems.same(view.vote?.mine, votes[playerId] ?? null, 'my vote');
    const everyoneVoted = voted.length === game.players.length;
    if (everyoneVoted) {
      const passed = yes.length > game.players.length / 2;
      problems.same(view.vote?.outcome, { passed, yes, no }, 'vote outcome');
    } else {
      problems.same(view.vote?.outcome, null, 'the vote outcome before everyone voted');
    }
  }
}

function recordReveal(game: Game): void {
  if (game.phase === 'lobby' || game.lastReveal === null) {
    return;
  }
  const reveal = game.lastReveal;
  coverage.reveals++;

  const owners: string[] = [];
  for (const { playerId } of reveal.cards) {
    owners.push(playerId);
  }
  const seatOrder = game.players.filter((player) => owners.includes(player));
  if (owners.join() === seatOrder.join()) {
    coverage.revealsInSeatOrder++;
  }

  if (reveal.removed !== null) {
    coverage.removed++;
    if (reveal.audited !== null) {
      coverage.removedWithAudited++;
      expect(reveal.removed.playerId).not.toBe(reveal.audited.playerId);
    }
  }
}

/** Replays a contribute phase's placements in reverse order and expects the very same reveal. */
function expectSameRevealInAnotherOrder(start: Game, placements: LoggedAction[], end: Game): void {
  let reordered = start;
  for (const placement of [...placements].reverse()) {
    reordered = apply(reordered, placement);
  }

  expect({ ...reordered, log: [] }).toEqual({ ...end, log: [] });
}

function walk(final: Game, problems: Problems): void {
  let game: Game = createGame(final.seed, final.players[0]);
  for (const player of final.players.slice(1)) {
    game = addPlayer(game, player);
  }
  let version = 1;
  let placed: Placed | null = null;
  checkHiddenInformation(problems, game, version, placed);

  let phaseStart: Game = game;
  let placements: LoggedAction[] = [];

  for (const logged of final.log) {
    const before = game;
    game = apply(game, logged);
    version++;
    coverage.steps++;

    if (logged.action.type === 'contribute') {
      placements.push(logged);
    }

    const revealed = before.phase === 'contribute' && game.phase !== 'contribute';
    if (before.phase === 'contribute' && revealed) {
      const cards: Record<PlayerId, CardType> = {};
      for (const { playerId, action } of placements) {
        if (action.type === 'contribute') {
          cards[playerId] = action.card;
        }
      }
      placed = {
        sprint: before.sprint,
        demand: currentDemand(before),
        cards,
        audited: before.audited,
      };
    }

    checkHiddenInformation(problems, game, version, placed);

    const sprintStarted = before.phase !== 'contribute' && game.phase === 'contribute';
    if (sprintStarted) {
      phaseStart = game;
      placements = [];
    }

    if (revealed) {
      expectSameRevealInAnotherOrder(phaseStart, placements, game);
      recordReveal(game);
    }

    const voteClosed =
      before.phase === 'retro' &&
      before.vote !== null &&
      Object.keys(before.vote.votes).length === game.players.length - 1 &&
      logged.action.type === 'vote';
    if (voteClosed) {
      if (game.phase === 'ended') {
        coverage.passedAudits++;
        coverage.endedByAudit++;
      } else if (game.phase === 'retro' && game.nextAudited !== null) {
        coverage.passedAudits++;
      } else {
        coverage.failedAudits++;
      }
    }
  }
}

describe('hidden information in seeded random games', () => {
  for (const playerCount of [5, 6, 7]) {
    for (let index = 1; index <= gamesPerPlayerCount; index++) {
      const seed = playerCount * 1000 + index;

      it(`${playerCount} players, seed ${seed}`, () => {
        const final = randomGame(seed, playerCount);

        expect(final.phase).toBe('ended');
        expect(replay(seed, final.players, final.log)).toEqual(final);
        const problems = new Problems();
        walk(final, problems);
        expect(problems.found.slice(0, 10)).toEqual([]);

        coverage.games++;
        if (final.phase === 'ended') {
          coverage.winners[final.winner] = (coverage.winners[final.winner] ?? 0) + 1;
        }
      });
    }
  }

  // Random play never takes Morale to 0, so the walk also covers a game a passed audit ends.
  it('a passed audit that takes Morale to 0, walked the same way', () => {
    const moraleDemands: DemandType[] = ['demoTomorrow', 'visibilityReview'];
    const { seed, players, log } = findScenario(5, [
      demands(moraleDemands, moraleDemands),
      sprint({ check: (after) => after.phase === 'retro' && after.board.morale === 3 }),
      audit('p1', 'p2', ['p1', 'p2', 'p3']),
      allReady(),
      sprint({ check: (after) => after.phase === 'retro' && after.board.morale === 1 }),
      audit('p4', 'p5', ['p1', 'p2', 'p3', 'p4']),
    ]);
    const final = inEnded(replay(seed, players, log));

    const problems = new Problems();
    walk(final, problems);
    expect(problems.found.slice(0, 10)).toEqual([]);
  });

  it('covered what it should: removals with an audit, both audit outcomes, both winners', () => {
    expect(coverage.games).toBe(3 * gamesPerPlayerCount);
    expect(coverage.endedByAudit).toBeGreaterThan(0);
    expect(coverage.removedWithAudited).toBeGreaterThan(0);
    expect(coverage.passedAudits).toBeGreaterThan(0);
    expect(coverage.failedAudits).toBeGreaterThan(0);
    expect(coverage.winners['delivery']).toBeGreaterThan(0);
    expect(coverage.winners['plant']).toBeGreaterThan(0);
    // Shuffled, not in seat order: a 5-card reveal lands in seat order 1 time in 120.
    expect(coverage.revealsInSeatOrder).toBeLessThan(coverage.reveals / 10);
  });
});

describe('the reveal shuffle', () => {
  it('orders the face-down cards differently from game to game', () => {
    // Sprint 1 of 200 five-player games, everyone face down, each playing their first card.
    const owners = new Set<string>();
    let reveals = 0;
    for (let seed = 1; reveals < 200; seed++) {
      const start = started(5, seed);
      if (currentDemand(start) === 'oneWeekSprint') {
        continue;
      }

      let game: Game = start;
      for (const player of start.players) {
        game = act(game, player, { type: 'contribute', card: start.hands[player][0] });
      }

      const order: PlayerId[] = [];
      for (const { playerId } of inRetro(game).lastReveal?.cards ?? []) {
        order.push(playerId);
      }
      owners.add(order.join());
      reveals++;
    }

    // 200 fair shuffles of 5 cards show about 98 of the 120 orders; any fixed order shows 1.
    expect(owners.size).toBeGreaterThan(60);
  });
});
