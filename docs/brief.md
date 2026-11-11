# Project brief

**Strategic Realignment** is a browser game satirizing life as a software engineer in a toxic workplace. A team ships a release over four sprints while one hidden player, a management plant, quietly works for the reorganization. The core joke is that sabotage looks exactly like the team's normal process.

The project has two goals of equal weight:

1. **A game the team wants to play again.**
2. **A documented process,** from design to verification, that the team can read as a worked example: every decision with its options and reasons, and every slice with evidence that it works.

## Boundaries

| Question         | Answer                                                                                |
| ---------------- | ------------------------------------------------------------------------------------- |
| Purpose          | Fun and learning. A team game, not a product.                                         |
| Players          | 5–7 colleagues per game, each on their own device.                                    |
| Where            | Remote or in person, with everyone talking on their usual call. The game has no chat. |
| Devices          | Desktop browsers first. Phones should work but aren't a first target. _(assumption)_  |
| Session length   | One game in roughly 20–30 minutes, to be measured in playtests. _(assumption)_        |
| Release boundary | Private team sessions; the source is public on GitHub.                                |

## Non-goals

- Accounts, matchmaking and public lobbies. You join with a room code and a name.
- Anything that survives a server restart: no database, no progression, no history.
- Monetization, and native or mobile apps.
- A generic game engine. The code serves this one game.

## Where it came from

The game design started as a concept proposal for team discussion ([concept.md](concept.md)). This project adopts it as the baseline, including its central choice: suspects are audited, never eliminated, because sitting out half the game is a poor fit for something built to play together.
