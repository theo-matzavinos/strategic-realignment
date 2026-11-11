import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import { createContext, handleRequest } from '../generated/server.generated';

// Local development only; the deploy slice adds the app's own hostname.
const allowedHosts = ['localhost', '127.0.0.1'];
const angular = new AngularAppEngine({ allowedHosts });

export const reqHandler = createRequestHandler(async (request: Request) => {
  const rpc = await handleRequest(request, { allowedHosts });

  if (rpc) {
    return rpc;
  }

  const scope = await createContext(request);
  const page = await angular.handle(scope.request, scope);

  return page ?? new Response('Not found', { status: 404 });
});
