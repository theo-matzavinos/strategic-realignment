import { viewFor } from '../game/view';
import { Rooms, type ServerRoom } from './rooms';

function roomWith(playerCount: number): ServerRoom {
  const room = new Rooms().create({ sessionId: 's1', name: 'Player 1' });
  for (let index = 2; index <= playerCount; index++) {
    room.join(`s${index}`, `Player ${index}`);
  }
  return room;
}

function hostOf(room: ServerRoom): string {
  return room.players[0].playerId;
}

describe('Rooms.create', () => {
  it('opens a room with a 4-letter code and its creator seated as host', () => {
    const rooms = new Rooms();
    const room = rooms.create({ sessionId: 's1', name: 'Ana' });

    expect(room.code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(rooms.get(room.code)).toBe(room);
    expect(room.version).toBe(1);
    expect(room.players).toEqual([{ playerId: room.seats.get('s1'), name: 'Ana', isHost: true }]);
    expect(room.game.phase).toBe('lobby');
    expect(room.game.players).toEqual([room.players[0].playerId]);
  });

  it('gives every room its own code', () => {
    const rooms = new Rooms();
    const codes = new Set<string>();
    for (let index = 0; index < 200; index++) {
      codes.add(rooms.create({ sessionId: `s${index}`, name: 'Ana' }).code);
    }

    expect(codes.size).toBe(200);
  });
});

describe('ServerRoom.join', () => {
  it('seats a new session in join order and keeps the game roster in step', () => {
    const room = roomWith(1);

    expect(room.join('s2', 'Ben')).toBeNull();

    expect(room.version).toBe(2);
    expect(room.players.map((player) => player.name)).toEqual(['Player 1', 'Ben']);
    expect(room.players[1].isHost).toBe(false);
    expect(room.seats.get('s2')).toBe(room.players[1].playerId);
    expect(room.game.players).toEqual(room.players.map((player) => player.playerId));
  });

  it('gives a seated session its seat back without a change, even after the start', () => {
    const room = roomWith(5);
    const seat = room.seats.get('s2');

    expect(room.join('s2', 'Another name')).toBeNull();
    expect(room.version).toBe(5);
    expect(room.players).toHaveLength(5);

    expect(room.startGame(hostOf(room))).toBeNull();
    expect(room.join('s2', 'Player 2')).toBeNull();
    expect(room.seats.get('s2')).toBe(seat);
  });

  it('refuses a name already in the room, ignoring case', () => {
    const room = roomWith(2);

    expect(room.join('s3', 'player 2')).toBe('NAME_TAKEN');
    expect(room.players).toHaveLength(2);
    expect(room.version).toBe(2);
  });

  it('refuses an 8th player', () => {
    const room = roomWith(7);

    expect(room.join('s8', 'Player 8')).toBe('ROOM_FULL');
    expect(room.players).toHaveLength(7);
    expect(room.seats.has('s8')).toBe(false);
  });

  it('refuses a new player once the game has started', () => {
    const room = roomWith(5);
    room.startGame(hostOf(room));

    expect(room.join('s6', 'Player 6')).toBe('GAME_STARTED');
    expect(room.players).toHaveLength(5);
  });
});

describe('ServerRoom.startGame', () => {
  it('refuses a player who is not the host', () => {
    const room = roomWith(5);

    expect(room.startGame(room.players[1].playerId)).toBe('NOT_HOST');
    expect(room.game.phase).toBe('lobby');
    expect(room.version).toBe(5);
  });

  it('refuses fewer than 5 players', () => {
    const room = roomWith(4);

    expect(room.startGame(hostOf(room))).toBe('NOT_ENOUGH_PLAYERS');
  });

  it("starts the game once, and every player's view shows only their own hand", () => {
    const room = roomWith(5);

    expect(room.startGame(hostOf(room))).toBeNull();
    expect(room.version).toBe(6);
    expect(room.startGame(hostOf(room))).toBe('WRONG_PHASE');

    for (const player of room.players) {
      const view = viewFor(room, player.playerId);
      expect(view.phase).toBe('contribute');
      expect(view.me.hand).toHaveLength(3);
      expect(view.players.map((seat) => seat.handSize)).toEqual([3, 3, 3, 3, 3]);
    }
  });
});

describe('ServerRoom.changedSince', () => {
  function spiedSignal() {
    const controller = new AbortController();
    const added = vi.spyOn(controller.signal, 'addEventListener');
    const removed = vi.spyOn(controller.signal, 'removeEventListener');
    return { controller, added, removed };
  }

  function track(promise: Promise<void>) {
    const state = { settled: false };
    const settled = promise.then(() => {
      state.settled = true;
    });
    return { state, settled };
  }

  it('resolves at once when the version moved before the wait, without listening', async () => {
    const room = roomWith(1);
    const { controller, added } = spiedSignal();
    const sentVersion = room.version;

    room.join('s2', 'Ben');
    await room.changedSince(sentVersion, controller.signal);

    expect(added).not.toHaveBeenCalled();
  });

  it('resolves on the next change and removes its abort listener', async () => {
    const room = roomWith(1);
    const { controller, added, removed } = spiedSignal();
    const waiting = track(room.changedSince(room.version, controller.signal));

    await Promise.resolve();
    expect(waiting.state.settled).toBe(false);

    room.join('s2', 'Ben');
    await waiting.settled;

    expect(added).toHaveBeenCalledTimes(1);
    expect(removed).toHaveBeenCalledWith('abort', added.mock.calls[0][1]);
  });

  it('resolves on abort and removes its abort listener', async () => {
    const room = roomWith(1);
    const { controller, added, removed } = spiedSignal();
    const waiting = track(room.changedSince(room.version, controller.signal));

    await Promise.resolve();
    expect(waiting.state.settled).toBe(false);

    controller.abort();
    await waiting.settled;

    expect(removed).toHaveBeenCalledWith('abort', added.mock.calls[0][1]);
  });

  it('resolves at once for a signal that has already aborted', async () => {
    const room = roomWith(1);
    const { controller, added } = spiedSignal();
    controller.abort();

    await room.changedSince(room.version, controller.signal);

    expect(added).not.toHaveBeenCalled();
  });

  it('wakes every waiting stream on one change', async () => {
    const room = roomWith(1);
    const first = track(room.changedSince(room.version, new AbortController().signal));
    const second = track(room.changedSince(room.version, new AbortController().signal));

    room.join('s2', 'Ben');
    await Promise.all([first.settled, second.settled]);

    expect(first.state.settled && second.state.settled).toBe(true);
  });
});
