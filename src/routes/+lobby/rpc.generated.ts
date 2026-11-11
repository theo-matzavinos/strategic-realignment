// @loozo/angular-launch: owned rpc.generated.ts
import { injectClient } from '@loozo/angular-launch/_generated';
import type { Client } from '@loozo/angular-launch';
import type group0 from "./rpc.js";
export type Rpc = { readonly "lobby": Client<typeof group0> };
export function injectRpc(): Rpc { return injectClient({"lobby":{"methods":[{"name":"createRoom","input":true,"kind":"mutation","errors":[]},{"name":"joinRoom","input":true,"kind":"mutation","errors":[{"code":"ROOM_NOT_FOUND","status":404,"message":"No room has this code."},{"code":"ROOM_FULL","status":409,"message":"This room is full."},{"code":"NAME_TAKEN","status":409,"message":"Someone in this room already has this name."},{"code":"GAME_STARTED","status":409,"message":"This game has already started."}]}]}} as const) as Rpc; }
