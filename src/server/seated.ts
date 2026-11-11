import {
  forbidden,
  middleware,
  type Context,
  type MiddlewareArgs,
} from '@loozo/angular-launch/server';

/**
 * Lets a call through only for a session seated in the room it names, adding that `room` and the
 * caller's `player`. Anyone else gets `FORBIDDEN`, whether the room is missing or they have no
 * seat in it: middleware can't throw declared errors in Launch 0.0.6.
 */
export const seated = middleware(
  async ({ context, input, next }: MiddlewareArgs<Context, { code: string }>) => {
    const room = context.rooms.get(input.code);
    if (room === undefined || context.sessionId === null) {
      throw forbidden();
    }

    const playerId = room.seats.get(context.sessionId);
    const player = room.players.find((candidate) => candidate.playerId === playerId);
    if (player === undefined) {
      throw forbidden();
    }

    return next({ room, player });
  },
);
