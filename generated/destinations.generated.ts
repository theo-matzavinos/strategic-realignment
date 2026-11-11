// @loozo/angular-router routegen: owned destinations.generated.ts
import type { RouteSet, Handle as GeneratedHandle, Destination as GeneratedDestination } from '@loozo/angular-router/_generated';
import definition__lobby_route from "../src/routes/+lobby/route.js";
import definition_rooms_$code_route from "../src/routes/rooms/$code/route.js";

export type Definitions = {
"src/routes/+lobby/route.ts": typeof definition__lobby_route;
"src/routes/rooms/$code/route.ts": typeof definition_rooms_$code_route;
};
declare const setIdentity: unique symbol;
export type AbsoluteTargets = {
"/": "src/routes/+lobby/route.ts";
"/rooms/$code": "src/routes/rooms/$code/route.ts";
};
export type Parents = {
"src/routes/rooms/$code/route.ts": "src/routes/+lobby/route.ts";
};
/** Declarations with a colocated facade. */
export type Retained =
| "src/routes/+lobby/route.ts"
| "src/routes/rooms/$code/route.ts"
;
export type AbsoluteSelected = {
  readonly [Expression in keyof AbsoluteTargets]: Definitions[AbsoluteTargets[Expression] & keyof Definitions];
};
type ParentOf<Id extends Retained> = Id extends keyof Parents ? Definitions[Parents[Id] & keyof Definitions] : never;
/** A declaration-bound handle; obtain it through its colocated injectRoute facade. */
export type Handle<Id extends Retained> = GeneratedHandle<Definitions[Id], AbsoluteSelected, ParentOf<Id>, typeof setIdentity, Pick<Definitions, Retained>>;
/** A same-set nominal reference; use the destination exported by a colocated facade. */
export type Destination<Id extends Retained> = GeneratedDestination<Definitions[Id], typeof setIdentity, Id>;
const routeSet: RouteSet = { records: {
"src/routes/+lobby/route.ts": { definition: () => definition__lobby_route, owners: ["src/routes/+lobby/route.ts"] },
"src/routes/rooms/$code/route.ts": { definition: () => definition_rooms_$code_route, owners: ["src/routes/rooms/$code/route.ts"] },
}, destinations: {
"src/routes/+lobby/route.ts": () => definition__lobby_route,
"src/routes/rooms/$code/route.ts": () => definition_rooms_$code_route,
}, absolute: {
"/": "src/routes/+lobby/route.ts",
"/rooms/$code": "src/routes/rooms/$code/route.ts",
}, parents: {
"src/routes/rooms/$code/route.ts": "src/routes/+lobby/route.ts",
} };
export function getRouteSet(): RouteSet { return routeSet; }
