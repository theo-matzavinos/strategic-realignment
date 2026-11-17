import { z } from 'zod';
import { actionSchema } from './action';
import { replay } from './replay';
import { seats, started } from './testing/scenario';
import v0Games from './testing/v0-games.json';

/**
 * 5–7-player games recorded at b688b8b, before rules v0 grew to 10 players. Setup and every later
 * step must stay identical: same deal order, same randomness, same final canonical state. If a
 * deliberate rule change alters 5–7 games, recapture this file from that change's base commit.
 */
const fixture = z
  .object({
    capturedFrom: z.string(),
    games: z.array(
      z.object({
        playerCount: z.number(),
        seed: z.number(),
        log: z.array(z.object({ playerId: z.string(), action: actionSchema })),
        setup: z.unknown(),
        final: z.unknown(),
      }),
    ),
  })
  .parse(v0Games);

describe(`5–7-player games recorded at ${fixture.capturedFrom.slice(0, 7)}`, () => {
  for (const game of fixture.games) {
    it(`${game.playerCount} players, seed ${game.seed}, deal and replay unchanged`, () => {
      expect(started(game.playerCount, game.seed)).toEqual(game.setup);
      expect(replay(game.seed, seats(game.playerCount), game.log)).toEqual(game.final);
    });
  }
});
