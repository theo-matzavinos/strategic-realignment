// @loozo/angular-launch: owned context.generated.d.ts
import type { ContextOf } from '@loozo/angular-launch/server';
import type context from "../src/context.js";
declare module '@loozo/angular-launch/server' { interface Register { context: ContextOf<typeof context>; } }
