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

/** What every game past the lobby holds. */
type SeatedGame = GameBase & {
  sprint: Sprint;
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
  /** Contributes face up this sprint. Only set in `contribute`. */
  audited: PlayerId | null;
  /** The latest reveal; kept until the next one. */
  lastReveal: StoredReveal | null;
};

export type Sprint = 1 | 2 | 3 | 4;

/** A reveal as the server keeps it. Owners and the removed card never leave the server. */
export type StoredReveal = {
  sprint: Sprint;
  /** The face-down cards in their shuffled order, without the removed one. */
  cards: { card: CardType; playerId: PlayerId }[];
  audited: { playerId: PlayerId; card: CardType } | null;
  /** The card The Sprint Is Now One Week removed; never in any view. */
  removed: { card: CardType; playerId: PlayerId } | null;
  outcome: RevealOutcome;
};

export type RevealOutcome = {
  /** Progress the revealed cards added, after Workshop reductions. */
  progress: number;
  /** Null when the demand has no requirement. */
  demandMet: boolean | null;
  incident: boolean;
};

export type ContributeGame = SeatedGame & {
  phase: 'contribute';
  /** This sprint's placements so far. */
  contributions: Record<PlayerId, CardType>;
};

/** A retro's audit vote: whom it's on, and each vote cast so far. */
export type AuditVote = { nominee: PlayerId; votes: Record<PlayerId, boolean> };

export type RetroGame = SeatedGame & {
  phase: 'retro';
  /** This retro's one vote, once someone has nominated. */
  vote: AuditVote | null;
  /** Players ready to end the retro, in the order they marked it. */
  ready: PlayerId[];
  /** Contributes face up next sprint; set when the vote passes. */
  nextAudited: PlayerId | null;
};

export type EndedGame = SeatedGame & {
  phase: 'ended';
  winner: Role;
  /** The passed audit vote that took Morale to 0 and ended the game; null for any other end. */
  vote: AuditVote | null;
};

export type Game = LobbyGame | ContributeGame | RetroGame | EndedGame;

export const minPlayers = 5;
export const handSize = 3;
export const maxPlayers = 7;

/** The game's latest revealed demand: this sprint's. */
export function currentDemand(game: ContributeGame | RetroGame | EndedGame): DemandType {
  return game.demands[game.revealedDemands - 1];
}

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
