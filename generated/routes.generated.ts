// @loozo/angular-router routegen: owned routes.generated.ts
import type { Routes } from '@angular/router';
import { getRouteSet } from './destinations.generated.js';
import { callbacks } from '@loozo/angular-router/_generated';

/**
 * Generated native Angular route configuration; install with provideRouter(routes).
 * Regenerate through the router's Architect companions instead of editing this file.
 */
export const routes: Routes = [{ path: "",
pathMatch: 'full',
data: { __loozoAngularRouterRouteId: "src/routes/+lobby/route.ts" },
loadComponent: () => import("../src/routes/+lobby/page") },
{ path: "rooms/:code",
data: { __loozoAngularRouterRouteId: "src/routes/rooms/$code/route.ts" },
...callbacks(getRouteSet(), "src/routes/rooms/$code/route.ts"),
loadComponent: () => import("../src/routes/rooms/$code/page") }];
