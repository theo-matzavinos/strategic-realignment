import { actionSchema, type Action } from './action';
import { applyAction, type RuleErrorCode } from './apply-action';
import { cardTypes, type CardType } from './cards';
import { addPlayer, type ContributeGame, type Game } from './game';
import { act, lobby, started } from './testing/scenario';

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
    let ceoFirst: ContributeGame | null = null;
    let ceoLater: ContributeGame | null = null;
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

describe('refusals after the start', () => {
  /** Sprint 1 with every player's first card placed except p5's. */
  function contributing(): Game {
    let game: Game = started(5);
    for (const player of ['p1', 'p2', 'p3', 'p4']) {
      game = act(game, player, { type: 'contribute', card: started(5).hands[player][0] });
    }
    return game;
  }

  function retro(): Game {
    const game = contributing();
    return act(game, 'p5', { type: 'contribute', card: started(5).hands['p5'][0] });
  }

  function voting(): Game {
    return act(act(retro(), 'p1', { type: 'nominate', nominee: 'p2' }), 'p3', {
      type: 'vote',
      yes: true,
    });
  }

  function ended(): Game {
    const game = retro();
    if (game.phase !== 'retro') {
      throw new Error('Expected the retro');
    }
    return { ...game, phase: 'ended', winner: 'plant', vote: null };
  }

  const p5Hand = started(5).hands['p5'];
  let cardNotInHand: CardType = 'feature';
  for (const card of cardTypes) {
    if (!p5Hand.includes(card)) {
      cardNotInHand = card;
    }
  }

  const refusals: {
    name: string;
    game: Game;
    playerId: string;
    action: Action;
    code: RuleErrorCode;
  }[] = [
    {
      name: 'contribute in the lobby',
      game: lobby(5),
      playerId: 'p1',
      action: { type: 'contribute', card: 'feature' },
      code: 'WRONG_PHASE',
    },
    {
      name: 'contribute in the retro',
      game: retro(),
      playerId: 'p1',
      action: { type: 'contribute', card: 'feature' },
      code: 'WRONG_PHASE',
    },
    {
      name: 'nominate while contributing',
      game: contributing(),
      playerId: 'p1',
      action: { type: 'nominate', nominee: 'p2' },
      code: 'WRONG_PHASE',
    },
    {
      name: 'vote while contributing',
      game: contributing(),
      playerId: 'p1',
      action: { type: 'vote', yes: true },
      code: 'WRONG_PHASE',
    },
    {
      name: 'finishRetro while contributing',
      game: contributing(),
      playerId: 'p1',
      action: { type: 'finishRetro' },
      code: 'WRONG_PHASE',
    },
    {
      name: 'nominate after the end',
      game: ended(),
      playerId: 'p1',
      action: { type: 'nominate', nominee: 'p2' },
      code: 'WRONG_PHASE',
    },
    {
      name: 'finishRetro after the end',
      game: ended(),
      playerId: 'p1',
      action: { type: 'finishRetro' },
      code: 'WRONG_PHASE',
    },
    {
      name: 'a card not in hand',
      game: contributing(),
      playerId: 'p5',
      action: { type: 'contribute', card: cardNotInHand },
      code: 'CARD_NOT_IN_HAND',
    },
    {
      name: 'a second contribution',
      game: contributing(),
      playerId: 'p1',
      action: { type: 'contribute', card: started(5).hands['p1'][1] },
      code: 'ALREADY_CONTRIBUTED',
    },
    {
      name: 'nominating an unknown player',
      game: retro(),
      playerId: 'p1',
      action: { type: 'nominate', nominee: 'p9' },
      code: 'UNKNOWN_PLAYER',
    },
    {
      name: 'nominating yourself',
      game: retro(),
      playerId: 'p1',
      action: { type: 'nominate', nominee: 'p1' },
      code: 'SELF_NOMINATION',
    },
    {
      name: 'a second nomination',
      game: voting(),
      playerId: 'p4',
      action: { type: 'nominate', nominee: 'p5' },
      code: 'VOTE_ALREADY_HELD',
    },
    {
      name: 'voting with no nomination',
      game: retro(),
      playerId: 'p1',
      action: { type: 'vote', yes: true },
      code: 'NO_VOTE_OPEN',
    },
    {
      name: 'voting twice',
      game: voting(),
      playerId: 'p3',
      action: { type: 'vote', yes: false },
      code: 'ALREADY_VOTED',
    },
    {
      name: 'finishRetro while a vote is open',
      game: voting(),
      playerId: 'p1',
      action: { type: 'finishRetro' },
      code: 'VOTE_OPEN',
    },
    {
      name: 'finishRetro twice',
      game: act(retro(), 'p2', { type: 'finishRetro' }),
      playerId: 'p2',
      action: { type: 'finishRetro' },
      code: 'ALREADY_READY',
    },
  ];
  for (const { name, game, playerId, action, code } of refusals) {
    it(`refuses ${name} with ${code} and changes nothing`, () => {
      const before = structuredClone(game);

      expect(applyAction(game, playerId, action)).toEqual({ code });
      expect(game).toEqual(before);
    });
  }

  it('refuses nominating at 0 Audits left with NO_AUDITS_LEFT', () => {
    // Replayed from two passed audits in the retro tests; a constructed board here.
    const game = retro();
    if (game.phase !== 'retro') {
      throw new Error('Expected the retro');
    }
    const noAudits: Game = { ...game, board: { ...game.board, auditsLeft: 0 } };

    expect(applyAction(noAudits, 'p1', { type: 'nominate', nominee: 'p2' })).toEqual({
      code: 'NO_AUDITS_LEFT',
    });
  });

  it('fails clearly for a player who is not seated', () => {
    expect(() =>
      applyAction(contributing(), 'p9', { type: 'contribute', card: 'feature' }),
    ).toThrow();
  });

  it('leaves the game it was given untouched when it accepts an action', () => {
    const game = contributing();
    const before = structuredClone(game);

    act(game, 'p5', { type: 'contribute', card: started(5).hands['p5'][0] });

    expect(game).toEqual(before);
  });
});

describe('actionSchema', () => {
  it('accepts every action and refuses unknown cards and malformed input', () => {
    for (const action of [
      { type: 'startGame' },
      { type: 'contribute', card: 'workshop' },
      { type: 'nominate', nominee: 'p2' },
      { type: 'vote', yes: false },
      { type: 'finishRetro' },
    ]) {
      expect(actionSchema.parse(action)).toEqual(action);
    }

    for (const malformed of [
      { type: 'contribute', card: 'synergy' },
      { type: 'contribute' },
      { type: 'nominate' },
      { type: 'vote', yes: 'yes' },
      { type: 'endGame' },
    ]) {
      expect(actionSchema.safeParse(malformed).success).toBe(false);
    }
  });
});
