import type { Game, PlayerId } from './game';

/**
 * What the rules read from a room to build a player's view. The server's room adds its
 * server-only state (such as session seats) on top; `viewFor` never copies anything else.
 */
export type Room = {
  code: string;
  version: number;
  /** Join order; the creator is host. */
  players: { playerId: PlayerId; name: string; isHost: boolean }[];
  game: Game;
};
