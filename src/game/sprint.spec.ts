import type { CardType } from './cards';
import type { DemandType } from './demands';
import type { Board, ContributeGame, Game, Sprint } from './game';
import { replay } from './replay';
import { inEnded, inRetro } from './testing/narrow';
import {
  act,
  allReady,
  audit,
  bestSprint,
  demands,
  expectState,
  findScenario,
  sprint,
  started,
  type StartedGame,
  type Step,
} from './testing/scenario';

/** Finds a seed that plays the steps, then replays the game from that seed and action log. */
function play(playerCount: number, steps: Step[]): Game {
  const { seed, players, log } = findScenario(playerCount, steps);
  return replay(seed, players, log);
}

/** Sprint 1 under The CEO Saw a Competitor's Feature, which has no requirement, with these cards. */
function cardsAlone(cards: CardType[]): Game {
  return play(cards.length, [demands('ceoCompetitor'), sprint({ cards })]);
}

/** Sprint 1 under `demand` with these cards. */
function underDemand(demand: DemandType, cards: CardType[]): Game {
  return play(cards.length, [demands(demand), sprint({ cards })]);
}

function sorted(cards: CardType[]): CardType[] {
  return [...cards].sort();
}

/**
 * A constructed mid-game sprint: 5 players at `board`, sprint `sprintNumber` under `demand`, each
 * player holding three of the card they then contribute. For edge cases a seeded game rarely reaches.
 */
function constructedSprint(
  sprintNumber: Sprint,
  demand: DemandType,
  board: Partial<Board>,
  cards: CardType[],
): Game {
  const game = started(cards.length);
  const demands: DemandType[] = [...game.demands, ...game.unusedDemands];
  const others = demands.filter((candidate) => candidate !== demand);
  others.splice(sprintNumber - 1, 0, demand);
  const hands: Record<string, CardType[]> = {};
  game.players.forEach((player, seat) => {
    hands[player] = [cards[seat], cards[seat], cards[seat]];
  });
  const constructed: ContributeGame = {
    ...game,
    sprint: sprintNumber,
    board: { ...game.board, ...board },
    demands: others.slice(0, 4),
    unusedDemands: others.slice(4),
    revealedDemands: sprintNumber,
    hands,
  };

  let next: Game = constructed;
  game.players.forEach((player, seat) => {
    next = act(next, player, { type: 'contribute', card: cards[seat] });
  });
  return next;
}

const moraleDemands: DemandType[] = ['demoTomorrow', 'visibilityReview'];

describe('resolving a sprint: each card', () => {
  // Sprint 1 starts at Progress 0, Debt 0, Morale 4; CEO first makes the Target 23 + 3.
  const cardCases: { name: string; cards: CardType[]; progress: number; debt: number }[] = [
    {
      name: 'Feature Work: +2 Progress',
      cards: ['feature', 'feature', 'feature', 'feature', 'feature'],
      progress: 10,
      debt: 0,
    },
    {
      name: 'Temporary Workaround: +3 Progress, +1 Debt',
      cards: ['workaround', 'workaround', 'feature', 'feature', 'feature'],
      progress: 12,
      debt: 2,
    },
    {
      name: 'Test Coverage: +1 Progress',
      cards: ['tests', 'tests', 'tests', 'feature', 'feature'],
      progress: 7,
      debt: 0,
    },
    {
      name: 'Refactoring: −2 Debt',
      cards: ['refactoring', 'workaround', 'workaround', 'workaround', 'workaround'],
      progress: 12,
      debt: 2,
    },
    {
      name: 'Status Update: no effect',
      cards: ['status', 'feature', 'feature', 'feature', 'feature'],
      progress: 8,
      debt: 0,
    },
    // Feature 2 → 0, Workaround 3 → 1 twice, Test 1 → 0; the Workarounds' Debt is untouched.
    {
      name: 'Alignment Workshop: every other card gives 2 less, Debt unchanged',
      cards: ['workshop', 'feature', 'workaround', 'workaround', 'tests'],
      progress: 2,
      debt: 2,
    },
    // One Workshop would leave the Workaround at 1; two take 4 from every other card.
    {
      name: 'Workshops stack',
      cards: ['workshop', 'workshop', 'workaround', 'feature', 'feature'],
      progress: 0,
      debt: 1,
    },
    // Workaround 1 + 1, Test 0 + 0 = 2; without the per-card floor the Tests would cancel it to 0.
    {
      name: 'a Workshop never takes a card below 0',
      cards: ['workshop', 'workaround', 'workaround', 'tests', 'tests'],
      progress: 2,
      debt: 2,
    },
    {
      name: 'Debt never goes below 0',
      cards: ['refactoring', 'refactoring', 'feature', 'feature', 'feature'],
      progress: 6,
      debt: 0,
    },
  ];
  for (const { name, cards, progress, debt } of cardCases) {
    it(name, () => {
      const game = inRetro(cardsAlone(cards));

      expect(game.board).toEqual({ progress, target: 26, morale: 4, debt, auditsLeft: 2 });
      expect(game.lastReveal?.outcome).toEqual({ progress, demandMet: null, incident: false });
      expect(game.lastReveal?.removed).toBeNull();
      expect(sorted(game.discard)).toEqual(sorted(cards));
      for (const player of game.players) {
        expect(game.hands[player]).toHaveLength(2);
      }
    });
  }
});

describe('resolving a sprint: incidents', () => {
  it('at Debt 3 or more: −5 Progress and −3 Debt', () => {
    const game = inRetro(
      cardsAlone(['workaround', 'workaround', 'workaround', 'feature', 'feature']),
    );

    expect(game.board).toMatchObject({ progress: 13 - 5, debt: 0 });
    expect(game.lastReveal?.outcome).toEqual({ progress: 13, demandMet: null, incident: true });
  });

  it('happens once per sprint: Debt 5 becomes 2', () => {
    const game = inRetro(
      cardsAlone(['workaround', 'workaround', 'workaround', 'workaround', 'workaround']),
    );

    expect(game.board).toMatchObject({ progress: 15 - 5, debt: 2 });
  });

  it('happens once per sprint even when Debt stays at 3 or more: Debt 7 becomes 4', () => {
    const sevenWorkarounds: CardType[] = [];
    for (let count = 0; count < 7; count++) {
      sevenWorkarounds.push('workaround');
    }
    const game = inRetro(cardsAlone(sevenWorkarounds));

    expect(game.board).toMatchObject({ progress: 21 - 5, debt: 4 });
    expect(game.lastReveal?.outcome).toEqual({ progress: 21, demandMet: null, incident: true });
  });

  it('never takes Progress below 0', () => {
    const game = inRetro(
      cardsAlone(['workaround', 'workaround', 'workaround', 'workshop', 'workshop']),
    );

    expect(game.board).toMatchObject({ progress: 0, debt: 0 });
    expect(game.lastReveal?.outcome).toEqual({ progress: 0, demandMet: null, incident: true });
  });

  it('counts the Debt a missed demand adds, since the demand resolves first', () => {
    // Debt 1 from the Workaround, +2 for missing the Pen Test: 3, so an incident.
    const game = inRetro(
      underDemand('penTest', ['workaround', 'tests', 'feature', 'feature', 'feature']),
    );

    expect(game.board).toMatchObject({ progress: 10 - 5, debt: 0, morale: 4 });
    expect(game.lastReveal?.outcome).toEqual({ progress: 10, demandMet: false, incident: true });
  });
});

describe('resolving a sprint: demands', () => {
  const demandCases: {
    demand: DemandType;
    cards: CardType[];
    met: boolean;
    board: Partial<Board>;
  }[] = [
    // The Demo Moved to Tomorrow: at least 5 Progress, or −1 Morale.
    {
      demand: 'demoTomorrow',
      cards: ['feature', 'feature', 'tests', 'refactoring', 'refactoring'],
      met: true,
      board: { progress: 5, morale: 4 },
    },
    {
      demand: 'demoTomorrow',
      cards: ['feature', 'tests', 'tests', 'refactoring', 'refactoring'],
      met: false,
      board: { progress: 4, morale: 3 },
    },
    {
      demand: 'demoTomorrow',
      cards: ['workshop', 'feature', 'feature', 'tests', 'tests'],
      met: true,
      board: { progress: 0, morale: 4 },
    },
    // Quarterly Visibility Review: 1 Visibility, or −1 Morale.
    {
      demand: 'visibilityReview',
      cards: ['status', 'feature', 'feature', 'feature', 'feature'],
      met: true,
      board: { morale: 4 },
    },
    {
      demand: 'visibilityReview',
      cards: ['feature', 'feature', 'feature', 'tests', 'tests'],
      met: false,
      board: { morale: 3 },
    },
    {
      demand: 'visibilityReview',
      cards: ['workshop', 'feature', 'feature', 'feature', 'feature'],
      met: true,
      board: { morale: 4 },
    },
    // The Pen Test Results Are In: 2 Testing, or +2 Debt.
    {
      demand: 'penTest',
      cards: ['tests', 'tests', 'feature', 'feature', 'feature'],
      met: true,
      board: { debt: 0 },
    },
    {
      demand: 'penTest',
      cards: ['tests', 'feature', 'feature', 'feature', 'feature'],
      met: false,
      board: { debt: 2 },
    },
    {
      demand: 'penTest',
      cards: ['workshop', 'feature', 'feature', 'feature', 'feature'],
      met: true,
      board: { debt: 0 },
    },
    // Platform Migration Mandate: 1 Refactoring, or +2 Debt.
    {
      demand: 'platformMigration',
      cards: ['refactoring', 'feature', 'feature', 'feature', 'feature'],
      met: true,
      board: { debt: 0 },
    },
    {
      demand: 'platformMigration',
      cards: ['feature', 'feature', 'feature', 'tests', 'tests'],
      met: false,
      board: { debt: 2 },
    },
    {
      demand: 'platformMigration',
      cards: ['workshop', 'feature', 'feature', 'feature', 'feature'],
      met: true,
      board: { debt: 0 },
    },
  ];
  for (const { demand, cards, met, board } of demandCases) {
    let how = 'missed';
    if (met) {
      how = 'met';
    }
    if (cards.includes('workshop')) {
      how = 'met by a Workshop';
    }
    it(`${demand} ${how}: ${cards.join(', ')}`, () => {
      const game = inRetro(underDemand(demand, cards));

      expect(game.board).toMatchObject({ target: 23, auditsLeft: 2, ...board });
      expect(game.lastReveal?.outcome.demandMet).toBe(met);
      expect(game.lastReveal?.outcome.incident).toBe(false);
    });
  }

  it("The Demo Moved to Tomorrow counts only this sprint's Progress, not the board's", () => {
    // Progress 8 already on the board; the cards add 4, so the demand is missed.
    const game = inRetro(
      constructedSprint(2, 'demoTomorrow', { progress: 8, morale: 4, debt: 0 }, [
        'feature',
        'tests',
        'tests',
        'status',
        'status',
      ]),
    );

    expect(game.lastReveal?.outcome).toEqual({ progress: 4, demandMet: false, incident: false });
    expect(game.board).toMatchObject({ progress: 12, morale: 3 });
  });

  it("adds a missed demand's Debt after Refactoring's, so Refactoring can't cancel it", () => {
    // Debt 0, the Refactoring keeps it at 0, then +2 for missing the Pen Test: 2, no incident.
    const game = inRetro(
      underDemand('penTest', ['refactoring', 'tests', 'feature', 'feature', 'feature']),
    );

    expect(game.board).toMatchObject({ progress: 7, debt: 2 });
    expect(game.lastReveal?.outcome).toEqual({ progress: 7, demandMet: false, incident: false });
  });

  it("The CEO Saw a Competitor's Feature raises the Target by 3 when it's revealed later", () => {
    const steps = [
      demands('visibilityReview', 'ceoCompetitor'),
      sprint({ cards: ['status', 'feature', 'feature', 'feature', 'feature'] }),
    ];
    const retro = inRetro(play(5, steps));
    expect(retro.board.target).toBe(23);

    const next = play(5, [...steps, allReady()]);
    expect(next.phase).toBe('contribute');
    expect(next).toMatchObject({ sprint: 2, revealedDemands: 2, board: { target: 26 } });
  });

  it('The Sprint Is Now One Week removes one face-down card, which adds no Progress or Debt', () => {
    const cards: CardType[] = ['workaround', 'feature', 'feature', 'feature', 'feature'];
    const game = inRetro(underDemand('oneWeekSprint', cards));
    const reveal = game.lastReveal;
    if (reveal === null || reveal.removed === null) {
      throw new Error('Expected a reveal with a removed card');
    }

    expect(reveal.cards).toHaveLength(4);
    const kept: CardType[] = [];
    for (const { card } of reveal.cards) {
      kept.push(card);
    }
    expect(sorted([...kept, reveal.removed.card])).toEqual(sorted(cards));

    let progress = 8;
    let debt = 0;
    if (kept.includes('workaround')) {
      progress = 9;
      debt = 1;
    }
    expect(game.board).toMatchObject({ progress, debt });
    expect(reveal.outcome).toEqual({ progress, demandMet: null, incident: false });

    // Played and removed cards all go to the discard pile.
    expect(sorted(game.discard)).toEqual(sorted(cards));
  });

  it('The Sprint Is Now One Week never removes the audited card', () => {
    const game = inRetro(
      play(5, [
        demands(null, 'oneWeekSprint'),
        sprint(),
        audit('p1', 'p2', ['p1', 'p2', 'p3']),
        allReady(),
        sprint(),
      ]),
    );
    const reveal = game.lastReveal;

    expect(reveal?.removed).not.toBeNull();
    expect(reveal?.removed?.playerId).not.toBe('p2');
    expect(reveal?.audited?.playerId).toBe('p2');
    expect(reveal?.cards).toHaveLength(3);
  });
});

describe('Morale', () => {
  it('ends the game for the Plant when it reaches 0 at Resolve', () => {
    const game = play(5, [
      demands(moraleDemands, null, moraleDemands),
      sprint({ check: (after) => after.phase === 'retro' && after.board.morale === 3 }),
      audit('p1', 'p2', ['p1', 'p2', 'p3']),
      allReady(),
      sprint({ check: (after) => after.phase === 'retro' && after.board.morale === 2 }),
      audit('p1', 'p3', ['p1', 'p2', 'p3']),
      allReady(),
      sprint({ check: (after) => after.board.morale === 0 }),
    ]);
    const ended = inEnded(game);

    expect(ended.winner).toBe('plant');
    expect(ended.sprint).toBe(3);
    expect(ended.board).toMatchObject({ morale: 0, auditsLeft: 0 });
    expect(ended.lastReveal?.outcome.demandMet).toBe(false);
    expect(ended.vote).toBeNull();
  });

  it('ends the game for the Plant when a passed audit takes it to 0', () => {
    const game = play(5, [
      demands(moraleDemands, moraleDemands),
      sprint({ check: (after) => after.phase === 'retro' && after.board.morale === 3 }),
      audit('p1', 'p2', ['p1', 'p2', 'p3']),
      allReady(),
      sprint({ check: (after) => after.phase === 'retro' && after.board.morale === 1 }),
      audit('p4', 'p5', ['p1', 'p2', 'p3', 'p4']),
    ]);
    const ended = inEnded(game);

    expect(ended.winner).toBe('plant');
    expect(ended.sprint).toBe(2);
    expect(ended.board).toMatchObject({ morale: 0, auditsLeft: 0 });
  });
});

describe('the end of the game', () => {
  function threeSprints(score: (game: StartedGame) => number): Step[] {
    return [
      bestSprint(score),
      allReady(),
      bestSprint(score),
      allReady(),
      bestSprint(score),
      allReady(),
    ];
  }

  function fourSprints(score: (game: StartedGame) => number): Step[] {
    return [...threeSprints(score), bestSprint(score)];
  }

  it('after sprint 4, the Delivery Team wins with Progress exactly at the Target and Morale above 0', () => {
    // Keep Morale up and end sprint 3 a sprint's worth short of the Target, then hit it exactly.
    const game = inEnded(
      play(5, [
        ...threeSprints(
          (after) =>
            100 * after.board.morale - Math.abs(after.board.target - 8 - after.board.progress),
        ),
        sprint({
          check: (after) =>
            after.phase === 'ended' &&
            after.board.progress === after.board.target &&
            after.board.morale > 0,
        }),
      ]),
    );

    expect(game.sprint).toBe(4);
    expect(game.board.progress).toBe(game.board.target);
    expect(game.board.morale).toBeGreaterThan(0);
    expect(game.winner).toBe('delivery');
  });

  it('after sprint 4, the Plant wins at Morale 0 even with Progress at the Target', () => {
    // Quarterly Visibility Review missed without a Status Update: Morale 1 → 0.
    const game = inEnded(
      constructedSprint(4, 'visibilityReview', { progress: 30, target: 23, morale: 1, debt: 0 }, [
        'feature',
        'feature',
        'feature',
        'feature',
        'feature',
      ]),
    );

    expect(game.lastReveal?.outcome.demandMet).toBe(false);
    expect(game.board).toMatchObject({ progress: 40, morale: 0 });
    expect(game.board.progress).toBeGreaterThanOrEqual(game.board.target);
    expect(game.winner).toBe('plant');
  });

  it('after sprint 4, the Plant wins with Progress below the Target', () => {
    const game = inEnded(
      play(5, [
        ...fourSprints((after) => 100 * after.board.morale - after.board.progress),
        expectState((after) => after.phase === 'ended' && after.winner === 'plant'),
      ]),
    );

    expect(game.sprint).toBe(4);
    expect(game.board.progress).toBeLessThan(game.board.target);
    expect(game.board.morale).toBeGreaterThan(0);
  });
});
