# Verification 05: the Sprint Calendar

**Slice:** Sprint Calendar ([process](../process.md), slice 5).
**Date:** 2026-11-18
**Result:** passed, locally and deployed, with slice 4's 8–10 players integrated. The team playtest is still to come.

## Done check

> The room, lobby and waiting room look and feel like a game in the approved Sprint Calendar design ([D19](../decisions.md#d19-the-game-looks-like-a-parody-of-a-group-calendar)): real cards, a table instead of a page, staged moments. Every player still sees only their own view at every step, and nothing in the layout or motion hints at who played what. It works at 390 px and desktop widths for 5–10 players.

## What was built

Five commits, `559c987` to `121ea7c`:

- **Design system** (`559c987`): [DESIGN.md](../../DESIGN.md) and [PRODUCT.md](../../PRODUCT.md). Figtree, dark tokens, one colour per card type, paper card faces and calendar event blocks. Every text and interactive state is at least 4.5:1.
- **Room table** (`c922e84`):
  - a top bar and a strip of tracks;
  - a week: Leadership's demand on Monday, one slot per player on Tue–Wed, the Sprint Review on Thursday, the retro's poll on Friday, and a Debt band across the week;
  - attendees, and a hand tray of cards beside your private role.

  Below 1280 px the week becomes a day view with tabs.

- **Lobby and waiting room** (`2ed9ba7`): the pitch above "New team calendar" and "Join with a code", then a Sprint 1 kickoff invite that fills as people accept.
- **Moments** (`c968d8c`):
  - booking moves your card into your slot;
  - a reminder announces the Sprint Review;
  - the week shifts and the rows turn over in `lastReveal.cards` order;
  - the notes count up, and an incident shakes the grid;
  - a decided audit is stamped and Morale drains;
  - the next sprint slides in with its demand;
  - the end is an all-hands or a release-celebration invite.

  Moments play only on a change the page receives, never on load. The reminder is non-modal and lets presses through. Reduced motion makes everything instant.

- **8–10 players** (`121ea7c`): slice 4's rules carried over unchanged. A Plant's role box names the other Plant, the end turns plural when two Plants win, and the copy says 5–10.

## Observed

Everything below was run on 2026-11-17 and 18 with Node 24.21.0, Chromium (Playwright 1.65.0) and wrangler 4.160.0, on `121ea7c`.

### 1. Unit and component tests

584 tests pass. They include:

- slice 4's replay of ten games recorded at `b688b8b`;
- the hidden-information suite over 5–10 players;
- component tests that pin:
  - the Sprint Review's row order, your "You" marker, the audited row last and attributed, and the removed row;
  - that an error lives only as long as its game step;
  - that your picked card or nominee survives other players' snapshots;
  - the moments' lifecycle, including reduced-motion changes and a result arriving mid-moment.

### 2. Full games in browsers, locally and deployed

`npm run e2e` passed 14 of 14 locally (16.7 min). The same suite passed 14 of 14 against the deployment, through Cloudflare Access with a service token (17.4 min).

| Test                      | Local      | Deployed   |
| ------------------------- | ---------- | ---------- |
| 5 players, desktop        | 35.9 s     | 45.0 s     |
| 7 players, 390 px         | 2.9 min    | 3.1 min    |
| 10 players, desktop       | 12.2 min   | 12.2 min   |
| 8 moment tests, motion on | 1.4–26.1 s | 3.1–20.3 s |
| 3 walking-skeleton tests  | 0.2–1.8 s  | 0.3–3.1 s  |

**At every step, the full games check for every player:**

- the view payload, which must hold only that player's information, with `otherPlant` checked by value;
- each day lane, and each attendee's tags within that attendee's own row;
- every card the player can choose, its face and accessible description included;
- the reveal rows against the payload's order;
- the end invite, scrolled with the mouse wheel at 390×568 and 844×390;
- that nothing is clipped, at five widths from 1280 down to 390 px.

They also cover refused calls that leave every view unchanged, a lost reply, and the header in its "Connection lost" state.

**The main games run with reduced motion,** so no step waits on a moment.

**`e2e/moments.spec.ts` plays with motion on.** It checks:

- the order in which the reveal rows started turning, against the payload;
- one-tap input through the reminder at phone width;
- reduced motion switched on and off mid-session;
- an incident followed by everyone marking ready;
- a result arriving mid-moment;
- an audit ending the game mid-reveal;
- focus kept on Dismiss when the reminder becomes a banner.

**The deploy:** worker version `54fcca89-7e22-4fa9-8a3a-f5552bd5c0b6`. Checked with `curl` against it: without a token, the page and an RPC both answer 302 to the Access login.

### 3. Review

Each slice went through adversarial review rounds: three for slices 1 and 2 together, one for slice 3, three for slice 4, and one for the 8–10 integration. They found 15 problems, and all are fixed, each with a test that fails without its fix. The problems were:

- the phone header when the connection is lost;
- errors outliving their action;
- hover contrast;
- weakened e2e checks;
- clipping at intermediate widths;
- the Workshop's cost missing from the reveal;
- picks resetting on other players' actions;
- card descriptions for screen readers;
- the end invite on short screens;
- taps blocked by the reminder;
- reduced-motion changes mid-moment;
- stale animations after a later sprint or the end;
- focus during the reminder's swap.

## Inferred, not observed

- **Real phones:** 390 px was checked in headless Chromium. Frame timing at 390 px with 4× CPU throttling had a median of 16.7 ms and a worst frame of 33.3 ms, on a headless browser rather than a device.
- **Real players:** the browsers are Playwright's. Whether the calendar reads as a game rather than as actual work is for the playtest to say.

## What wasn't checked

- **The team playtest.**
- **Windows from 721 to 1279 px** get the day view stretched wide. Nothing is clipped there, but that width wasn't designed.
- **Sprint 4's last booking** goes straight to the end invite without the reveal moment. The final reveal is on the board behind the invite.
- **The lobby headline** "One of you would rather it didn't." holds for 5–7 players. With 8–10 there are two Plants.

## Evidence kept

Outside the repository, under `~/.local/state/strategic-realignment/`:

- `e2e-deployed-05.json`: the deployed Playwright run.

The plan, decision sketches, implementation reports, eight review rounds and their dispositions, screenshots and videos are kept with this slice's working notes.
