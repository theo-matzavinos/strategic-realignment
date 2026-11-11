import { defineContext } from '@loozo/angular-launch/server';
import { rooms } from './server/rooms';
import { readSessionId } from './server/session';

export default defineContext((request: Request) => ({
  rooms,
  sessionId: readSessionId(request),
}));
