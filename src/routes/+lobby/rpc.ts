import { defineRpc } from '@loozo/angular-launch/server';
import { z } from 'zod';
import { createRoomInput, joinRoomInput } from '../../room-input';
import { newSessionId, setSessionCookie } from '../../server/session';

export default defineRpc('lobby', ({ mutation }) => ({
  createRoom: mutation({
    input: createRoomInput,
    handler: ({ context, input, response }) => {
      const sessionId = context.sessionId ?? newSessionId();
      const room = context.rooms.create({ sessionId, name: input.name });
      setSessionCookie(response, sessionId);

      return { code: room.code };
    },
  }),
  joinRoom: mutation({
    input: joinRoomInput,
    errors: {
      ROOM_NOT_FOUND: { status: 404, message: 'No room has this code.', data: z.null() },
      ROOM_FULL: { status: 409, message: 'This room is full.', data: z.null() },
      NAME_TAKEN: {
        status: 409,
        message: 'Someone in this room already has this name.',
        data: z.null(),
      },
      GAME_STARTED: { status: 409, message: 'This game has already started.', data: z.null() },
    },
    handler: ({ context, input, response, errors }) => {
      const room = context.rooms.get(input.code);
      if (room === undefined) {
        throw errors.ROOM_NOT_FOUND(null);
      }

      const sessionId = context.sessionId ?? newSessionId();
      const refusal = room.join(sessionId, input.name);
      if (refusal !== null) {
        throw errors[refusal](null);
      }

      setSessionCookie(response, sessionId);

      return { code: room.code };
    },
  }),
}));
