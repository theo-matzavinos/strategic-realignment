import { z } from 'zod';
import { cardTypes } from './cards';

/** Every player intention the rules accept. */
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('startGame') }),
  z.object({ type: z.literal('contribute'), card: z.enum(cardTypes) }),
  z.object({ type: z.literal('nominate'), nominee: z.string() }),
  z.object({ type: z.literal('vote'), yes: z.boolean() }),
  z.object({ type: z.literal('finishRetro') }),
]);

export type Action = z.infer<typeof actionSchema>;
