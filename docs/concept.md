# Strategic Realignment: concept proposal

> The original concept proposal this project started from, written 2026-10-12 for team discussion and kept as written except for this note and the title (it was first circulated under a working title naming an existing game). The adopted rules live in [rules.md](rules.md); where they differ, the rules win.

## A workplace-satire card game with hidden roles and social deduction

**Status:** concept proposal for team discussion. Mechanics, player count, and game length are starting points to playtest—not settled rules.

## The pitch

A software team is trying to ship a release, but someone is secretly working toward a “strategic reorganization.”

Everyone appears to be part of the delivery team. One player is secretly a **management plant**, undermining the project while appearing helpful.

The central joke—and the foundation for deduction—is that ordinary workplace dysfunction already looks like sabotage:

> Was that disastrous scope change deliberate, or did someone genuinely believe it was a good idea?

## Proposed format

- **Format:** team-based card game with a hidden infiltrator and a shared board.
- **Platform:** web browser; test the rules on paper or a shared board first.
- **Players:** initially target 5–7.
- **Length:** initially four sprints; establish session duration through playtests.
- **Interaction:** planning, secret contributions, bluffing, accusations, and audits.
- **No player elimination:** everyone stays involved until the end.

Although this draws on semi-cooperative games, the first version uses a clear team-versus-infiltrator structure. Innocent players share an objective rather than having competing private goals.

## Hidden allegiances and objectives

### Delivery team

Ship the release before the deadline without burning out the team.

### Management plant

Make the project fail, justifying a reorganization for which the slide deck is already prepared.

The plant needs to contribute useful work sometimes. Someone who contributes nothing is too easy to identify.

For the first prototype, leave out additional private objectives for innocent players. Layering conflicting incentives on top of a hidden infiltrator would make the game harder to understand and balance.

## A sprint’s structure

```text
Reveal a management demand
           ↓
Discuss the plan
           ↓
Submit contributions secretly
           ↓
Shuffle and resolve them together
           ↓
Discuss the damage; optionally conduct an audit
```

### 1. A shared crisis creates pressure

Each sprint introduces a demand or crisis that requires particular contributions.

Example:

> **The Demo Has Been Moved to Tomorrow**
>
> “Nothing needs to be production-ready. It just needs to work in production.”

The team discusses how to handle the demand while continuing work on the release.

### 2. Players promise help, then contribute secretly

Players have limited hands of cards and discuss what they can contribute.

Submitted cards are shuffled before being revealed. Everyone sees **what happened**, but not **who played each card**.

That creates the deduction:

> “We agreed on two testing contributions. Why are there three stakeholder workshops?”

Innocent players need legitimate constraints: unhelpful hands, competing maintenance needs, or expensive alternatives. A bad result must not automatically prove sabotage.

### 3. Resolve progress and consequences

Apply the combined contributions to the management demand and shared project state.

Some decisions help immediately but create later problems. Others protect the team at the cost of delivery speed. Exact costs and resolution rules need playtesting.

### 4. Discuss suspicions and optionally audit

Players compare promises with results and decide whether investigating someone is worth the cost.

Use a short discussion limit or an agreed end point so debate does not replace the game.

## Sabotage disguised as assistance

These are example concepts, not a balanced card set.

| Card                                | Claimed benefit             | Possible consequence                                 |
| ----------------------------------- | --------------------------- | ---------------------------------------------------- |
| **Architecture Alignment Workshop** | “Avoid expensive mistakes.” | Consumes the sprint’s remaining capacity.            |
| **Executive Escalation**            | “Get this unblocked.”       | Adds another management demand.                      |
| **Temporary Workaround**            | “Keep delivery moving.”     | Helps now, leaves a dangerous future failure.        |
| **Mandatory Status Update**         | “Increase transparency.”    | Improves reported status while delaying actual work. |
| **Ownership Clarification**         | “Establish accountability.” | Someone else loses an action.                        |

Some cards should be **situationally useful**, not universally bad. The interesting question is whether someone played a reasonable card at a suspiciously terrible time.

## Borrow the suspicion—not player elimination

### From Among Us

- Shared work.
- Sabotage.
- Accusations based on suspicious behaviour.

### From Werewolf and Mafia

- Hidden allegiances.
- Bluffing and persuasion.
- Collective decisions under uncertainty.

Avoid killing or ejecting players. Sitting out half the game is a poor fit for something built to play together as a team.

## Audits instead of ejections

Proposed audit mechanic:

- The team votes to audit a player.
- That player’s next contribution is public.
- The audit consumes shared capacity.
- Their allegiance remains secret.
- The team has a limited audit budget.

Accusations now have a cost. A plant can waste the team’s time investigating an innocent colleague.

> “We spent the entire sprint establishing accountability. Nothing shipped. Excellent governance.”

Identifying the plant should not produce an instant win. The team still needs to deliver the release.

## Important design risks

| Risk                                               | Design direction                                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Logs reveal the culprit automatically              | Public contribution histories must preserve the intended anonymity.                                   |
| Every harmful outcome proves sabotage              | Give innocent players plausible constraints and meaningful tradeoffs.                                 |
| Sabotage is indistinguishable from random bad luck | Give players enough evidence from promises, choices, and repeated outcomes to reason about suspicion. |
| Discussion overwhelms gameplay                     | Limit debate and keep each sprint moving.                                                             |
| One player makes all team decisions                | Preserve individual contribution choices and test whether everyone has meaningful agency.             |
| Finding the plant ends the interesting part        | Keep delivery as the team’s win condition.                                                            |
| Too many roles obscure the core loop               | Start with one infiltrator and no special powers.                                                     |

## Smallest useful prototype

Include:

- 5–7 players as an initial test range.
- One hidden management plant.
- Everyone else on the delivery team.
- Four sprints.
- One shared release and a morale track.
- Limited card hands.
- Secret, shuffled contributions.
- A small management-event deck.
- A limited audit budget.
- Shared project success or failure determining which side wins.

Leave out initially:

- Player elimination.
- Character powers and special roles.
- Additional private objectives.
- Campaigns and persistent progression.
- Elaborate project simulations.
- Accounts and matchmaking.

## First playtest

Test the rules with paper cards or a shared board before building networking.

The main question:

> Can players build a reasoned suspicion from decisions and outcomes, while the accused still has a believable defence?

Look for:

- The plant sometimes helping to preserve credibility.
- Innocent players making defensible decisions that still look suspicious.
- Evidence that supports deduction without identifying someone mechanically.
- Audits that create interesting choices rather than an automatic investigation sequence.
- Everyone remaining involved until the end.
- A desire to swap roles and play again.

The intended sweet spot:

> “You’re sabotaging us.”
>
> “No, this is literally our normal development process.”

## Path to a browser game

After the core loop works:

1. **Specify the minimum rules:** card visibility, contributions, resolution, audits, and win conditions.
2. **Build a deployed room skeleton:** create a room, join it, see players, and start a session.
3. **Implement private and shared information:** players see their own hands and allegiance; the group sees only the intended public state.
4. **Deliver a complete game:** four sprints, outcome, and restart.
5. **Playtest and harden:** verify that networking, reconnects, and public histories do not accidentally reveal hidden information; improve clarity, accessibility, and pacing.

Choose the stack after the gameplay and information-visibility rules are clearer.

## Questions for team discussion

1. Is fighting a hidden management plant more appealing than a fully cooperative game?
2. Which workplace behaviours offer plausible deniability and interesting tradeoffs?
3. How much discussion and bluffing do we want relative to card play?
4. Does auditing feel satisfying without revealing someone’s allegiance?
5. What would make playing the plant fun without making everyone else feel powerless?
