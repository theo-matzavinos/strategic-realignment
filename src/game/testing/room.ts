import type { Game } from '../game';
import type { Room } from '../room';

/**
 * Test-only: a room around a game, named after its players, with session seats on top as the
 * server's room has them, so a view test can check that no session id leaks.
 */
export function roomFor(game: Game, version = 3): Room & { seats: Map<string, string> } {
  const players: Room['players'] = [];
  const seats = new Map<string, string>();
  for (const playerId of game.players) {
    players.push({ playerId, name: `Name of ${playerId}`, isHost: playerId === game.host });
    seats.set(`session-of-${playerId}`, playerId);
  }
  return { code: 'KXQM', version, players, seats, game };
}
