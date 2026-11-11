// The Cloudflare entry. It's bundled by Wrangler from the built server, so it isn't part of the
// Angular compilation (tsconfig.app.json leaves it out); run `ng build` before `wrangler dev`.
import { reqHandler } from '../dist/strategic-realignment/server/server.mjs';

type Env = {
  ROOMS: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
};

/** The one Durable Object that runs the whole app, so every room lives in its memory. */
export class Rooms {
  fetch(request: Request): Promise<Response> {
    return reqHandler(request);
  }
}

export default {
  /** Static files never get here: Workers Static Assets answers them first. */
  fetch(request: Request, env: Env): Promise<Response> {
    const rooms = env.ROOMS.get(env.ROOMS.idFromName('rooms'));

    return rooms.fetch(request);
  },
};
