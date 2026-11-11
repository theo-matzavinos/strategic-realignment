import { applyAction, type RuleError } from './apply-action';
import { addPlayer, createGame, type Game, type LoggedAction, type PlayerId } from './game';

/**
 * Rebuilds a game from its seed, its players in join order (the first is host) and its log of
 * accepted actions. Throws if the log holds an action the rules refuse.
 */
export function replay(seed: number, players: PlayerId[], log: LoggedAction[]): Game {
  let game: Game = createGame(seed, players[0]);
  for (const player of players.slice(1)) {
    game = addPlayer(game, player);
  }

  for (const { playerId, action } of log) {
    const result: Game | RuleError = applyAction(game, playerId, action);
    if ('code' in result) {
      throw new Error(`${action.type} by ${playerId} was refused: ${result.code}`);
    }
    game = result;
  }

  return game;
}
