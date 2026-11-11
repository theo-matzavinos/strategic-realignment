# Verification 01: design baseline

**Slice:** the design baseline: [brief](../brief.md), [rules v0](../rules.md), [architecture](../architecture.md) and [decisions](../decisions.md).
**Date:** 2026-11-11
**Result:** passed, with the paper playtest still to run.

## Done check

> Someone can run a paper playtest from `rules.md` alone, and every hidden item in it maps to a field in exactly one player's view.

## What was checked

### 1. The rules resolve every situation without outside knowledge

**Method:** a throwaway simulator played the card, demand and incident rules as written, 10,000–20,000 games per setting, at 5, 6 and 7 players. It doesn't model discussion, audits or votes. Writing it alongside the rules forced a decision at every point where the draft left one open. Each such gap was settled in `rules.md`, not just in the simulator:

| Gap found                                                          | Now in the rules                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| Two Alignment Workshops in one sprint                              | Reductions stack: 2 per Workshop for each other card. |
| Order of Workaround Debt and Refactoring                           | Add first, then subtract, never below 0.              |
| Whether the card removed by One Week counts toward the requirement | It doesn't; only revealed cards count.                |
| Whether a missed demand's Debt can cause an incident that sprint   | Yes: the demand is checked before the incident.       |

**Observed:** every simulated game reached an end state with a winner, using only the rules as written. The audit rules were checked only by reading them; the paper playtest is their first real test.

**Simulated strategies:** the Delivery Team covers each demand's requirement first, then plays its best Progress card, avoiding Workarounds once Debt is high. With a set probability each sprint, the Plant plays its most plausible harmful card (a Workshop, then a Workaround, then whatever doesn't meet the requirement); otherwise it plays helpfully.

### 2. The Plant matters

**Observed** on the first draft: the Target that gives an even game moved only from 31 to 28 for 5 players between a Plant that never sabotages and one that always does. That's a 10% swing, so the draw would decide most games. After the changes in [D8](../decisions.md#d8-rules-v0-balance-give-the-plant-real-leverage), with the Target at 5 × players − 2:

| Plant sabotages | Team wins, 5 players | 6 players | 7 players |
| --------------- | -------------------- | --------- | --------- |
| never           | 85%                  | 87%       | 86%       |
| 30% of sprints  | 60%                  | 60%       | 59%       |
| 60% of sprints  | 46%                  | 47%       | 45%       |
| every sprint    | 36%                  | 37%       | 37%       |

20,000 games per cell. The shape holds across player counts: an honest table usually ships, and a committed Plant usually wins, but not always.

### 3. Every hidden item has exactly one place in the view

**Method:** a row-by-row comparison of the [rules' visibility table](../rules.md#who-sees-what) with the [architecture's mapping](../architecture.md#hidden-information).

**Observed:** every row maps to one view field or to "nowhere". The comparison found one leak in the first view draft: audit votes were visible as they came in, breaking the simultaneous vote. Both documents were fixed. Card ids and submission order are excluded by construction.

## What wasn't checked

- **Humans playing it.** The paper playtest is the real done check for the rules, and it hasn't run yet. The simulated team coordinates perfectly and the simulated Plant follows a fixed policy, so real games will likely score lower and play differently. Treat the numbers as a starting point, not a result.
- **Audits.** The simulator ignores them, so their cost (a Morale point each) isn't reflected in the numbers above.
- **Fun.** No simulation measures it.
- **The architecture.** It's a proposal whose RPC surface and data shapes still need approval; the walking skeleton is its first real test.

## Evidence kept

The simulator was a throwaway and isn't in the repository. Once the rules engine exists, a balance check should run on the engine itself, so the two can't disagree.
