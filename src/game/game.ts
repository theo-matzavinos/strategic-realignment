import type { Action } from './action';
import type { CardType } from './cards';
import type { DemandType } from './demands';
import type { RandomState } from './random';

export type PlayerId = string;

export type Role = 'plant' | 'delivery';

export type Board = {
  progress: number;
  target: number;
  morale: number;
  debt: number;
  auditsLeft: number;
};

export type LoggedAction = { playerId: PlayerId; action: Action };

type GameBase = {
  seed: number;
  random: RandomState;
  host: PlayerId;
  /** Join order. */
  players: PlayerId[];
  /** Every accepted action, in order. Replaying it from `seed` and `players` reproduces the game. */
  log: LoggedAction[];
};

export type LobbyGame = GameBase & { phase: 'lobby' };

export type PlayingGame = GameBase & {
  phase: 'contribute';
  sprint: 1 | 2 | 3 | 4;
  board: Board;
  roles: Record<PlayerId, Role>;
  hands: Record<PlayerId, CardType[]>;
  deck: CardType[];
  discard: CardType[];
  /** This game's 4 demands, in reveal order. */
  demands: DemandType[];
  /** How many of `demands` have been revealed; the last revealed one is this sprint's. */
  revealedDemands: number;
  /** The 2 demands returned to the box; never revealed. */
  unusedDemands: DemandType[];
};

export type Game = LobbyGame | PlayingGame;

export const minPlayers = 5;
export const maxPlayers = 7;

export const startingBoard: Omit<Board, 'target'> = {
  progress: 0,
  morale: 4,
  debt: 0,
  auditsLeft: 2,
};

export function startingTarget(playerCount: number): number {
  return 5 * playerCount - 2;
}

/** A new lobby with its creator as host. `seed` must be a 32-bit unsigned integer. */
export function createGame(seed: number, host: PlayerId): LobbyGame {
  return { phase: 'lobby', seed, random: seed, host, players: [host], log: [] };
}

/** Seats a player in the lobby. The caller checks that the lobby isn't full or started. */
export function addPlayer(game: Game, playerId: PlayerId): LobbyGame {
  if (game.phase !== 'lobby') {
    throw new Error(`Can't add a player in phase ${game.phase}`);
  }

  if (game.players.length >= maxPlayers) {
    throw new Error(`The lobby already has ${maxPlayers} players`);
  }

  if (game.players.includes(playerId)) {
    throw new Error(`Player ${playerId} is already seated`);
  }

  return { ...game, players: [...game.players, playerId] };
}
