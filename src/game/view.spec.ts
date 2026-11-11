import { cardTypes } from './cards';
import type { DemandType } from './demands';
import type { Game } from './game';
import { replay } from './replay';
import { inContribute, inEnded, inRetro } from './testing/narrow';
import { roomFor } from './testing/room';
import {
  act,
  allReady,
  audit,
  bestSprint,
  demands,
  findScenario,
  lobby,
  sprint,
  started,
} from './testing/scenario';
import { viewFor } from './view';

const room = roomFor;

describe('viewFor', () => {
  it('shows the lobby with no role, no hand and the board for the current count', () => {
    const view = viewFor(room(lobby(3)), 'p2');

    expect(view).toEqual({
      code: 'KXQM',
      version: 3,
      phase: 'lobby',
      sprint: 1,
      board: { progress: 0, target: 13, morale: 4, debt: 0, auditsLeft: 2 },
      demand: null,
      pastDemands: [],
      me: { playerId: 'p2', role: null, hand: [], contribution: null },
      players: [
        {
          playerId: 'p1',
          name: 'Name of p1',
          isHost: true,
          handSize: 0,
          hasContributed: false,
          isAudited: false,
        },
        {
          playerId: 'p2',
          name: 'Name of p2',
          isHost: false,
          handSize: 0,
          hasContributed: false,
          isAudited: false,
        },
        {
          playerId: 'p3',
          name: 'Name of p3',
          isHost: false,
          handSize: 0,
          hasContributed: false,
          isAudited: false,
        },
      ],
      lastReveal: null,
      vote: null,
      retroReady: [],
      result: null,
    });
  });

  it('shows the started game: own role and hand, public board and first demand', () => {
    const game = started(5, 7);
    const view = viewFor(room(game), 'p3');

    expect(view.phase).toBe('contribute');
    expect(view.sprint).toBe(1);
    expect(view.board).toEqual(game.board);
    expect(view.demand).toBe(game.demands[0]);
    expect(view.pastDemands).toEqual([]);
    expect(view.me).toEqual({
      playerId: 'p3',
      role: game.roles['p3'],
      hand: game.hands['p3'],
      contribution: null,
    });
  });

  for (const [playerCount, seed] of [
    [5, 1],
    [5, 2],
    [6, 3],
    [6, 4],
    [7, 5],
    [7, 6],
  ]) {
    it(`hides everything else from every player (${playerCount} players, seed ${seed})`, () => {
      const game = started(playerCount, seed);
      const viewedRoom = room(game);
      const hidden = game.demands.slice(1);

      for (const playerId of game.players) {
        const view = viewFor(viewedRoom, playerId);

        expect(view.me).toEqual({
          playerId,
          role: game.roles[playerId],
          hand: game.hands[playerId],
          contribution: null,
        });

        for (const player of view.players) {
          expect(Object.keys(player).sort()).toEqual([
            'handSize',
            'hasContributed',
            'isAudited',
            'isHost',
            'name',
            'playerId',
          ]);
          expect(player.handSize).toBe(3);
        }

        const { me, ...everythingButMe } = view;
        const publicJson = JSON.stringify(everythingButMe);
        for (const secret of [
          ...cardTypes,
          'plant',
          'delivery',
          ...hidden,
          ...game.unusedDemands,
        ]) {
          expect(publicJson).not.toContain(secret);
        }
        expect(JSON.stringify(me)).not.toContain('session-of-');
        expect(publicJson).not.toContain('session-of-');
      }
    });
  }

  it("fails clearly when the room's players don't match the game's", () => {
    const game = started(5, 1);

    const extraPlayer = room(game);
    extraPlayer.players.push({ playerId: 'p6', name: 'Name of p6', isHost: false });
    expect(() => viewFor(extraPlayer, 'p1')).toThrow();

    const missingPlayer = room(lobby(5));
    missingPlayer.players.pop();
    expect(() => viewFor(missingPlayer, 'p1')).toThrow();

    const wrongHost = room(lobby(5));
    wrongHost.players[0].isHost = false;
    wrongHost.players[1].isHost = true;
    expect(() => viewFor(wrongHost, 'p1')).toThrow();
  });
});

describe('viewFor during a sprint', () => {
  it('shows your own placement and only whether others have placed theirs', () => {
    const placed = started(5, 7).hands['p2'][0];
    const game = act(started(5, 7), 'p2', { type: 'contribute', card: placed });

    const mine = viewFor(room(game), 'p2');
    expect(mine.me.contribution).toBe(placed);
    expect(mine.me.hand).toHaveLength(2);

    const theirs = viewFor(room(game), 'p3');
    expect(theirs.me.contribution).toBeNull();
    for (const player of theirs.players) {
      expect(player.hasContributed).toBe(player.playerId === 'p2');
      let handSize = 3;
      if (player.playerId === 'p2') {
        handSize = 2;
      }
      expect(player.handSize).toBe(handSize);
    }
  });
});

describe("the rules' example sprint", () => {
  // docs/rules.md, Example sprint: five players, sprint 2 at Progress 8, Debt 1, Morale 4, under
  // The Pen Test Results Are In. Ana (p1) and Ben (p2) cover Testing; the others bring a Feature,
  // a Workaround and a Workshop. Then Chloe (p3) nominates Dimitri (p4), as in the plan.
  const scenario = findScenario(5, [
    demands(['demoTomorrow', 'visibilityReview', 'penTest'], 'penTest'),
    sprint({
      check: (after) =>
        after.phase === 'retro' &&
        after.board.progress === 8 &&
        after.board.debt === 1 &&
        after.board.morale === 4,
    }),
    allReady(),
    sprint({
      cards: ['tests', 'tests', 'feature', 'workaround', 'workshop'],
      by: { p1: 'tests', p2: 'tests' },
    }),
  ]);

  it('resolves as the rules say and shows Ben only his part', () => {
    const game = inRetro(replay(scenario.seed, scenario.players, scenario.log));
    const ben = viewFor(room(game), 'p2');

    expect(ben.phase).toBe('retro');
    expect(ben.sprint).toBe(2);
    expect(ben.board).toEqual({ progress: 9, target: 23, morale: 4, debt: 2, auditsLeft: 2 });
    expect(ben.demand).toBe('penTest');
    expect(ben.pastDemands).toEqual([game.demands[0]]);
    expect(ben.me.role).toBe(game.roles['p2']);
    expect(ben.me.hand).toEqual(game.hands['p2']);
    expect(ben.me.hand).toHaveLength(2);
    expect(ben.me.contribution).toBeNull();

    const reveal = ben.lastReveal;
    expect([...(reveal?.cards ?? [])].sort()).toEqual(
      ['feature', 'tests', 'tests', 'workaround', 'workshop'].sort(),
    );
    expect(reveal?.cards[reveal.mine ?? -1]).toBe('tests');
    expect(reveal).toMatchObject({ sprint: 2, audited: null, oneRemoved: false });
    expect(reveal?.outcome).toEqual({ progress: 1, demandMet: true, incident: false });
    expect(ben.vote).toBeNull();
    expect(ben.retroReady).toEqual([]);
    expect(ben.result).toBeNull();
    for (const player of ben.players) {
      expect(player).toMatchObject({ handSize: 2, hasContributed: false, isAudited: false });
    }
  });

  it('then holds the retro vote on Dimitri and audits him next sprint', () => {
    let game: Game = replay(scenario.seed, scenario.players, scenario.log);
    game = act(game, 'p5', { type: 'finishRetro' });
    expect(viewFor(room(game), 'p2').retroReady).toEqual(['p5']);

    game = act(game, 'p3', { type: 'nominate', nominee: 'p4' });
    expect(viewFor(room(game), 'p2').vote).toEqual({
      nominee: 'p4',
      voted: [],
      mine: null,
      outcome: null,
    });
    expect(viewFor(room(game), 'p2').retroReady).toEqual([]);

    const votes: [string, boolean][] = [
      ['p3', true],
      ['p2', true],
      ['p4', false],
      ['p1', true],
    ];
    const cast = new Map<string, boolean>();
    for (const [player, yes] of votes) {
      game = act(game, player, { type: 'vote', yes });
      cast.set(player, yes);
      for (const viewer of game.players) {
        const view = viewFor(room(game), viewer);
        expect(view.vote?.voted).toEqual([...cast.keys()].sort());
        expect(view.vote?.outcome).toBeNull();
        expect(view.vote?.mine).toBe(cast.get(viewer) ?? null);
      }
    }

    game = act(game, 'p5', { type: 'vote', yes: false });
    const afterVote = viewFor(room(game), 'p2');
    expect(afterVote.vote?.outcome).toEqual({
      passed: true,
      yes: ['p1', 'p2', 'p3'],
      no: ['p4', 'p5'],
    });
    expect(afterVote.board).toMatchObject({ auditsLeft: 1, morale: 3 });
    for (const player of afterVote.players) {
      expect(player.isAudited).toBe(player.playerId === 'p4');
    }

    for (const player of game.players) {
      game = act(game, player, { type: 'finishRetro' });
    }
    const third = inContribute(game);
    const sprintThree = viewFor(room(third), 'p2');
    expect(sprintThree.phase).toBe('contribute');
    expect(sprintThree.sprint).toBe(3);
    expect(sprintThree.vote).toBeNull();
    expect(sprintThree.retroReady).toEqual([]);
    expect(sprintThree.lastReveal?.sprint).toBe(2);
    for (const player of sprintThree.players) {
      expect(player.handSize).toBe(3);
      expect(player.isAudited).toBe(player.playerId === 'p4');
    }

    const dimitrisCard = third.hands['p4'][0];
    for (const player of third.players) {
      game = act(game, player, { type: 'contribute', card: third.hands[player][0] });
    }
    const revealed = viewFor(room(game), 'p2').lastReveal;
    expect(revealed?.sprint).toBe(3);
    expect(revealed?.audited).toEqual({ playerId: 'p4', card: dimitrisCard });
    expect(viewFor(room(game), 'p4').lastReveal?.mine).toBeNull();
  });
});

describe('viewFor after the end', () => {
  it('shows the winner and every role, and nothing of the retro or the sprint', () => {
    const scenario = findScenario(5, [
      bestSprint((after) => after.board.progress),
      allReady(),
      bestSprint((after) => after.board.progress),
      allReady(),
      bestSprint((after) => after.board.progress),
      allReady(),
      bestSprint((after) => after.board.progress),
    ]);
    const game = inEnded(replay(scenario.seed, scenario.players, scenario.log));

    for (const playerId of game.players) {
      const view = viewFor(room(game), playerId);

      expect(view.phase).toBe('ended');
      expect(view.sprint).toBe(4);
      expect(view.result).toEqual({ winner: game.winner, roles: game.roles });
      expect(Object.keys(view.result?.roles ?? {})).toEqual(game.players);
      expect(view.me.role).toBe(game.roles[playerId]);
      expect(view.me.contribution).toBeNull();
      expect(view.lastReveal?.sprint).toBe(4);
      expect(view.vote).toBeNull();
      expect(view.retroReady).toEqual([]);
      for (const player of view.players) {
        expect(player.hasContributed).toBe(false);
        expect(player.isAudited).toBe(false);
      }
    }
  });

  it('shows the deciding vote when a passed audit took Morale to 0', () => {
    const moraleDemands: DemandType[] = ['demoTomorrow', 'visibilityReview'];
    const scenario = findScenario(5, [
      demands(moraleDemands, moraleDemands),
      sprint({ check: (after) => after.phase === 'retro' && after.board.morale === 3 }),
      audit('p1', 'p2', ['p1', 'p2', 'p3']),
      allReady(),
      sprint({ check: (after) => after.phase === 'retro' && after.board.morale === 1 }),
      audit('p4', 'p5', ['p1', 'p2', 'p3', 'p4']),
    ]);
    const game = inEnded(replay(scenario.seed, scenario.players, scenario.log));

    for (const playerId of game.players) {
      const view = viewFor(room(game), playerId);

      expect(view.phase).toBe('ended');
      expect(view.board.morale).toBe(0);
      expect(view.result?.winner).toBe('plant');
      expect(view.vote).toEqual({
        nominee: 'p5',
        voted: ['p1', 'p2', 'p3', 'p4', 'p5'],
        mine: playerId !== 'p5',
        outcome: { passed: true, yes: ['p1', 'p2', 'p3', 'p4'], no: ['p5'] },
      });
      expect(view.retroReady).toEqual([]);
      for (const player of view.players) {
        expect(player.isAudited).toBe(false);
      }
    }
  });
});
