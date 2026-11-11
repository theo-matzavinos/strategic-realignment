// The Cloudflare entry. It's bundled by Wrangler from the built server, so it isn't part of the
// Angular compilation (tsconfig.app.json leaves it out); run `ng build` before `wrangler dev`.
import { createAppHandler, localHosts } from '../dist/strategic-realignment/server/server.mjs';

type Env = {
  ROOMS: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
  /** The deployment's hostname, passed with `wrangler deploy --var APP_HOST:<host>`. Unset locally. */
  APP_HOST?: string;
};

/** The one Durable Object that runs the whole app, so every room lives in its memory. */
export class Rooms {
  readonly #handle: (request: Request) => Promise<Response>;

  constructor(_state: unknown, env: Env) {
    let allowedHosts = localHosts;
    if (env.APP_HOST) {
      allowedHosts = [env.APP_HOST];
    }
    this.#handle = createAppHandler(allowedHosts);
  }

  fetch(request: Request): Promise<Response> {
    return this.#handle(request);
  }
}

export default {
  /** Static files never get here: Workers Static Assets answers them first. */
  fetch(request: Request, env: Env): Promise<Response> {
    const rooms = env.ROOMS.get(env.ROOMS.idFromName('rooms'));

    return rooms.fetch(request);
  },
};
