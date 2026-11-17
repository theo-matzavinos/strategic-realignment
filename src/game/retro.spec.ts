import { applyAction } from './apply-action';
import { contributionDeck, type CardType } from './cards';
import type { Game, RetroGame } from './game';
import { replay } from './replay';
import { inContribute, inEnded, inRetro } from './testing/narrow';
import {
  act,
  allReady,
  audit,
  demands,
  expectState,
  findScenario,
  sprint,
  type Scenario,
  type Step,
} from './testing/scenario';
import { viewFor } from './view';
import { roomFor } from './testing/room';

function play(playerCount: number, steps: Step[]): Game {
  const { seed, players, log } = findScenario(playerCount, steps);
  return replay(seed, players, log);
}

/** Sprint 1 played with no change to Morale, so audits are the only thing that moves it. */
const calmSprint = sprint({
  check: (after) => after.phase === 'retro' && after.board.morale === 4,
});

describe('audits', () => {
  it('pass with more than half of all players voting yes: −1 Audit, −1 Morale, face up next', () => {
    const game = inRetro(play(5, [calmSprint, audit('p1', 'p2', ['p1', 'p2', 'p3'])]));

    expect(game.board).toMatchObject({ auditsLeft: 1, morale: 3 });
    expect(game.nextAudited).toBe('p2');

    const view = viewFor(roomFor(game), 'p4');
    expect(view.vote?.outcome).toEqual({ passed: true, yes: ['p1', 'p2', 'p3'], no: ['p4', 'p5'] });
    for (const player of view.players) {
      expect(player.isAudited).toBe(player.playerId === 'p2');
    }
  });

  it('fail on exactly half, and nothing happens', () => {
    const game = inRetro(play(6, [calmSprint, audit('p1', 'p2', ['p1', 'p2', 'p3'])]));

    expect(game.board).toMatchObject({ auditsLeft: 2, morale: 4 });
    expect(game.nextAudited).toBeNull();
    expect(viewFor(roomFor(game), 'p1').vote?.outcome).toEqual({
      passed: false,
      yes: ['p1', 'p2', 'p3'],
      no: ['p4', 'p5', 'p6'],
    });
  });

  it('allow one vote per retro, passed or failed', () => {
    const failed = play(5, [calmSprint, audit('p1', 'p2', ['p1'])]);
    expect(applyAction(failed, 'p3', { type: 'nominate', nominee: 'p4' })).toEqual({
      code: 'VOTE_ALREADY_HELD',
    });

    const passed = play(5, [calmSprint, audit('p1', 'p2', ['p1', 'p2', 'p3', 'p4'])]);
    expect(applyAction(passed, 'p3', { type: 'nominate', nominee: 'p4' })).toEqual({
      code: 'VOTE_ALREADY_HELD',
    });
  });

  it('stop once Audits left is 0', () => {
    const game = play(5, [
      calmSprint,
      audit('p1', 'p2', ['p1', 'p2', 'p3']),
      allReady(),
      sprint({ check: (after) => after.phase === 'retro' && after.board.morale === 3 }),
      audit('p1', 'p3', ['p1', 'p2', 'p3']),
      allReady(),
      sprint({ check: (after) => after.phase === 'retro' }),
    ]);

    expect(inRetro(game).board).toMatchObject({ auditsLeft: 0, morale: 2 });
    expect(applyAction(game, 'p1', { type: 'nominate', nominee: 'p4' })).toEqual({
      code: 'NO_AUDITS_LEFT',
    });
  });

  it("make the audited player's next card face up and attributed, and still count it", () => {
    // The audited p2 plays a Workaround; four Feature Work stay face down.
    const game = inRetro(
      play(5, [
        demands(null, ['ceoCompetitor', 'demoTomorrow']),
        calmSprint,
        audit('p1', 'p2', ['p1', 'p2', 'p3']),
        allReady(),
        expectState((after) => after.phase === 'contribute' && after.audited === 'p2'),
        sprint({
          cards: ['workaround', 'feature', 'feature', 'feature', 'feature'],
          by: { p2: 'workaround' },
        }),
      ]),
    );
    const reveal = game.lastReveal;

    expect(reveal?.audited).toEqual({ playerId: 'p2', card: 'workaround' });
    expect(reveal?.cards).toHaveLength(4);
    for (const { playerId } of reveal?.cards ?? []) {
      expect(playerId).not.toBe('p2');
    }
    expect(reveal?.outcome.progress).toBe(11);

    const audited = viewFor(roomFor(game), 'p2');
    expect(audited.lastReveal?.mine).toBeNull();
    expect(audited.lastReveal?.audited).toEqual({ playerId: 'p2', card: 'workaround' });
    expect(viewFor(roomFor(game), 'p3').lastReveal?.audited).toEqual({
      playerId: 'p2',
      card: 'workaround',
    });

    // The audit covered one sprint; nobody is audited for the next.
    expect(game.nextAudited).toBeNull();
    for (const player of audited.players) {
      expect(player.isAudited).toBe(false);
    }
  });
});

describe('a 10-player game', () => {
  it('passes an audit on 6 yes, fails one on a 5–5 tie, and two Plants win together', () => {
    // Each sprint plays every player's first card, so finding a seed tries one assignment a sprint.
    const { seed, players, log } = findScenario(10, [
      sprint(),
      audit('p1', 'p2', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']),
      allReady(),
      sprint(),
      audit('p3', 'p4', ['p1', 'p2', 'p3', 'p4', 'p5']),
      allReady(),
      sprint(),
      allReady(),
      sprint(),
      expectState((after) => after.phase === 'ended' && after.winner === 'plant'),
    ]);

    const closingVotes: number[] = [];
    let votes = 0;
    for (let index = 0; index < log.length; index++) {
      if (log[index].action.type === 'vote') {
        votes++;
        if (votes % 10 === 0) {
          closingVotes.push(index + 1);
        }
      }
    }
    expect(closingVotes).toHaveLength(2);

    const beforePass = inRetro(replay(seed, players, log.slice(0, closingVotes[0] - 1)));
    const passed = inRetro(replay(seed, players, log.slice(0, closingVotes[0])));
    expect(passed.board.auditsLeft).toBe(1);
    expect(passed.board.morale).toBe(beforePass.board.morale - 1);
    expect(passed.nextAudited).toBe('p2');
    expect(viewFor(roomFor(passed), 'p10').vote?.outcome).toEqual({
      passed: true,
      yes: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
      no: ['p7', 'p8', 'p9', 'p10'],
    });

    const beforeTie = inRetro(replay(seed, players, log.slice(0, closingVotes[1] - 1)));
    const tied = inRetro(replay(seed, players, log.slice(0, closingVotes[1])));
    expect(tied.board).toEqual(beforeTie.board);
    expect(tied.nextAudited).toBeNull();
    expect(viewFor(roomFor(tied), 'p10').vote?.outcome).toEqual({
      passed: false,
      yes: ['p1', 'p2', 'p3', 'p4', 'p5'],
      no: ['p6', 'p7', 'p8', 'p9', 'p10'],
    });

    const ended = inEnded(replay(seed, players, log));
    expect(ended.sprint).toBe(4);
    const plants: string[] = [];
    for (const player of ended.players) {
      if (ended.roles[player] === 'plant') {
        plants.push(player);
      }
    }
    expect(plants).toHaveLength(2);
    for (const player of ended.players) {
      expect(viewFor(roomFor(ended), player).result).toEqual({
        winner: 'plant',
        roles: ended.roles,
      });
    }
  });
});

describe('the end of a retro', () => {
  function firstRetro(): { scenario: Scenario; game: RetroGame } {
    const scenario = findScenario(5, [calmSprint]);
    return { scenario, game: inRetro(replay(scenario.seed, scenario.players, scenario.log)) };
  }

  it('comes when everyone is ready, and only then', () => {
    let game: Game = firstRetro().game;
    for (const player of ['p3', 'p1', 'p5', 'p2']) {
      game = act(game, player, { type: 'finishRetro' });
      expect(game.phase).toBe('retro');
    }
    expect(viewFor(roomFor(game), 'p4').retroReady).toEqual(['p1', 'p2', 'p3', 'p5']);

    game = act(game, 'p4', { type: 'finishRetro' });
    expect(game.phase).toBe('contribute');
  });

  it('clears every ready mark on a nomination, refuses ready during the vote, and allows it after', () => {
    let game: Game = firstRetro().game;
    game = act(game, 'p1', { type: 'finishRetro' });
    game = act(game, 'p2', { type: 'finishRetro' });

    game = act(game, 'p3', { type: 'nominate', nominee: 'p4' });
    expect(inRetro(game).ready).toEqual([]);
    expect(applyAction(game, 'p1', { type: 'finishRetro' })).toEqual({ code: 'VOTE_OPEN' });

    for (const player of ['p1', 'p2', 'p3', 'p4']) {
      game = act(game, player, { type: 'vote', yes: false });
    }
    expect(applyAction(game, 'p5', { type: 'finishRetro' })).toEqual({ code: 'VOTE_OPEN' });
    game = act(game, 'p5', { type: 'vote', yes: false });

    game = act(game, 'p1', { type: 'finishRetro' });
    expect(applyAction(game, 'p1', { type: 'finishRetro' })).toEqual({ code: 'ALREADY_READY' });
  });

  it('starts the next sprint: the next demand, hands drawn back to 3 from the deck in seat order', () => {
    const { scenario, game: retro } = firstRetro();
    const next = inContribute(
      replay(scenario.seed, scenario.players, [...scenario.log, ...(allReady()(retro) ?? [])]),
    );

    expect(next.sprint).toBe(2);
    expect(next.revealedDemands).toBe(2);
    expect(next.contributions).toEqual({});
    expect(next.audited).toBeNull();
    for (let seat = 0; seat < retro.players.length; seat++) {
      const player = retro.players[seat];
      expect(next.hands[player]).toEqual([...retro.hands[player], retro.deck[seat]]);
    }
    expect(next.deck).toEqual(retro.deck.slice(5));
    expect(next.discard).toEqual(retro.discard);
    expect(next.lastReveal).toEqual(retro.lastReveal);
  });

  it('reshuffles the discard pile into a new deck when the deck runs out', () => {
    // At v0 numbers the deck never runs out, so the deck is cut down to 2 cards here.
    const { game: retro } = firstRetro();
    const constructed: RetroGame = {
      ...retro,
      deck: retro.deck.slice(0, 2),
      discard: [...retro.discard, ...retro.deck.slice(2)],
    };

    let game: Game = constructed;
    for (const player of game.players) {
      game = act(game, player, { type: 'finishRetro' });
    }
    const next = inContribute(game);

    expect(next.hands['p1']).toEqual([...retro.hands['p1'], retro.deck[0]]);
    expect(next.hands['p2']).toEqual([...retro.hands['p2'], retro.deck[1]]);
    for (const player of next.players) {
      expect(next.hands[player]).toHaveLength(3);
    }

    // The reshuffled discard pile became the deck, minus the 3 cards the others drew from it.
    expect(next.discard).toEqual([]);
    expect(next.deck).toHaveLength(constructed.discard.length - 3);
    expect(next.deck).not.toEqual(constructed.discard.slice(3));

    const everyCard: CardType[] = [...next.deck];
    for (const player of next.players) {
      everyCard.push(...next.hands[player]);
    }
    expect(everyCard.sort()).toEqual(contributionDeck(next.players.length).sort());
  });
});
