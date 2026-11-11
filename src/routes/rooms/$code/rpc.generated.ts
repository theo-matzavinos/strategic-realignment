// @loozo/angular-launch: owned rpc.generated.ts
import { injectClient } from '@loozo/angular-launch/_generated';
import type { Client } from '@loozo/angular-launch';
import type group0 from "./rpc.js";
export type Rpc = { readonly "room": Client<typeof group0> };
export function injectRpc(): Rpc { return injectClient({"room":{"methods":[{"name":"view","input":true,"kind":"stream","errors":[]},{"name":"startGame","input":true,"kind":"mutation","errors":[{"code":"NOT_HOST","status":403,"message":"Only the host can start the game."},{"code":"NOT_ENOUGH_PLAYERS","status":409,"message":"The game needs at least 5 players."},{"code":"WRONG_PHASE","status":409,"message":"The game has already started."}]}]}} as const) as Rpc; }
