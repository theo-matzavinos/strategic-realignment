import { z } from 'zod';

/**
 * The inputs players type to create or join a room. The lobby RPCs validate with these, and the
 * forms check the same schemas before sending.
 */
export const playerNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name.')
  .max(20, 'Use at most 20 characters.');

/** Upper-cased, so a code typed in lower case still finds its room. */
export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{4}$/, 'A room code is 4 letters.');

export const createRoomInput = z.object({ name: playerNameSchema });

export const joinRoomInput = z.object({ code: roomCodeSchema, name: playerNameSchema });

export const roomInput = z.object({ code: roomCodeSchema });
