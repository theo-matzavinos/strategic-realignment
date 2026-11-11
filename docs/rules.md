# Rules v0

**Status:** draft for the first paper playtest. Numbers marked **(knob)** are tuning values to change after playtests, not settled design. The browser game implements exactly these rules; if a rule changes, change it here first.

## Overview

A software team has four sprints to ship a release. One player is secretly the **Management Plant**, working toward a "strategic realignment" the slide deck already announces. Everyone else is on the **Delivery Team**.

- **Players:** 5–7.
- **Delivery Team wins** if, after the fourth sprint, Progress has reached the Target and Morale is above 0.
- **The Plant wins** otherwise, and immediately if Morale reaches 0.
- Nobody is eliminated. Suspected players are **audited**: their next contribution is played face up. Audits never reveal anyone's role.

The central joke, and the basis for deduction: every harmful card has an innocent explanation.

> "You're sabotaging us."
>
> "No, this is literally our normal development process."

## Components

**Role cards:** 1 Management Plant, plus one Delivery Team card per other player.

**Board tracks:**

| Track       | Start                      | Notes                                        |
| ----------- | -------------------------- | -------------------------------------------- |
| Progress    | 0                          | Never below 0.                               |
| Target      | 5 × players − 2 **(knob)** | 5 players: 23, 6 players: 28, 7 players: 33. |
| Morale      | 4 **(knob)**               | 0 ends the game; the Plant wins.             |
| Debt        | 0                          | Never below 0. Causes incidents.             |
| Audits left | 2 **(knob)**               | Shared by the whole team.                    |
| Sprint      | 1                          | The game ends after sprint 4.                |

**Contribution deck (44 cards):**

| Card                 | Count | Effect                                                                                                                           |
| -------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| Feature Work         | 11    | +2 Progress.                                                                                                                     |
| Temporary Workaround | 9     | +3 Progress, +1 Debt.                                                                                                            |
| Test Coverage        | 8     | +1 Progress. Counts as **Testing**.                                                                                              |
| Refactoring          | 6     | −2 Debt. Counts as **Refactoring**.                                                                                              |
| Status Update        | 4     | No effect. Counts as **Visibility**.                                                                                             |
| Alignment Workshop   | 6     | Meets this sprint's demand requirement. Every other card contributed this sprint gives 2 less Progress (never below 0 per card). |

Several Alignment Workshops stack: each other card loses 2 Progress per Workshop. Workshops don't change Debt effects.

**Demand deck (6 cards, 4 used per game):**

| Demand                             | Flavor                                                                       | Requirement                                                             | If missed |
| ---------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------- |
| The Demo Moved to Tomorrow         | "Nothing needs to be production-ready. It just needs to work in production." | Gain at least 5 Progress this sprint.                                   | −1 Morale |
| Quarterly Visibility Review        | "Leadership would love more visibility into the visibility."                 | 1 Visibility.                                                           | −1 Morale |
| The Pen Test Results Are In        | "Nobody panic. Legal is panicking for us."                                   | 2 Testing.                                                              | +2 Debt   |
| Platform Migration Mandate         | "The old platform is deprecated. So is the new one."                         | 1 Refactoring.                                                          | +2 Debt   |
| The CEO Saw a Competitor's Feature | "It's basically the same product."                                           | None. Target +3 for the rest of the game.                               | —         |
| The Sprint Is Now One Week         | "Same scope. We believe in you."                                             | None. One contribution is removed at random, unseen, before the reveal. | —         |

## Setup

1. Set the Target from the player count. Morale 4, Debt 0, Progress 0, Audits left 2.
2. Shuffle the role cards and deal one face down to each player. Look at yours privately.
3. Shuffle the contribution deck and deal 3 cards to each player.
4. Shuffle the demand deck. Put 4 face down as this game's demands; return the other 2 to the box without looking.

## A sprint

Play four sprints. Each one runs these steps in order.

1. **Demand.** Reveal the next demand. If it's The CEO Saw a Competitor's Feature, raise the Target now.
2. **Draw.** Each player draws back up to 3 cards. If the deck runs out, shuffle the discard pile to form a new one.
3. **Plan** (3 minutes **(knob)**). Discuss what to play. You may say anything about your hand, true or false; you may not show your cards.
4. **Contribute.** Each player places exactly one card face down. An audited player places theirs face up and says it's theirs.
5. **Reveal.** One player shuffles the face-down cards. If the demand is The Sprint Is Now One Week, they discard one of them at random, without anyone looking. Then they turn the rest face up. The audited player's card is added face up and attributed.
6. **Resolve,** in this order:
   1. **Progress:** add up the revealed cards' Progress, after Workshop reductions.
   2. **Debt:** add 1 per Temporary Workaround, then subtract 2 per Refactoring. Never below 0.
   3. **Demand:** check the requirement against the revealed cards only; the removed card doesn't count. Any Alignment Workshop meets it. If it's missed, apply the penalty.
   4. **Incident:** if Debt is 3 or more, lose 5 Progress **(knob)** and 3 Debt.
   5. **Morale:** if Morale is 0, the game ends and the Plant wins.

   Then put all played and removed cards on the discard pile.

7. **Retro** (3 minutes **(knob)**, sprints 1–3 only). Discuss what happened. The team may hold one audit vote.

## Audits

- During a retro, any player may nominate one other player. Everyone, including the nominee, votes yes or no at the same time and in the open.
- The audit passes if more than half of all players vote yes.
- **If it passes:** Audits left −1, Morale −1 ("accountability is exhausting"), and the audited player contributes face up next sprint. Check Morale: at 0 the Plant wins.
- **If it fails:** nothing happens, but that retro's vote is used.
- No audits once Audits left is 0, and none in sprint 4's retro, since there's no next sprint.
- An audit never reveals a role.

## End of the game

After sprint 4 resolves: if Progress is at least the Target and Morale is above 0, the Delivery Team wins. Otherwise the Plant wins. Everyone reveals their role. Who played which card stays unknown, as it was during play.

## Who sees what

This table is the contract the browser game's per-player views must follow ([architecture](architecture.md#hidden-information)).

| Information                                        | Who sees it                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| Your role                                          | You, from setup.                                                 |
| Other players' roles                               | Nobody, until the game ends.                                     |
| Your hand                                          | You.                                                             |
| Other players' hands                               | Nobody. The number of cards each holds is public.                |
| Deck order and the 2 unused demands                | Nobody, ever.                                                    |
| The next demand                                    | Nobody, until it's revealed.                                     |
| Your contribution this sprint                      | You, from when you place it.                                     |
| Whether a player has contributed yet               | Everyone. Not which card.                                        |
| The revealed contributions                         | Everyone, after the reveal, in shuffled order, unattributed.     |
| Which revealed card was yours                      | You.                                                             |
| The audited player's contribution                  | Everyone, attributed to them.                                    |
| The card removed by The Sprint Is Now One Week     | Nobody, ever.                                                    |
| Your audit vote                                    | You, from when you cast it.                                      |
| Other players' audit votes                         | Everyone, once all votes are in. Until then, only who has voted. |
| Board tracks, demands revealed so far, nominations | Everyone.                                                        |

## Example sprint

Five players, sprint 2. Progress 8, Debt 1, Morale 4. The demand is **The Pen Test Results Are In** (2 Testing).

In planning, Ana and Ben say they'll cover Testing, and everyone else promises Feature Work. The revealed cards are Test Coverage, Test Coverage, Feature Work, Temporary Workaround and Alignment Workshop.

- **Progress:** the Workshop takes 2 from every other card: Test 1 → 0, Test 1 → 0, Feature 2 → 0, Workaround 3 → 1. +1 Progress, so Progress is 9.
- **Debt:** +1 for the Workaround, so Debt is 2.
- **Demand:** met, by the two Tests (the Workshop would have met it anyway).
- **Incident:** Debt is 2, so none.

The retro writes itself. Testing was already covered, so who brought the Workshop? Its player says they didn't trust the Testing promises and wanted the requirement guaranteed. And the Workaround came from someone who promised Feature Work.

## Questions for the first playtest

The main question: can players build a reasoned suspicion from decisions and outcomes, while the accused still has a believable defense?

Record for each game: player count, winner, final Progress against Target, Morale at the end, who was audited and when, whom the team suspected before the reveal, and how long each sprint took. Also look for:

- The Plant helping sometimes to stay credible.
- Innocent players making defensible plays that still look suspicious.
- Audits being a real choice rather than a routine.
- Everyone staying involved until the end, and wanting to swap roles and play again.
- Whether the Target is reachable but tight. The simulation in [verification 01](verification/01-design-baseline.md) assumes perfect coordination, so real tables will likely score lower.
