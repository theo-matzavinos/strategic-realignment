import { randomGame } from '../../../game/testing/random-play';
import { roomFor } from '../../../game/testing/room';
import { viewFor } from '../../../game/view';
import { winnerPhrase } from './display-names';

/** The result of the first random game at this count that `winner` wins. */
function resultOf(playerCount: number, winner: 'plant' | 'delivery') {
  for (let seed = 1; seed < 200; seed++) {
    const game = randomGame(seed, playerCount);
    if (game.phase === 'ended' && game.winner === winner) {
      return viewFor(roomFor(game), game.players[0]).result!;
    }
  }

  throw new Error(`No ${winner} win at ${playerCount} players`);
}

describe('winnerPhrase', () => {
  it('names one Management Plant at 5–7 players', () => {
    for (const playerCount of [5, 7]) {
      expect(winnerPhrase(resultOf(playerCount, 'plant'))).toBe('Management Plant wins');
    }
  });

  it('names both Management Plants at 8–10 players, who win together', () => {
    for (const playerCount of [8, 10]) {
      expect(winnerPhrase(resultOf(playerCount, 'plant'))).toBe('Management Plants win');
    }
  });

  it('names the Delivery Team at any count', () => {
    for (const playerCount of [5, 10]) {
      expect(winnerPhrase(resultOf(playerCount, 'delivery'))).toBe('Delivery Team wins');
    }
  });
});
