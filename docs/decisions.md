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

## D17. An accepted action returns the room's version

**2026-11-11**

**Context:** after a player acts, the mutation's response and the view stream's next snapshot travel separately. Other players' snapshots can arrive first, and a nomination can undo a ready mark before the response lands. A control that re-enabled on whatever snapshot came next could be used again on a view that didn't yet show its action, and one that waited for its action's visible effect could wait forever.

**Options:**

- **Each accepted action returns `{ version }`.** The control waits until its view reaches that version.
- **Mutations return nothing, and the page infers the outcome from view fields.** It needs per-control state and guesses which snapshot follows the action.

**Chosen:** return `{ version }`, the room's version right after the action ([architecture](architecture.md#how-a-change-reaches-players)). If the response is lost, the control is usable again at once with "Couldn't reach the server. Try again."; a retry is checked against the current game, so if the action had in fact gone through and still stands, it gets its declared refusal, such as "You've already voted." A Ready that a nomination has since cleared can be marked again, as it should.

**Why:** the version is already in every view, so it leaks nothing, and it is the only causal link between a response and a snapshot. Reopening the stream after a lost response was tried and dropped: Launch 0.0.6's `reconnect()` does nothing while a stream is open, so it needed undocumented Launch behavior, for a rare network failure that a declared refusal already covers.

## D18. Rules v0 at 8–10 players: two Plants and twenty more cards

**2026-11-17**

**Context:** the team that will play is ten people, and rules v0 stopped at 7. Two throwaway prototypes ran the real rules engine with 8–10 players under two simulated policies, 5,000 games per setting: _static-debt_, which reproduces the [verification 01](verification/01-design-baseline.md) simulator that [D8](#d8-rules-v0-balance-give-the-plant-real-leverage) was tuned with to within 1.6–5.4 points at 5–7 players, and _main_, a stronger, coordinating team. Neither models lying, inference or negotiation.

**Options:**

- **A: one Plant, a 64-card deck** with v0's proportions, 9 Alignment Workshops among them. The closest numeric match to 5–7 at every sabotage rate, and no change to roles or views. But one suspect among nine: the chance that a given player is the Plant falls to 10–12.5%, below 5–7's 14–20%, and the Plant's measured swing on the outcome is smaller than at 5–7.
- **B: two Plants, 64 cards:** v0's 44 plus 20 without Workshops (6 Feature Work, 5 Temporary Workaround, 4 Test Coverage, 3 Refactoring, 2 Status Update). A Plant prior of 20–25%, close to 5–7's, the largest measured swing, and three of the four calibration points within 1.7 points of D8's 5-player row. An honest table (Plants never sabotaging) wins about 10 points more often than in D8's 5-player row.
- **Two Plants who know each other, or who don't.** Known Plants can defend, bus or avoid auditing each other, which gives the Delivery Team a signal in votes; unknown Plants need no view change.

**Delivery Team win rate at Target 5 × players − 2,** for Plants sabotaging in 0 / 30 / 60 / 100% of sprints:

| Setup                         | static-debt                    | main                             |
| ----------------------------- | ------------------------------ | -------------------------------- |
| D8, 5 players (old simulator) | 85 / 60 / 46 / 36              | —                                |
| v0 today, 5–7 players         | 88–89 / 63–64 / 48–50 / 39–42  | 95–98 / 78–85 / 63–71 / 50–59    |
| A, 8–10 players               | 81–84 / 57–60 / 45–47 / 38–39  | 96 / 81–82 / 67–70 / 56–60       |
| **B, 8–10 players**           | **95–96 / 60–62 / 45 / 35–36** | **99.6 / 83–86 / 65–71 / 50–57** |

**Chosen:** B, with the Plants knowing each other. At 8–10 players, two Plants and the 20 extra cards; at 5–7 nothing changes, and the 44-card deck stays. Target 5 × players − 2 (38, 43, 48), Morale 4, Audits left 2, an audit passing on more than half of all players (5, 5 and 6 yes votes), and demands and the retro stay as they are. The browser game shows each Plant the other one ([architecture](architecture.md#hidden-information)); on paper the Plants find each other with eyes closed at setup ([rules](rules.md#setup)).

**Why:** the reasons for B are social: a prior near 5–7's, two suspects, and votes and defences that can line up. No simulation measures deduction or fun. The one measured advantage that bears on them is that the Plants' choices move the outcome more under B than under A. On the simulations alone, A is the closer calibration match and the smaller change. The Plants' knowledge of each other was simulated as two independent Plants; how it changes card play and votes is unmeasured. Every number stays a knob, and the paper playtest decides.

The simulators were throwaway, as verification 01's was; their patches and reports are kept with this slice's notes ([verification 04](verification/04-ten-players.md#evidence-kept)).

## D19. The game looks like a parody of a group calendar

**2026-11-17**

**Context:** the first playable game was a stack of plain panels. Before the team playtest, the room had to look and feel like a game: real cards, a table instead of a page, staged moments, and a lobby to match. The satire could live in the interface itself (a parody of the tools a toxic workplace runs on) or only in the card text.

**Options:**

- **Sprint Calendar:** the room is a week view. Leadership's demand is a required invite on Monday, contributions are bookings ("Busy · private"), the reveal is Thursday's Sprint Review, the retro is Friday's poll, and phase changes arrive as meeting reminders.
- **Retro Whiteboard:** sticky notes on a canvas, dot-voting for audits, live cursors. Familiar, and live cursors would be new realtime data that could hint at a player's choice.
- **Build Log:** a CI terminal transcript. Engineers know it at once, but it mocks their own tools rather than corporate dysfunction, and it's slow to scan during a call.
- **Digital tabletop:** a felt table with illustrated cards, the standard online party-game look. It moves the satire back into the card text.

**Chosen:** Sprint Calendar. The rules' nouns (Progress, Morale, Debt, Audits, Contribute, the roles, cards and demands) stay exactly as [rules.md](rules.md) has them. Only verbs and statuses come from the calendar (Book, Busy, Accepted, Reminder). [DESIGN.md](../DESIGN.md) records the system and [PRODUCT.md](../PRODUCT.md) the product facts behind it.

**Why:** a calendar is where workplace dysfunction already lives, so the joke is the process itself, and its week maps the sprint's phases onto days without inventing new structure. The motion follows one rule that matters for the game: the reveal turns over in the server's shuffled order only, and a moment plays only on a change the page receives, never on load, so nothing in the presentation can hint at who played what.
