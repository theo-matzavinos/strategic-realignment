import { defineRpc } from '@loozo/angular-launch/server';
import { z } from 'zod';
import { cardTypes } from '../../../game/cards';
import { viewFor } from '../../../game/view';
import { roomInput } from '../../../room-input';
import { seated } from '../../../server/seated';

/**
 * One mutation per action, each through `room.act`. Each declares only the refusals its action can
 * return: 409 when the game's state doesn't allow it, 400 when the choice itself is invalid. An
 * accepted one returns `{ version }`, the room version right after it.
 */
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
      const result = context.room.act(context.player.playerId, { type: 'startGame' });
      if (typeof result === 'string') {
        throw errors[result](null);
      }

      return result;
    },
  }),
  contribute: mutation({
    input: roomInput.extend({ card: z.enum(cardTypes) }),
    use: [seated],
    errors: {
      WRONG_PHASE: {
        status: 409,
        message: 'Cards can only be placed while the team contributes.',
        data: z.null(),
      },
      ALREADY_CONTRIBUTED: {
        status: 409,
        message: "You've already placed your card this sprint.",
        data: z.null(),
      },
      CARD_NOT_IN_HAND: { status: 409, message: "That card isn't in your hand.", data: z.null() },
    },
    handler: ({ context, input, errors }) => {
      const result = context.room.act(context.player.playerId, {
        type: 'contribute',
        card: input.card,
      });
      if (typeof result === 'string') {
        throw errors[result](null);
      }

      return result;
    },
  }),
  nominate: mutation({
    input: roomInput.extend({ nominee: z.string() }),
    use: [seated],
    errors: {
      WRONG_PHASE: {
        status: 409,
        message: 'Nominations happen only in the retro.',
        data: z.null(),
      },
      VOTE_ALREADY_HELD: {
        status: 409,
        message: 'This retro already has its audit vote.',
        data: z.null(),
      },
      NO_AUDITS_LEFT: { status: 409, message: 'The team has no audits left.', data: z.null() },
      UNKNOWN_PLAYER: { status: 400, message: "That player isn't in this game.", data: z.null() },
      SELF_NOMINATION: { status: 400, message: "You can't nominate yourself.", data: z.null() },
    },
    handler: ({ context, input, errors }) => {
      const result = context.room.act(context.player.playerId, {
        type: 'nominate',
        nominee: input.nominee,
      });
      if (typeof result === 'string') {
        throw errors[result](null);
      }

      return result;
    },
  }),
  vote: mutation({
    input: roomInput.extend({ yes: z.boolean() }),
    use: [seated],
    errors: {
      WRONG_PHASE: { status: 409, message: 'Votes happen only in the retro.', data: z.null() },
      NO_VOTE_OPEN: { status: 409, message: 'There is no audit vote to vote in.', data: z.null() },
      ALREADY_VOTED: { status: 409, message: "You've already voted.", data: z.null() },
    },
    handler: ({ context, input, errors }) => {
      const result = context.room.act(context.player.playerId, { type: 'vote', yes: input.yes });
      if (typeof result === 'string') {
        throw errors[result](null);
      }

      return result;
    },
  }),
  finishRetro: mutation({
    input: roomInput,
    use: [seated],
    errors: {
      WRONG_PHASE: { status: 409, message: "There's no retro to end right now.", data: z.null() },
      VOTE_OPEN: {
        status: 409,
        message: 'Wait until everyone has voted before marking ready.',
        data: z.null(),
      },
      ALREADY_READY: { status: 409, message: "You're already ready.", data: z.null() },
    },
    handler: ({ context, errors }) => {
      const result = context.room.act(context.player.playerId, { type: 'finishRetro' });
      if (typeof result === 'string') {
        throw errors[result](null);
      }

      return result;
    },
  }),
}));
