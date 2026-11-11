import { applyAction } from './apply-action';
import type { CardType } from './cards';
import { addPlayer, createGame, type Game, type PlayingGame } from './game';

function lobby(playerCount: number, seed = 1): Game {
  let game: Game = createGame(seed, 'p1');
  for (let index = 2; index <= playerCount; index++) {
    game = addPlayer(game, `p${index}`);
  }
  return game;
}

function started(playerCount: number, seed = 1): PlayingGame {
  const result = applyAction(lobby(playerCount, seed), 'p1', { type: 'startGame' });
  if ('code' in result || result.phase !== 'contribute') {
    throw new Error(`startGame was refused: ${JSON.stringify(result)}`);
  }
  return result;
}

function countCards(cards: CardType[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const card of cards) {
    counts[card] = (counts[card] ?? 0) + 1;
  }
  return counts;
}

describe('startGame', () => {
  for (const [playerCount, baseTarget] of [
    [5, 23],
    [6, 28],
    [7, 33],
  ]) {
    it(`deals ${playerCount} players one Plant, 3 cards each and Target ${baseTarget}`, () => {
      const game = started(playerCount);

      let plants = 0;
      const dealt: CardType[] = [];
      for (const player of game.players) {
        if (game.roles[player] === 'plant') {
          plants++;
        }
        expect(game.hands[player]).toHaveLength(3);
        dealt.push(...game.hands[player]);
      }
      expect(plants).toBe(1);
      expect(Object.keys(game.roles)).toHaveLength(playerCount);

      expect(game.deck).toHaveLength(44 - 3 * playerCount);
      // docs/rules.md, Components: the contribution deck.
      expect(countCards([...dealt, ...game.deck])).toEqual({
        feature: 11,
        workaround: 9,
        tests: 8,
        refactoring: 6,
        status: 4,
        workshop: 6,
      });

      // docs/rules.md, Components: the demand deck.
      expect(game.demands).toHaveLength(4);
      expect(game.unusedDemands).toHaveLength(2);
      expect([...game.demands, ...game.unusedDemands].sort()).toEqual([
        'ceoCompetitor',
        'demoTomorrow',
        'oneWeekSprint',
        'penTest',
        'platformMigration',
        'visibilityReview',
      ]);

      let expectedTarget = baseTarget;
      if (game.demands[0] === 'ceoCompetitor') {
        expectedTarget += 3;
      }
      expect(game.board).toEqual({
        progress: 0,
        target: expectedTarget,
        morale: 4,
        debt: 0,
        auditsLeft: 2,
      });
      expect(game.phase).toBe('contribute');
      expect(game.sprint).toBe(1);
      expect(game.revealedDemands).toBe(1);
      expect(game.discard).toEqual([]);
      expect(game.log).toEqual([{ playerId: 'p1', action: { type: 'startGame' } }]);
    });
  }

  it("raises the Target by 3 when the first demand is The CEO Saw a Competitor's Feature", () => {
    let ceoFirst: PlayingGame | null = null;
    let ceoLater: PlayingGame | null = null;
    for (let seed = 1; seed < 500; seed++) {
      const game = started(5, seed);
      if (game.demands[0] === 'ceoCompetitor') {
        ceoFirst ??= game;
      }
      if (game.demands.slice(1).includes('ceoCompetitor')) {
        ceoLater ??= game;
      }
    }

    expect(ceoFirst?.board.target).toBe(26);
    expect(ceoLater?.board.target).toBe(23);
  });

  it('replays identically from the same seed, players and actions', () => {
    expect(started(6, 42)).toEqual(started(6, 42));
  });

  it('deals differently from a different seed', () => {
    const first = started(6, 42);
    const second = started(6, 43);

    expect(second.seed).not.toBe(first.seed);
    expect([second.roles, second.hands, second.deck, second.demands]).not.toEqual([
      first.roles,
      first.hands,
      first.deck,
      first.demands,
    ]);
  });

  it('shuffles the roles: the Plant sits in every seat across seeds', () => {
    const plantSeats = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const game = started(5, seed);
      plantSeats.add(game.players.find((player) => game.roles[player] === 'plant') ?? 'none');
    }

    expect([...plantSeats].sort()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
  });

  it('shuffles the deck: hands and the remaining order vary across seeds', () => {
    const firstHands = new Set<string>();
    const deckOrders = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const game = started(5, seed);
      firstHands.add([...game.hands['p1']].sort().join());
      deckOrders.add(game.deck.join());
    }

    expect(firstHands.size).toBeGreaterThan(5);
    expect(deckOrders.size).toBe(50);
  });

  it('leaves the lobby game untouched', () => {
    const game = lobby(5);
    const before = structuredClone(game);

    applyAction(game, 'p1', { type: 'startGame' });

    expect(game).toEqual(before);
  });

  it("doesn't share the lobby's player list with the started game", () => {
    const game = lobby(5);
    const result = applyAction(game, 'p1', { type: 'startGame' });
    if ('code' in result) {
      throw new Error(`startGame was refused: ${result.code}`);
    }

    expect(result.players).not.toBe(game.players);
    expect(result.players).toEqual(game.players);
  });

  it("refuses a player who isn't the host", () => {
    expect(applyAction(lobby(5), 'p2', { type: 'startGame' })).toEqual({ code: 'NOT_HOST' });
  });

  it('refuses fewer than 5 players', () => {
    expect(applyAction(lobby(4), 'p1', { type: 'startGame' })).toEqual({
      code: 'NOT_ENOUGH_PLAYERS',
    });
  });

  it('refuses a game that has already started', () => {
    expect(applyAction(started(5), 'p1', { type: 'startGame' })).toEqual({ code: 'WRONG_PHASE' });
  });

  it('never seats more than 7 players', () => {
    expect(() => addPlayer(lobby(7), 'p8')).toThrow();
  });

  it('refuses to deal a corrupted lobby with more than 7 players', () => {
    const game = lobby(7);
    const corrupted = { ...game, players: [...game.players, 'p8'] };

    expect(() => applyAction(corrupted, 'p1', { type: 'startGame' })).toThrow();
  });
});
