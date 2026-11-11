import { defineRpc } from '@loozo/angular-launch/server';
import { z } from 'zod';
import { viewFor } from '../../../game/view';
import { roomInput } from '../../../room-input';
import { seated } from '../../../server/seated';

export default defineRpc('room', ({ stream, mutation }) => ({
  view: stream({
    input: roomInput,
    use: [seated],
    handler: async function* ({ context, signal }) {
      const { room, player } = context;
      let sentVersion = -1;

      while (!signal.aborted) {
        if (room.version > sentVersion) {
          sentVersion = room.version;
          yield viewFor(room, player.playerId);
        }

        await room.changedSince(sentVersion, signal); // resolves at once if the version already moved
      }
    },
  }),
  startGame: mutation({
    input: roomInput,
    use: [seated],
    errors: {
      NOT_HOST: { status: 403, message: 'Only the host can start the game.', data: z.null() },
      NOT_ENOUGH_PLAYERS: {
        status: 409,
        message: 'The game needs at least 5 players.',
        data: z.null(),
      },
      WRONG_PHASE: { status: 409, message: 'The game has already started.', data: z.null() },
    },
    handler: ({ context, errors }) => {
      const refusal = context.room.startGame(context.player.playerId);
      if (refusal !== null) {
        throw errors[refusal](null);
      }

      return null;
    },
  }),
}));
