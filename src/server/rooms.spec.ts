import { cardTypes, type CardType } from '../game/cards';
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

const start = { type: 'startGame' } as const;

function startedRoom(playerCount: number): ServerRoom {
  const room = roomWith(playerCount);
  // Version 1 at creation, then one per join.
  expect(room.act(hostOf(room), start)).toEqual({ version: playerCount + 1 });
  return room;
}

/** A card type the player doesn't hold. Hands hold 3 cards of 6 types, so there always is one. */
function cardNotIn(hand: CardType[]): CardType {
  const missing = cardTypes.find((card) => !hand.includes(card));
  if (missing === undefined) {
    throw new Error('The hand holds every card type');
  }
  return missing;
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

    expect(room.act(hostOf(room), start)).toEqual({ version: 6 });
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
    room.act(hostOf(room), start);

    expect(room.join('s6', 'Player 6')).toBe('GAME_STARTED');
    expect(room.players).toHaveLength(5);
  });
});

describe('ServerRoom.act: startGame', () => {
  it('refuses a player who is not the host', () => {
    const room = roomWith(5);

    expect(room.act(room.players[1].playerId, start)).toBe('NOT_HOST');
    expect(room.game.phase).toBe('lobby');
    expect(room.version).toBe(5);
  });

  it('refuses fewer than 5 players', () => {
    const room = roomWith(4);

    expect(room.act(hostOf(room), start)).toBe('NOT_ENOUGH_PLAYERS');
  });

  it("starts the game once, and every player's view shows only their own hand", () => {
    const room = roomWith(5);

    expect(room.act(hostOf(room), start)).toEqual({ version: 6 });
    expect(room.version).toBe(6);
    expect(room.act(hostOf(room), start)).toBe('WRONG_PHASE');

    for (const player of room.players) {
      const view = viewFor(room, player.playerId);
      expect(view.phase).toBe('contribute');
      expect(view.me.hand).toHaveLength(3);
      expect(view.players.map((seat) => seat.handSize)).toEqual([3, 3, 3, 3, 3]);
    }
  });
});

describe('ServerRoom.act: the rest of the game', () => {
  it('stores an accepted contribution, moves the version on by one and returns it', () => {
    const room = startedRoom(5);
    const player = room.players[1].playerId;
    const [card] = viewFor(room, player).me.hand;

    expect(room.act(player, { type: 'contribute', card })).toEqual({ version: 7 });

    expect(room.version).toBe(7);
    const view = viewFor(room, player);
    expect(view.me.contribution).toBe(card);
    expect(view.me.hand).toHaveLength(2);
  });

  it('refuses a second contribution and a card not in hand, changing nothing', () => {
    const room = startedRoom(5);
    const [first, second] = room.players;
    const firstHand = viewFor(room, first.playerId).me.hand;
    room.act(first.playerId, { type: 'contribute', card: firstHand[0] });
    const game = room.game;
    const version = room.version;

    expect(room.act(first.playerId, { type: 'contribute', card: firstHand[1] })).toBe(
      'ALREADY_CONTRIBUTED',
    );
    const secondHand = viewFor(room, second.playerId).me.hand;
    expect(room.act(second.playerId, { type: 'contribute', card: cardNotIn(secondHand) })).toBe(
      'CARD_NOT_IN_HAND',
    );

    expect(room.game).toBe(game);
    expect(room.version).toBe(version);
  });

  it('plays a sprint, a retro vote and ready marks through the same path', () => {
    const room = startedRoom(5);
    const ids = room.players.map((player) => player.playerId);
    for (const id of ids) {
      const [card] = viewFor(room, id).me.hand;
      const version = room.version;
      expect(room.act(id, { type: 'contribute', card })).toEqual({ version: version + 1 });
    }
    expect(room.game.phase).toBe('retro');

    expect(room.act(ids[0], { type: 'nominate', nominee: ids[0] })).toBe('SELF_NOMINATION');
    expect(room.act(ids[0], { type: 'finishRetro' })).toEqual({ version: 12 });
    expect(room.act(ids[0], { type: 'nominate', nominee: ids[1] })).toEqual({ version: 13 });
    expect(room.act(ids[2], { type: 'finishRetro' })).toBe('VOTE_OPEN');
    for (const id of ids) {
      const version = room.version;
      expect(room.act(id, { type: 'vote', yes: false })).toEqual({ version: version + 1 });
    }
    const beforeReady = room.version;
    for (const id of ids) {
      const version = room.version;
      expect(room.act(id, { type: 'finishRetro' })).toEqual({ version: version + 1 });
    }

    expect(room.version).toBe(beforeReady + 5);
    expect(room.game.phase).toBe('contribute');
    expect(viewFor(room, ids[0]).sprint).toBe(2);
  });

  it('wakes a waiting stream on an accepted action, and not on a refused one', async () => {
    const room = startedRoom(5);
    const player = room.players[0].playerId;
    let woken = false;
    const waiting = room.changedSince(room.version, new AbortController().signal).then(() => {
      woken = true;
    });

    room.act(player, { type: 'finishRetro' });
    await Promise.resolve();
    expect(woken).toBe(false);

    const [card] = viewFor(room, player).me.hand;
    room.act(player, { type: 'contribute', card });
    await waiting;
    expect(woken).toBe(true);
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
