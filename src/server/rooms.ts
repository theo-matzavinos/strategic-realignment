import { applyAction, type ActionErrorCode } from '../game/apply-action';
import { addPlayer, createGame, maxPlayers, type Game, type PlayerId } from '../game/game';
import type { Room } from '../game/room';
import type { SessionId } from './session';

type Player = Room['players'][number];

export type JoinRefusal = 'GAME_STARTED' | 'ROOM_FULL' | 'NAME_TAKEN';

/** A–Z without I and O, which read like 1 and 0. */
const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const codeLength = 4;

/**
 * A room as the server holds it: what the rules read, plus which session sits in which seat.
 * Its state changes only through its own methods, and every accepted change moves `version` on by
 * one and wakes the streams waiting in `changedSince`.
 */
export class ServerRoom implements Room {
  readonly #code: string;
  #version = 1;
  /** Join order; the creator is host. Kept in step with `#game.players`. */
  readonly #players: Player[];
  #game: Game;
  /** Server-only; never in a view. */
  readonly #seats = new Map<SessionId, PlayerId>();
  readonly #waiters = new Set<() => void>();

  constructor(code: string, host: { sessionId: SessionId; name: string }) {
    const playerId = crypto.randomUUID();
    this.#code = code;
    this.#game = createGame(randomSeed(), playerId);
    this.#players = [{ playerId, name: host.name, isHost: true }];
    this.#seats.set(host.sessionId, playerId);
  }

  get code(): string {
    return this.#code;
  }

  get version(): number {
    return this.#version;
  }

  get players(): Player[] {
    return this.#players;
  }

  get game(): Game {
    return this.#game;
  }

  get seats(): ReadonlyMap<SessionId, PlayerId> {
    return this.#seats;
  }

  /**
   * Seats a session under `name`, or says why it can't. A session that already has a seat here
   * keeps it, whatever the name, so a retried join after a lost response gets its seat back.
   */
  join(sessionId: SessionId, name: string): JoinRefusal | null {
    if (this.#seats.has(sessionId)) {
      return null;
    }

    if (this.#game.phase !== 'lobby') {
      return 'GAME_STARTED';
    }

    if (this.#players.length >= maxPlayers) {
      return 'ROOM_FULL';
    }

    const lowerName = name.toLowerCase();
    for (const player of this.#players) {
      if (player.name.toLowerCase() === lowerName) {
        return 'NAME_TAKEN';
      }
    }

    const playerId = crypto.randomUUID();
    this.#game = addPlayer(this.#game, playerId);
    this.#players.push({ playerId, name, isHost: false });
    this.#seats.set(sessionId, playerId);
    this.#changed();

    return null;
  }

  /** Starts the game for `playerId` through the rules, or says why the rules refused. */
  startGame(playerId: PlayerId): ActionErrorCode<'startGame'> | null {
    const result = applyAction(this.#game, playerId, { type: 'startGame' });
    if ('code' in result) {
      return result.code;
    }

    this.#game = result;
    this.#changed();

    return null;
  }

  /**
   * Resolves once `version` moves past `version`, at once if it already has, or when `signal`
   * aborts. Either way it leaves no waiter or abort listener behind.
   */
  changedSince(version: number, signal: AbortSignal): Promise<void> {
    if (this.#version > version || signal.aborted) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const settle = () => {
        this.#waiters.delete(settle);
        signal.removeEventListener('abort', settle);
        resolve();
      };

      this.#waiters.add(settle);
      signal.addEventListener('abort', settle, { once: true });
    });
  }

  #changed(): void {
    this.#version += 1;

    for (const settle of [...this.#waiters]) {
      settle();
    }
  }
}

/** Every room in this process, by code. The only place rooms are created. */
export class Rooms {
  readonly #rooms = new Map<string, ServerRoom>();

  get(code: string): ServerRoom | undefined {
    return this.#rooms.get(code);
  }

  /** Opens a room with a fresh code, its creator seated as host. */
  create(host: { sessionId: SessionId; name: string }): ServerRoom {
    let code = randomCode();
    while (this.#rooms.has(code)) {
      code = randomCode();
    }

    const room = new ServerRoom(code, host);
    this.#rooms.set(code, room);

    return room;
  }
}

export const rooms = new Rooms();

function randomCode(): string {
  // 240 is the largest multiple of 24 that fits in a byte; rejecting the rest keeps letters uniform.
  const usableBytes = 240;
  let code = '';
  while (code.length < codeLength) {
    const [byte] = crypto.getRandomValues(new Uint8Array(1));
    if (byte < usableBytes) {
      code += codeAlphabet[byte % codeAlphabet.length];
    }
  }

  return code;
}

function randomSeed(): number {
  const [seed] = crypto.getRandomValues(new Uint32Array(1));

  return seed;
}
