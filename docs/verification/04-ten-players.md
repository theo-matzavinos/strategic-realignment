# Verification 04: ten players

**Slice:** ten players ([process](../process.md), slice 4).
**Date:** 2026-11-17
**Result:** passed locally. Not deployed yet; the team playtest is still to come.

## Done check

> A full game of 10 players in the app; each Plant sees the other Plant and nobody else does; 5–7-player games recorded before the change replay unchanged.

## What was built

- **Rules** ([rules.md](../rules.md), decided in [D18](../decisions.md#d18-rules-v0-at-810-players-two-plants-and-twenty-more-cards)): 5–10 players. At 8–10, two Management Plants who know each other and win or lose together, and 20 large-table cards shuffled into the 44 (6 Feature Work, 5 Temporary Workaround, 4 Test Coverage, 3 Refactoring, 2 Status Update). Target 5 × players − 2 (38, 43, 48), Morale 4, Audits left 2 and an audit passing on more than half of all players (5, 5 and 6 yes votes) stay as they are. At 5–7 nothing changes.
- **Engine** (`src/game`): `maxPlayers` is 10. `plantCount(n)` deals 1 Plant below `largeTablePlayers` (8) and 2 from it. `contributionDeck(n)` appends the large-table cards after the base 44, so 5–7 games deal exactly as before.
- **View:** `me.otherPlant` names the other Plant, only in a Plant's view in a two-Plant game, from the start to the end ([architecture](../architecture.md#the-view)). It is derived from the stored roles each time a view is built, never stored.
- **Room page:** a Plant's role panel says "The other Plant: {name}", and a two-Plant result reads "The Management Plants win". The lobby shows `x/10`, from `maxPlayers`.

## Observed

Everything below was run on 2026-11-17 with Node 24.21.0, Chromium (Playwright 1.65.0) and wrangler 4.160.0, on the uncommitted change over `b688b8b`.

### 1. 5–7-player games recorded before the change replay unchanged

Ten games were recorded from `b688b8b` before any engine edit, and `src/game/v0-games.spec.ts` replays them on every test run. For each game it compares the canonical game right after setup (roles, hands, deck order, demands, Target and random state) and the final canonical game (every draw, removal, reveal order, audit, the board and the winner). Replay also fails on any logged action the rules now refuse.

| Players | Seed | Actions | Winner        | How it ended                              |
| ------- | ---- | ------- | ------------- | ----------------------------------------- |
| 5       | 1    | 52      | Plant         | after sprint 4                            |
| 5       | 2    | 52      | Plant         | after sprint 4                            |
| 5       | 55   | 57      | Delivery Team | after sprint 4                            |
| 6       | 1    | 59      | Plant         | after sprint 4                            |
| 6       | 2    | 71      | Plant         | after sprint 4                            |
| 6       | 223  | 67      | Delivery Team | after sprint 4                            |
| 7       | 1    | 70      | Plant         | after sprint 4                            |
| 7       | 2    | 59      | Plant         | after sprint 4                            |
| 7       | 126  | 78      | Delivery Team | after sprint 4                            |
| 5       | 3    | 28      | Plant         | a passed audit took Morale to 0, sprint 2 |

The nine random games are `randomGame(seed, n)` at seeds 1 and 2 and the first Delivery win for each count; the tenth is the scripted Morale-0 audit from the hidden-information tests.

- **Green on the unchanged engine:** with only the fixture and the spec added, `ng test` passed 340 of 340 tests (330 before).
- **Green after the engine change:** 10 of 10.
- **Negative control:** with the Plants dealt last in the role array instead of first, 10 of 10 failed; reverted.
- **Fixture:** `src/game/testing/v0-games.json`, 133,624 bytes after Prettier, SHA-256 `c4ddc66ba573e1f7e57c704b6e122920548dba471bbd35cfceab8929d21d06a6`. The design review's capture from the same commit produced the same hash.

How it was captured, in a temporary directory outside the repository, removed afterwards:

```bash
export PATH=/home/loozo/.local/share/mise/installs/node/24.21.0/bin:$PATH
mkdir -p "$S/base" && git -C "$REPO" archive b688b8b src/game | tar -x -C "$S/base"
ln -s "$REPO/node_modules" "$S/node_modules"
cd "$S" && node_modules/.bin/esbuild capture.ts --bundle --platform=node --outfile=capture.cjs
node capture.cjs "$REPO/src/game/testing/v0-games.json"
cd "$REPO" && npx prettier --write src/game/testing/v0-games.json
```

```ts
// capture.ts: imports only the extracted base copy
import { writeFileSync } from 'node:fs';
import { replay } from './base/src/game/replay';
import { randomGame } from './base/src/game/testing/random-play';
import {
  allReady,
  audit,
  demands,
  findScenario,
  sprint,
  started,
} from './base/src/game/testing/scenario';

const games = [];
for (const [playerCount, deliveryWinSeed] of [
  [5, 55],
  [6, 223],
  [7, 126],
]) {
  for (const seed of [1, 2, deliveryWinSeed]) {
    const final = randomGame(seed, playerCount);
    if (seed === deliveryWinSeed && (final.phase !== 'ended' || final.winner !== 'delivery')) {
      throw new Error(`seed ${seed} at ${playerCount} players is not a Delivery win`);
    }
    games.push({ playerCount, seed, log: final.log, setup: started(playerCount, seed), final });
  }
}

const morale = ['demoTomorrow', 'visibilityReview'] as const;
const moraleZero = findScenario(5, [
  demands([...morale], [...morale]),
  sprint({ check: (after) => after.phase === 'retro' && after.board.morale === 3 }),
  audit('p1', 'p2', ['p1', 'p2', 'p3']),
  allReady(),
  sprint({ check: (after) => after.phase === 'retro' && after.board.morale === 1 }),
  audit('p4', 'p5', ['p1', 'p2', 'p3', 'p4']),
]);
games.push({
  playerCount: 5,
  seed: moraleZero.seed,
  log: moraleZero.log,
  setup: started(5, moraleZero.seed),
  final: replay(moraleZero.seed, moraleZero.players, moraleZero.log),
});

writeFileSync(
  process.argv[2],
  JSON.stringify({ capturedFrom: 'b688b8b7cdd7ab382d37e6d82a20b9d97056f6e2', games }),
);
```

### 2. Rules engine and views at 8–10

`ng test`: 561 tests pass, up from 330.

- **Setup** for each count 5–10: 1 or 2 Plants, 3 cards each, Target 23 to 48, and the deck's exact composition (44 cards at 5–7; 64 at 8–10: Feature Work 17, Temporary Workaround 14, Test Coverage 12, Refactoring 9, Status Update 6, Alignment Workshop 6). Over 200 seeds at 10 players, a Plant sits in every seat. Every count has at least 6 cards per player, so a four-sprint game never reshuffles. A lobby never seats an 11th player, and a corrupted 11-player lobby isn't dealt.
- **A 10-player game** through all four sprints: an audit passes on 6 yes of 10 (Audits left −1, Morale −1, face up next sprint) and one fails on a 5–5 tie with nothing changed; the two Plants win together, and every view's result shows both.
- **The other Plant, by value:** in a replayed 8-player game, at every step from the lobby to the end, each Plant's view names the other, and every Delivery view and every lobby view has null. At 5–7 every view has null.
- **The room's capacity:** a 10th player joins and an 11th gets `ROOM_FULL`.

### 3. Hidden information

420 seeded random legal games, 70 each of 5 to 10 players, checked at every step for every player as in [verification 03](03-first-playable.md#1-rules-engine), plus the scripted game a passed audit ends. New in this slice:

- `me` may hold only `playerId`, `role`, `hand`, `contribution` and `otherPlant`.
- At every step and for every viewer, `me.otherPlant` must be exactly the other Plant's id for a Plant in a two-Plant game, and null otherwise. A role search can't catch a leaked player id, so this checks the value.
- The run must cover two-Plant games (210), Plant views naming the other Plant, and Delivery views in two-Plant games; each count is checked to be above zero.
- **Deliberate break:** projecting `otherPlant` for every player, not just Plants, made 434 tests fail; reverted.

The hidden-information suite took about 13 s.

### 4. A 10-player game in browsers, locally

`npx playwright test` builds the app and runs it on workerd under `wrangler dev`. All 5 tests pass: the 2 walking-skeleton tests and 3 full games, 5 players at desktop width, 7 at 390 px and 10 at desktop width, each player in its own browser context.

| Test                      | First run | Final run |
| ------------------------- | --------- | --------- |
| 5 players, desktop        | 21.7 s    | 30.8 s    |
| 7 players, 390 px         | 1.6 min   | 1.6 min   |
| 10 players, desktop       | 11.1 min  | 9.2 min   |
| Walking skeleton: start   | failed    | 1.6 s     |
| Walking skeleton: no seat | 0.9 s     | 0.5 s     |

The first run failed one walking-skeleton test, which still listed `me`'s keys without `otherPlant`. It was updated to expect the key with a null value, and the final run passed all 5 in 11.4 min. Another Playwright run was sharing the machine during both runs.

The 10-player game runs the same checks as the 5- and 7-player games ([verification 03](03-first-playable.md#3-full-games-in-browsers-locally)) at every step, for every page and every browser's own `room.view` payload. Retro 1's audit fails 2 yes to 8, retro 2's passes 10 to 0, and retro 3 has none. New in this slice, at every step:

- **Each payload's `me`** holds exactly `playerId`, `role`, `hand`, `contribution` and `otherPlant`. A Plant's `otherPlant` is the other Plant, by the roles each page showed at the start; a Delivery player's is null. The 5- and 7-player games check that it's null for everyone.
- **Each page's role panel:** a Plant's says "The other Plant: {name}", and a Delivery player's has no "other Plant" text.
- **At the start,** exactly two pages show Management Plant at 10 players, and one at 5 and 7.
- **At the end,** every page's result lists the same two Plants, and the headline says "The Management Plants win" or "The Delivery Team wins".
- **The lobby** shows `5/10` in the walking-skeleton test.

**Screenshots and video** come from one more run of the 10-player test, with recording turned on by a throwaway Playwright config outside the repository. It recorded each player's context at 640×360 and took a full-page screenshot of every page at the end, and it passed in 9.3 min. In that game Chloe and Fotis were the Plants, and they won with Progress 34 of 48. A first recording at 1280×720 overran the test's 15-minute limit while the contexts closed (ten encoders on a shared machine), so it was dropped.

| Screenshot                         | What it shows                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `0-lobby-10-of-10.png`             | Ana's lobby with ten seated, `10/10`                                                                                                    |
| `1-plant-fotis-role-sprint-1.png`  | Sprint 1, Fotis: "Management Plant · The other Plant: Chloe"                                                                            |
| `2-delivery-ana-role-sprint-1.png` | Sprint 1, Ana: "Delivery Team", no second line                                                                                          |
| `3-plant-chloe-ended.png`          | The end, Chloe: "The Management Plants win", Chloe and Fotis listed as Plants, and her role panel still saying "The other Plant: Fotis" |
| `4-delivery-ana-ended.png`         | The end, Ana: the same result, no ally line                                                                                             |

Videos: `5-plant-fotis-full-game-6x.mp4` and `6-delivery-ana-full-game-6x.mp4` show Fotis's and Ana's pages from joining to the result at 6× speed (95 s each). The originals are kept beside them as `.webm` (9.5 min each).

## The balance evidence

The numbers behind D18 come from two throwaway prototypes that ran the real rules engine with 5,000 games per setting under two simulated policies: _static-debt_, which reproduces verification 01's simulator at 5–7 to within 1.6–5.4 points, and _main_, a stronger, coordinating team. Delivery Team wins at Target 5 × players − 2, for Plants sabotaging in 0 / 30 / 60 / 100% of sprints:

| Setup                            | static-debt               | main                      |
| -------------------------------- | ------------------------- | ------------------------- |
| D8 reference, 5 players          | 85 / 60 / 46 / 36         | —                         |
| Two Plants, 64 cards, 8 players  | 95.7 / 61.7 / 45.1 / 35.0 | 99.6 / 82.7 / 64.6 / 50.1 |
| Two Plants, 64 cards, 9 players  | 95.1 / 60.5 / 44.7 / 34.6 | 99.6 / 84.0 / 67.1 / 52.5 |
| Two Plants, 64 cards, 10 players | 94.6 / 60.3 / 44.8 / 35.5 | 99.6 / 86.0 / 70.7 / 56.8 |

The two Plants were simulated as sabotaging independently; neither policy models lying, inference, negotiation or what knowing each other changes. The simulators weren't kept in the repository, as verification 01's weren't.

## Inferred, not observed

- **Balance at a real table.** The win rates come from simulated policies that disagree with each other by up to 26 points at 8–10. Only a playtest says whether two Plants at 10 are as hard to find, and as fun, as one at 5.
- **Deduction with two Plants who know each other.** Whether their votes and defences lining up helps the Delivery Team, or the Plants, is unmeasured.
- **The browser runs play every player's first card,** as in verification 03. People choose differently.

## What wasn't checked

- **A deployed 10-player game,** and the soak against a deployment (`scripts/soak.mts` still seats 7). Locally each player has their own browser context; deployed, HTTP/2 lifts the six-streams-per-browser limit.
- **Ten seats at phone width.** The table layout for ten is separate work.
- **The paper recognition step** (Plants finding each other with eyes closed), and how long a sprint takes with ten people talking.
- **Absent players** stall the game, as before ([architecture](../architecture.md#known-limits-in-v0)); ten seats make that likelier.

## Evidence kept

Outside the repository, under `~/.local/state/strategic-realignment/04-ten-players/`:

- The screenshots above, `0-` to `4-`.

- The two videos above, at 6× and the original `.webm` recordings.
- `e2e-recorded-10-players.log`: the recorded 10-player run.

- `e2e-local-04.log`: the passing local Playwright run.

The plans, design reviews and their dispositions, both prototype reports with their simulator patches, and the implementation report are in `~/.local/share/agent-tools/shared/work-evidence/strategic-realignment-8-10-players/`.
