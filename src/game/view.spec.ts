import { applyAction } from './apply-action';
import { addPlayer, createGame, type Game, type PlayingGame } from './game';
import type { Room } from './room';
import { contributionDeck } from './cards';
import { viewFor } from './view';

function lobby(playerCount: number, seed = 1): Game {
  let game: Game = createGame(seed, 'p1');
  for (let index = 2; index <= playerCount; index++) {
    game = addPlayer(game, `p${index}`);
  }
  return game;
}

function room(game: Game): Room & { seats: Map<string, string> } {
  const players: Room['players'] = [];
  const seats = new Map<string, string>();
  for (const playerId of game.players) {
    players.push({ playerId, name: `Name of ${playerId}`, isHost: playerId === game.host });
    seats.set(`session-of-${playerId}`, playerId);
  }
  return { code: 'KXQM', version: 3, players, seats, game };
}

function started(playerCount: number, seed: number): PlayingGame {
  const result = applyAction(lobby(playerCount, seed), 'p1', { type: 'startGame' });
  if ('code' in result || result.phase !== 'contribute') {
    throw new Error(`startGame was refused: ${JSON.stringify(result)}`);
  }
  return result;
}

const cardTypes = [...new Set(contributionDeck())];

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
