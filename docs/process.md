# Process

How this project goes from idea to a game the team plays, and how each step is documented. The order follows one principle: get the team into a playable session early, then improve it. Don't build a game engine first.

## Phases

| #   | Phase                                 | Exit condition                                                         | Status                                                     |
| --- | ------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Agree on boundaries                   | A short brief with constraints and non-goals                           | Done: [brief](brief.md)                                    |
| 2   | Choose and test the core loop         | The team understands the rules and wants to play again                 | Rules v0 written; paper playtest pending                   |
| 3   | Resolve the architecture questions    | An architecture sketch and explicit session rules                      | Done: [architecture](architecture.md), approved 2026-11-11 |
| 4   | Deployed multiplayer walking skeleton | Teammates join one room from their own devices and see one action sync | Deployed and verified; the team session is still to come   |
| 5   | First playable slice                  | A full game with no developer repairing it                             | Deployed and verified; the team playtest is still to come  |
| 6   | Team playtests drive development      | Correctness, clarity and fun problems found in play get fixed          |                                                            |
| 7   | Harden and polish                     | Someone can run a session without the implementers supervising         |                                                            |

## Slices

Each slice is one small, complete piece of work with an observable done check.

| #   | Slice            | Done check                                                                                                | Verification                              |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | Design baseline  | A paper playtest can run from the rules alone; every hidden item maps to one view field                   | [01](verification/01-design-baseline.md)  |
| 2   | Walking skeleton | Create a room, join from several browsers, see players arrive and one action sync through the view stream | [02](verification/02-walking-skeleton.md) |
| 3   | First playable   | A full game of rules v0 in the deployed app, each player seeing only their own view at every step         | [03](verification/03-first-playable.md)   |

## How each slice is documented

- **Before:** consequential choices go in [decisions](decisions.md) with their options and reasons. Interfaces and data shapes are proposed in [architecture](architecture.md) and approved before code.
- **After:** a verification report in `verification/` that separates what was observed (commands run, tests, screenshots, replays) from what was only inferred, and says what wasn't checked.
