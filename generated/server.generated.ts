// @loozo/angular-launch: owned server.generated.ts
import context from "../src/context.js";
import type { HandleOptions } from '@loozo/angular-launch/server';
import { createRequestScope, handleChannelUpgrade, handleRpc, provideLaunchServer } from '@loozo/angular-launch/_server';
import group0 from "../src/routes/+lobby/rpc.js";
import group1 from "../src/routes/rooms/$code/rpc.js";
export const registry = { "lobby": group0, "room": group1 };
export const appBinding = { id: "66b166739e4b8acabd0aa742d044250e6a8f1a35ba43a51d57814ac483abefc2", context };
export const createContext = (request: Request) => createRequestScope(appBinding, request);
export const handleRequest = (request: Request, options: HandleOptions) => handleRpc(registry, appBinding, request, options);
export const handleUpgrade = (request: Request, options: HandleOptions) => handleChannelUpgrade(registry, appBinding, request, options);
export const provideServer = () => provideLaunchServer(registry, appBinding);
