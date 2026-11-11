import type { Action } from '../action';
import type { Game, LoggedAction, PlayerId } from '../game';
import { nextRandom, type RandomState } from '../random';
import { act, lobby } from './scenario';

/**
 * Test-only: plays a whole game with random legal actions, from its own seeded randomness. Every
 * action it picks must be accepted, so it also checks that the rules accept what they should.
 */
export function randomGame(seed: number, playerCount: number): Game {
  let game = lobby(playerCount, seed);
  let random: RandomState = (seed * 2654435761) >>> 0;

  function pick<T>(items: T[]): T {
    const next = nextRandom(random);
    random = next.state;
    return items[Math.floor(next.value * items.length)];
  }

  function chance(probability: number): boolean {
    const next = nextRandom(random);
    random = next.state;
    return next.value < probability;
  }

  while (game.phase !== 'ended') {
    const { playerId, action } = nextAction(game, pick, chance);
    game = act(game, playerId, action);
  }

  return game;
}

function nextAction(
  game: Game,
  pick: <T>(items: T[]) => T,
  chance: (probability: number) => boolean,
): LoggedAction {
  switch (game.phase) {
    case 'lobby': {
      return { playerId: game.host, action: { type: 'startGame' } };
    }

    case 'contribute': {
      const options: LoggedAction[] = [];
      for (const player of game.players) {
        if (Object.hasOwn(game.contributions, player)) {
          continue;
        }
        for (const card of new Set(game.hands[player])) {
          options.push({ playerId: player, action: { type: 'contribute', card } });
        }
      }
      return pick(options);
    }

    case 'retro': {
      const { vote } = game;
      if (vote !== null) {
        const unvoted: PlayerId[] = [];
        for (const player of game.players) {
          if (!Object.hasOwn(vote.votes, player)) {
            unvoted.push(player);
          }
        }
        if (unvoted.length > 0) {
          const action: Action = { type: 'vote', yes: chance(0.6) };
          return { playerId: pick(unvoted), action };
        }
      }

      const canNominate = vote === null && game.board.auditsLeft > 0;
      if (canNominate && chance(0.3)) {
        const nominator = pick(game.players);
        const others = game.players.filter((player) => player !== nominator);
        return { playerId: nominator, action: { type: 'nominate', nominee: pick(others) } };
      }

      const notReady = game.players.filter((player) => !game.ready.includes(player));
      return { playerId: pick(notReady), action: { type: 'finishRetro' } };
    }

    case 'ended': {
      throw new Error('An ended game has no next action');
    }
  }
}
