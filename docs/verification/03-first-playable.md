# Verification 03: first playable game

**Slice:** the first playable game ([process](../process.md), slice 3; phase 5).
**Date:** 2026-11-11
**Result:** passed, locally and deployed. The phase's exit condition, a full game with no developer repairing it, needs the team playtest, which is still to come.

## Done check

> The rest of rules v0 playable in the deployed app, end to end: contribute, reveal, resolve, the retro with one audit vote, audited players contributing face up, sprints 1–4, and the end of the game with every role revealed. The server is the source of truth and each player gets only their view.

Agreed as: replay tests from seed and action log for every rule and demand in [rules.md](../rules.md); the [architecture](../architecture.md#how-well-verify-it)'s hidden-information checks for every step of replayed games and every player; Playwright driving 5–7 isolated browser contexts through a full game against the real app, locally and against the deployment; then a team playtest.

## What was built

- **Rules** (`src/game`): contribute, the seeded reveal (face-down cards shuffled, The Sprint Is Now One Week removing one unseen), resolve in the rules' order, the retro with one audit vote, audited players' cards shown attributed at the reveal, sprints 1–4, and the end. `viewFor` builds every phase's view. `replay(seed, players, log)` rebuilds a game from its log.
- **Digital rules:** clarifications in [rules.md](../rules.md#digital-game), decided in [D13–D16](../decisions.md#d13-digital-retro-ends-when-everyone-is-ready). The view gained `lastReveal.outcome` (D15).
- **Server:** `ServerRoom.act` is the one path for every action. The room RPC has `contribute`, `nominate`, `vote` and `finishRetro` beside `startGame`, each declaring only its own refusals. An accepted action returns the room's version, and a control stays disabled until its view reaches it ([D17](../decisions.md#d17-an-accepted-action-returns-the-rooms-version)).
- **Room page:** every phase from the player's own view, with each card's effect in words.

## Observed

Everything below was run on 2026-11-11 with Node 24.21.0, Chromium (Playwright 1.65.0) and wrangler 4.160.0, at commit `1356c2a`.

### 1. Rules engine

`ng test`: 330 tests pass, across the rules (`src/game`), the room store and the page's request control.

- **Replay tests** from a seed and an action log, one or more per rule: setup, draw, reshuffle (on a constructed game, since at v0 numbers the deck can't run out), each card, Workshop stacking and the per-card floor, the Debt floor, each of the six demands (met and missed where it has a requirement, a Workshop meeting it, the removed card not counting), the incident (once per sprint, also when Debt stays at 3 or more), Morale 0 at resolve and after an audit, audit pass and fail, no nomination with no audits left, one vote per retro, the retro's end, the audited card, sprint 4 for both winners (including Progress exactly at the Target, and Morale 0 beating a reached Target), every role at the end and every refusal code. The rules' example sprint is one of them.
- **Hidden information:** 210 seeded random legal games, 70 each of 5, 6 and 7 players, checked at every step for every player. Each view holds no other player's hand and no role but the player's own before the end. It never contains the removed card, checked against the cards actually placed and in the view's JSON. It doesn't depend on submission order: the same placements in reverse order give the same reveal, and over 200 seeds the reveal order takes more than 60 distinct permutations. Votes stay hidden until all are in. No view carries a seed, deck or session id.
- **Deliberate breaks:** each of these was made once, made at least one test fail, and was reverted:
  - reveal in submission order;
  - reveal in reverse seat order;
  - the removed card left in the reveal, or swapped for a kept card;
  - a Workshop at −1 instead of −2;
  - no incident, or repeated incidents;
  - the demand penalty applied before Refactoring;
  - The Demo Moved to Tomorrow counting the board's Progress instead of the sprint's;
  - Delivery winning on `>` instead of `≥`;
  - sprint 4's winner decided before the Morale check;
  - the vote outcome shown before all votes;
  - roles shown before the end;
  - an audit passing on exactly half;
  - the ended game dropping its deciding vote.

### 2. A replayed game, read step by step

One 5-player game was replayed from its seed and player 2's view was printed after every action. Each step matched the rules:

- **Sprint 1:** the cards gave +10 Progress and +2 Debt, and the Status Update met Quarterly Visibility Review.
- **Retro 1:** the audit passed 3 to 2, with who voted how hidden until the fifth vote. Morale went to 3 and Audits left to 1.
- **Sprint 2:** The CEO Saw a Competitor's Feature raised the Target from 23 to 26. The audited player's Refactoring showed attributed, outside the 4 shuffled cards, and Debt went from 2 to 0.
- **Retro 2:** the nomination cleared two ready marks, and the vote failed 1 to 4.
- **Sprint 3:** a Workshop brought every card to 0 and still met The Demo Moved to Tomorrow.
- **Retro 3:** a passed audit left 0 audits.
- **Sprint 4:** no retro followed it. The Plant won at 14 of 26, and every role was shown.
- **Throughout:** hands refilled to 3 at each new sprint, and player 2 never saw another player's role or hand.

### 3. Full games in browsers, locally

`npx playwright test` builds the app and runs it on workerd under `wrangler dev`. All 4 tests pass: the 2 walking-skeleton tests and 2 full games.

- **Players:** 5 at desktop width (39 s) and 7 at 390 px (2.0 min), each in its own browser context.
- **Repeat runs:** an earlier `--repeat-each=3` run during development passed 6 of 6. The 7-player game took 1.7–4.1 min there, depending on machine load.

Each game plays sprints 1–4. Retro 1's nomination fails, retro 2's passes and retro 3 has none, so with only two Morale demands the game always reaches the end of sprint 4. At every step the test checks the following:

- **Every page:** what changed reached every open page. That includes the hand and its card labels, the demand and earlier demands, the board, the reveal's ordered card labels with this browser's card marked, the audited card's attribution, the outcome, the vote, the ready marks and, at the end, the winner and every role.
- **Each browser's own `room.view` payload:** exactly the approved `PlayerView` fields, no other player's role before the end, no other player's cards, and no seed, deck, seat, session id or removed card. `vote.outcome` stays null until everyone has voted, and `lastReveal.mine` points at the card that browser placed.
- **The end:** every page shows the same winner and all roles, with exactly one Management Plant, the player whose page showed that role.
- **Refused calls:** direct RPC calls that are refused (contributing twice, a card not in hand, an unknown card, nominating outside the retro, nominating yourself, voting with no vote open, marking ready during a vote) return their declared error, or Launch's `INVALID_INPUT` for the unknown card. Every player's full view is the same before and after.
- **On the page:** one real refusal is shown by the control it came from. A Ready that looks disabled during a vote sends nothing on click or keyboard. A 20-character nominee name doesn't scroll the 390 px page sideways.
- **A lost reply:** the test cuts the page's view stream with a test-only `fetch` wrapper and loses the reply to a vote. The vote buttons come back with "Couldn't reach the server. Try again.", a retry gets "You've already voted.", and after Reconnect every view matches.
- **Accepted actions:** each returns the version that every view then shows.

### 4. Full games, deployed

The app at `1356c2a` was deployed with `wrangler deploy --domain <host> --var APP_HOST:<host>` (Worker version `a7a6cee1-3be9-4db7-9ea1-45597a05a353`). The same suite then ran against the deployment through Cloudflare Access, with a service token. All 4 tests passed, in 2.8 min:

| Test                      | Time    |
| ------------------------- | ------- |
| 5 players, desktop        | 35.9 s  |
| 7 players, 390 px         | 2.1 min |
| Walking skeleton: start   | 3.4 s   |
| Walking skeleton: no seat | 1.2 s   |

Checked with `curl` against the new version: without a token, the page and an RPC both answer 302 to the Access login. With the token, the page comes back over HTTP/2.

## Inferred, not observed

- **Real players:** the browsers are Playwright's, each playing the first card it's offered. People make different choices and reload pages mid-game. Reloading restores a seat through its cookie, as in slice 2, but no full game included a reload.
- **Phones:** the layout was checked at 390 px in screenshots and in the 7-player game, not on a real phone this slice.
- **Demands in browsers:** the browser games use random seeds, so whether a run drew The Sprint Is Now One Week or The CEO Saw a Competitor's Feature varies. Those, and a game ending on an audit vote, are covered by the seeded replay tests, not by the browser runs.

## What wasn't checked

- **The team playtest.** This is the phase's exit condition. Colleagues need to be on the Access allowlist first.
- **A full game with 6 players in browsers,** or several games at once.
- **Deploys, Durable Object eviction or Access expiry during a game.** Each ends the game in progress or needs a reload, which are accepted v0 limits.
- **A refusal message staying on screen.** After a lost reply whose action had in fact been applied, "Couldn't reach the server" stays beside the result until the player's next action. This was accepted as a simplification (D17).

## Evidence kept

Outside the repository, under `~/.local/state/strategic-realignment/`:

- `e2e-deployed-03.json`: the deployed Playwright run.

The plan, briefs, implementation reports, five review rounds and their dispositions, and screenshots are in `~/.local/state/t3-handoff/sr-first-playable/`.
