import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import { createContext, handleRequest } from '../generated/server.generated';

/** Hosts for local runs (`ng serve`, `wrangler dev`). A deployment passes its own hostname instead. */
export const localHosts = ['localhost', '127.0.0.1'];

/**
 * The app's request handler, accepting only requests addressed to `allowedHosts`. The Worker builds
 * it with the deployment's hostname, which stays out of the repository.
 */
export function createAppHandler(allowedHosts: string[]): (request: Request) => Promise<Response> {
  const angular = new AngularAppEngine({ allowedHosts });

  return async (request: Request) => {
    const rpc = await handleRequest(request, { allowedHosts });

    if (rpc) {
      return rpc;
    }

    const scope = await createContext(request);
    const page = await angular.handle(scope.request, scope);

    return page ?? new Response('Not found', { status: 404 });
  };
}

export const reqHandler = createRequestHandler(createAppHandler(localHosts));
