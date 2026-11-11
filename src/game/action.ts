import { z } from 'zod';

/** Every player intention the rules accept. Slice 3 adds contribute, nominate, vote, finishRetro. */
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('startGame') }),
]);

export type Action = z.infer<typeof actionSchema>;
