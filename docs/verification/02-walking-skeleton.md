# Verification 02: walking skeleton

**Slice:** the deployed multiplayer walking skeleton ([process](../process.md), slice 2).
**Date:** 2026-11-11
**Result:** passed. The check with the whole team on their own devices is still to come.

## Done check

> Create a room, join it from several browsers, see players arrive and one action sync through the view stream: Playwright drives at least 5 isolated browser contexts through create → join → one synced action against the real app, plus a manual check on separate devices once it's deployed.

The one action is `startGame` with the real setup from the rules ([D11](../decisions.md#d11-the-walking-skeletons-synced-action-start-the-game-for-real)), so the check also covers hidden information: each player must see only their own role and hand.

## What was built

- **Rules:** `src/game` is pure TypeScript. It holds a seeded RNG, the rules v0 setup behind `startGame`, and `viewFor` for the lobby and contribute phases.
- **Server:**
  - `src/server/rooms.ts` is the only owner of the rooms and of which browser session sits in which seat.
  - The `sr_session` cookie is set only after a room accepts the seat.
  - The `room.view` stream follows the version loop in the [architecture](../architecture.md#how-a-change-reaches-players).
- **Pages:** the lobby (create, or join by code) and the room page (players, stream status with Reconnect, a join form for browsers without a seat, then the game's first sprint).
- **Runtime:** the whole app runs in one fixed-name Durable Object on Cloudflare ([D9](../decisions.md#d9-hosting-the-whole-app-in-one-durable-object-on-cloudflare)), behind Cloudflare Access ([D10](../decisions.md#d10-private-access-cloudflare-access-with-email-one-time-pins)). The deployment's hostname isn't in this repository ([D12](../decisions.md#d12-the-deployments-hostname-stays-out-of-the-repository)).

## Observed

Everything below was run on 2026-11-11 with Node 24.21.0, Chromium 158 (Playwright 1.65) and wrangler 4.160.0.

### 1. Unit tests

39 tests pass (`ng test`): 24 for the rules, 15 for the room store. The rules tests check setup against the literal counts in [rules.md](../rules.md): 44 cards in the stated mix, 4 of the 6 demands, one Plant, 3 cards each, the Target for 5, 6 and 7 players, and the CEO demand's +3. They also check determinism from the seed, and that no view holds another player's role or hand, an unrevealed demand or a session id.

To check that the tests catch real defects, each of these deliberate breaks was made once and made at least one test fail:

- skipping the role shuffle;
- skipping the deck shuffle;
- a deck of 12 Feature Work and 5 Alignment Workshops;
- dropping the roster check in `viewFor`;
- sharing the lobby's player list with the started game;
- dropping the abort-listener removal in `changedSince`;
- dropping the "version already moved" early return.

### 2. Five browsers, locally

`npx playwright test` builds the app and runs it on workerd under `wrangler dev`. Both tests pass, and all 10 pass with `--repeat-each=5`. `E2E_SERVER=dev` runs the same tests against `ng serve`, and they pass there too.

The main test does the following:

1. Five `browser.newContext()` players, each with its own cookies. One creates a room and four join by its code, typed in lower case.
2. After each join, every page already open shows the new player.
3. A guest's direct `startGame` call is refused with 403 `NOT_HOST`.
4. The host starts the game. Every page shows Sprint 1 · Contribute, its own role and 3 cards, and every player at 3 cards. Exactly one browser shows Management Plant.
5. Each browser's own `room.view` stream is read directly. The payload must have exactly the approved `PlayerView` fields, with no role or card outside `me`, no session id, no seats and no seed. When the stream handler was changed to also send the whole game, this check failed.

A second test opens the room URL in a browser with no seat. It gets a join form and nothing about the players, and joining from there seats it. A refused join sets no cookie.

### 3. Five browsers, deployed

The same tests ran against the deployment through Cloudflare Access, using a service token (`E2E_BASE_URL`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`). They passed in three runs. Timings from one run, measured from Playwright's click to the UI assertion on every page:

| Change    | Reached every open page                                         |
| --------- | --------------------------------------------------------------- |
| Each join | 256–276 ms, including the joining browser loading the room page |
| Start     | 115 ms, all 5 pages                                             |

Checked with `curl`:

- **Without a token:** the page, an RPC and a static file each answer 302 to the Access login.
- **With the token:** the server-rendered lobby comes back over HTTP/2.
- **With a different `APP_HOST`:** run locally, both the page and the RPC answer 400.

### 4. Streams over a whole game's length

`scripts/soak.mts` ran against the deployment for 35 minutes. Five players joined at the start, a sixth at minute 8 and a seventh at minute 20, and the host started the game at minute 33. That leaves idle gaps of 8, 12 and 13 minutes with nothing but keep-alives.

It ran from 09:50 to 10:25 UTC; the 7 players were the script's own HTTP clients, not browsers.

| Stream | Open for | Keep-alives | Longest silence | Versions received | Ended early |
| ------ | -------- | ----------- | --------------- | ----------------- | ----------- |
| P1     | 2100 s   | 139         | 15.0 s          | 1 → 8             | no          |
| P2     | 2100 s   | 139         | 15.0 s          | 2 → 8             | no          |
| P3     | 2099 s   | 139         | 15.0 s          | 4 → 8             | no          |
| P4     | 2099 s   | 139         | 15.1 s          | 4 → 8             | no          |
| P5     | 2099 s   | 139         | 15.0 s          | 5 → 8             | no          |
| P6     | 1620 s   | 107         | 15.0 s          | 6 → 8             | no          |
| P7     | 900 s    | 59          | 15.0 s          | 7 → 8             | no          |

Every open stream received each change after an idle gap:

| Change             | At     | Version | Reached every open stream in |
| ------------------ | ------ | ------- | ---------------------------- |
| P6 joins           | 8 min  | 6       | 245–248 ms                   |
| P7 joins           | 20 min | 7       | 111–112 ms                   |
| P1 starts the game | 33 min | 8       | 174–175 ms                   |

No stream dropped, and every one ended in the `contribute` phase at version 8. A stream that opened mid-run starts at the then-current version, since its first snapshot is the current view.

The run used an earlier version of the script that didn't count the silence after the last byte; review then fixed that. Here, each stream's keep-alive count matches its open time at one per 15 seconds, and the longest silence was 15.1 s, so none went quiet before the end either. This passes the falsifier in D9: the Durable Object stays, and the Container fallback isn't needed.

### 5. Separate devices

loozo signed in through Access with an email one-time PIN on a laptop and on a phone. They created room YXFD on the laptop and joined it from the phone. Three bots joined through the service token. loozo then started the game from the laptop.

loozo reported that both devices showed the bots arrive. After Start, each device showed Sprint 1 · Contribute, its own role and three cards, and every player at "3 cards · Contributed: no", with the status Live. This is loozo's report; I didn't watch the devices myself.

## Inferred, not observed

- **One shared state:** every stream saw the same version sequence, so all requests reach the same Durable Object. Cloudflare could still move it on a restart, which would lose the rooms (an accepted limit).
- **Cleanup on Cloudflare:** the deployed delay between a closed tab and its stream ending wasn't measured. Locally on workerd it is about 30 seconds.
- **Phones:** the layout was checked at 390 px in screenshots, and on one phone by loozo.

## What wasn't checked

- **A real team session:** only loozo's email is on the Access allowlist so far.
- **Access expiry mid-game:** sessions last 24 hours. A reconnect after expiry should fail and need a reload; this wasn't exercised.
- **Durable Object eviction, deploys and runtime updates during a game:** all of them end the game in progress, which is an accepted limit.
- **More than one room under load, or seven players on real devices.**

## Evidence kept

Outside the repository, under `~/.local/state/strategic-realignment/`:

- `e2e-deployed.json`: the deployed Playwright run.
- `soak-35.json`: the soak summary.

The research, prototype and review notes for this slice are in `~/.local/state/t3-handoff/sr-walking-skeleton/`.
