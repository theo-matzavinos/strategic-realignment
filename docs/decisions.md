# Decisions

One entry per decision: what we were deciding, the options, what we chose and why. Newest last. If a decision is reversed, add a new entry that supersedes it instead of editing the old one.

## D1. Genre: hidden-role social deduction

**2026-11-11**

**Options:**

- **Hidden-role deduction:** a team against a secret saboteur. Turn-based, with per-player hidden information.
- **Competitive card game:** players race each other for one promotion. Turn-based, hidden hands, works with 2 players.
- **Real-time co-op chaos:** the team juggles tickets and interruptions live.

**Chosen:** hidden-role deduction, with the earlier [concept proposal](concept.md) as the baseline design.

**Why:** the satire is strongest when players have to tell sabotage from ordinary dysfunction. Hidden roles also make the server's ownership of the truth essential rather than decorative: each client must receive only what its player may see. Turn-based play keeps networking to "push a new snapshot when something changes", where real-time play would need a server tick, client interpolation and latency handling before the first playable round. The cost is that it needs 5 or more players, so automated tests drive several browser contexts.

**Also decided:** suspects are audited, not eliminated, as the concept proposal argues. Everyone plays until the end.

## D2. Documentation lives in the repository

**2026-11-11**

**Options:** Markdown in the repository; a shared online document; both.

**Chosen:** Markdown in `docs/`: brief, rules, architecture, this log, a process overview and one verification report per slice.

**Why:** it's versioned with the code, so it can't drift from what was built, and verification evidence sits next to what it verifies. A polished write-up for the team becomes a later slice.

## D3. Stack: the loozo full-stack Angular stack

**2026-11-11**

**Chosen:** Angular 22.2 with server rendering, `@loozo/angular-router`, `@loozo/angular-launch` for typed server calls, `@loozo/origami-ui` and `@loozo/fold-ui` for UI. Details in [architecture](architecture.md#stack).

**Why:** it's our own stack, and the game is a realistic consumer for it: typed per-action server calls, server push and hidden per-user data. Anything the stack is missing shows up here as a concrete need instead of a guess.

## D4. Transport: a view stream plus one mutation per action

**2026-11-11**

**Context:** the stack research from 2026-10-24 reported that Launch had no server push. Launch 0.0.6, released 2026-11-10, added streams (server-sent events) and channels (websockets).

**Options:**

| Option                                      | For                                                                                                                                                            | Against                                                                                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **View stream + mutations**                 | Typed result and declared errors per action; a rejected action fails only that call; full snapshots make reconnects lossless; works under `ng serve` in 0.0.6. | One HTTP request per action, irrelevant at turn-based pace.                                                                                                                             |
| One channel per player                      | One websocket carries actions and views.                                                                                                                       | No acknowledgements, so no per-action result; an invalid message closes the whole channel; `ng serve` doesn't forward websocket upgrades in 0.0.6 (fixed on Launch's main, unreleased). |
| A change notice beside Launch, then a query | Worked before Launch had streams.                                                                                                                              | An extra route outside Launch's guards, and an extra request per change. Superseded by streams.                                                                                         |
| Polling                                     | No push at all.                                                                                                                                                | Laggy and wasteful.                                                                                                                                                                     |

**Chosen:** a `room.view` stream yielding each player's full view, and one mutation per action.

## D5. Name: Strategic Realignment

**2026-11-11**

**Options:** Working as Intended, Plausible Deniability, Strategic Realignment, Per My Last Email.

**Chosen:** Strategic Realignment, the Plant's goal in corporate speak. The concept proposal's working title named an existing game; the public project shouldn't.

## D6. Design documents before the walking skeleton

**2026-11-11**

**Options:** write the design baseline first, or build the multiplayer walking skeleton first to test the push transport early.

**Chosen:** design documents first. With D4 settled on a released, documented Launch feature, the transport risk is smaller, and the rules and visibility contract shape the skeleton's data.

## D7. Hosting: public personal GitHub repository

**2026-11-11**

The source is public. Team game sessions run on a private deployment, to be chosen in the walking-skeleton slice.

## D8. Rules v0 balance: give the Plant real leverage

**2026-11-11**

**Context:** a simulation of the first rules draft (10,000–20,000 games per setting) showed the Plant barely mattered. The Target giving an even game moved only from 31 to 28 for 5 players between a Plant that never sabotages and one that always does, so outcomes would come down to the draw. The concept proposal lists exactly that risk: sabotage indistinguishable from random bad luck. Method and numbers are in [verification 01](verification/01-design-baseline.md).

**Changes tried, measured as the Plant's swing on the even Target (5 / 7 players):**

| Variant                                                     | Swing         |
| ----------------------------------------------------------- | ------------- |
| First draft: 3 Alignment Workshops at −1 each, incidents −3 | 10% / 7%      |
| 6 Workshops                                                 | 14% / 14%     |
| 6 Workshops, incidents −5                                   | 18% / 15%     |
| **6 Workshops at −2 each, incidents −5**                    | **25% / 23%** |

**Chosen:** the last variant, with the Target at 5 × players − 2: an even game for a Plant that sabotages about 60% of the time. Every number stays a knob for the paper playtest, which matters more than the simulation: the simulated team coordinates perfectly, so real tables will likely score lower.

## D9. Hosting: the whole app in one Durable Object on Cloudflare

**2026-11-11**

**Context:** the server keeps every room in memory, so exactly one instance must serve all players, and each player holds a server-sent-event stream open for a whole game (about 20–30 minutes, often idle between actions). Launch 0.0.6 sends a keep-alive comment every 15 seconds and the headers that ask proxies not to buffer. We have a paid Cloudflare Workers account.

**Options:**

| Option                                              | For                                                                                                                                     | Against                                                                                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **One Durable Object running the app (workerd)**    | No Docker; isolate start instead of a container boot; local runs use the same runtime as production; within the paid plan's allowances. | Changes the Stack's server entry (Express → Launch's neutral fetch entry). Launch streams weren't verified on workerd before. Closed streams were cleaned up ~30 s late locally. |
| One Cloudflare Container running the Express server | No architecture change; prompt cleanup (~13 ms) on Node.                                                                                | Dockerfile and image builds; 1–3 s cold start; the Worker → Durable Object → Container streaming chain is extra moving parts.                                                    |
| Homelab behind a Cloudflare Tunnel                  | No extra cost; fits the lab's Compose workflow.                                                                                         | Sessions depend on home power and connection; a new public entry point into the lab.                                                                                             |
| Render or Fly.io, one instance                      | Managed Node hosting, US$3–7/month.                                                                                                     | No built-in visitor gate (see D10); Render caps a response at 100 minutes; Fly's streaming limits aren't documented.                                                             |
| Railway, Koyeb, Cloud Run                           | —                                                                                                                                       | Railway ends responses after 15 minutes; Koyeb documents a 100 s HTTP timeout without exempting streams; Cloud Run's maximum of one instance can be briefly exceeded.            |

**Chosen:** a Worker forwards every request except static files to one Durable Object with a fixed name, which runs the whole app: server rendering, Launch's RPC handler and the in-memory rooms. Static files come from Workers Static Assets.

**Why:** both runtimes passed the same local prototype: five isolated browsers created and joined a room by code, saw each other arrive and saw one action sync, and an idle stream stayed open past three minutes with keep-alives every 15 seconds. The Durable Object needs fewer parts to deploy, and it exercises Launch on workerd, which is the kind of gap D3 expects this project to find. The 30-second cleanup delay costs a little memory for a closed stream, not correctness.

**Fallback:** if the deployed stream doesn't survive a 35-minute soak test with seven clients and several idle minutes between actions, we switch to the Container option, which keeps the same app code apart from the server entry.

## D10. Private access: Cloudflare Access with email one-time PINs

**2026-11-11**

**Options:** an unlisted URL only; a shared passcode in the app; Cloudflare Access in front of the app.

**Chosen:** Cloudflare Access on a subdomain of a domain we already have on Cloudflare, letting in an allowlist of colleagues' email addresses by one-time PIN.

**Why:** it gates every page, call and stream without app code, it's free for small teams, and colleagues need no account. An unlisted URL lets anyone with the link in; a passcode would be new code to write and maintain. When an Access login expires mid-game, the stream's reconnect fails and the room page says so; reloading the page logs in again.

## D11. The walking skeleton's synced action: start the game for real

**2026-11-11**

**Options:** a stand-in action that only changes the phase; `startGame` with the real setup from the rules.

**Chosen:** `startGame` runs the real setup: seeded roles, three-card hands, four of the six demands, the Target and the first demand.

**Why:** each player's view must then show only their own role and hand, so the walking skeleton tests hidden information end to end and not just the transport. A phase-only stand-in would show `role: null` outside the lobby, which the hidden-information mapping doesn't allow, and slice 3 would throw it away.

## D12. The deployment's hostname stays out of the repository

**2026-11-11**

**Options:** write the hostname into `wrangler.jsonc` and the server's allowed hosts; or pass it at deploy time.

**Chosen:** pass it at deploy time: `wrangler deploy --domain <host> --var APP_HOST:<host>`. The Durable Object builds the app's handler with `APP_HOST` as the only allowed host; without it, only `localhost` and `127.0.0.1` are allowed, so a deploy that forgets the variable refuses every request instead of accepting any host. `workers_dev` and preview URLs are off, so the custom domain behind Access is the only way in.

**Why:** the repository is public and the deployment is private (D7). Access already gates the hostname, so publishing it would only advertise the login page, but keeping it out costs one command-line flag and a few lines in the Worker.

## D13. Digital: retro ends when everyone is ready

**2026-11-11**

**Context:** on paper the retro ends when the table stops talking. The browser game needs an explicit end, and the next sprint's draw and demand follow from it.

**Options:**

- **Everyone marks ready; a nomination clears the marks.** The next sprint starts when all players are ready and no vote is open.
- **Everyone marks ready, and marks survive a nomination.**
- **The host ends the retro.**

**Chosen:** everyone marks ready. A nomination clears every ready mark, nobody can mark ready while a vote is open, and a mark can't be withdrawn ([rules](rules.md#digital-game)).

**Why:** an audit's outcome is new information the team should discuss, so a ready mark given before it no longer means "I've said my piece". Keeping marks would let a retro end the moment the last vote lands. A host-ended retro gives one player control over when suspicion stops being discussed, which matters in a hidden-role game. The cost: one player who never marks ready stalls the retro, like an absent player stalls a sprint.

## D14. Digital: the audited card shows at the reveal

**2026-11-11**

**Options:** show the audited player's card, attributed, at the reveal; or as soon as it's placed, as on paper.

**Chosen:** at the reveal, in `lastReveal.audited` ([rules](rules.md#digital-game)).

**Why:** it fits the approved view as it is; showing it on placement would need a new view field for the current sprint. On paper the others could react to the face-up card while still choosing theirs; in the browser game they can't, so the audited player's card no longer steers the rest of the sprint.

## D15. Digital: the reveal shows its outcome

**2026-11-11**

**Options:** add `lastReveal.outcome` (Progress gained after Workshop reductions, whether the demand was met, whether an incident happened) to the view; or no addition, showing only the revealed cards and the new board.

**Chosen:** add `outcome`, the one change to the approved `PlayerView` ([architecture](architecture.md#the-view)).

**Why:** it's public information at a table, where everyone watches the cards being counted. Without it the client would recompute the rules, which the architecture rules out, or players would check the demand by hand and guess whether Debt moved through an incident.

## D16. Digital rules defaults

**2026-11-11**

**Chosen**, as defaults for the browser game ([rules](rules.md#digital-game)):

- **Nominations:** the first nomination in a retro is its one vote and can't be withdrawn; any other player, never yourself; only while Audits left is above 0. Everyone votes, including the nominee; votes are final and show once all are in.
- **The audited card is never removed** by The Sprint Is Now One Week, which removes one of the face-down cards. The audited player has no index among the shuffled cards.
- **A removed card is yours if none of the revealed ones is.** Your view marks which revealed card is yours, so the owner of the removed card learns it was theirs. On paper they'd learn it only when no card of their type showed up. Nobody else learns anything, and the card is never sent.
- **Draw at the start of the next sprint,** so hands hold 2 cards during the retro. At v0 numbers the deck never runs out, so the reshuffle rule is covered by a unit test on a constructed game only.

**Why:** each follows the paper rules as closely as the browser allows, and none needs a new view field.
