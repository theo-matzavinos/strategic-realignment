# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A software team of about 10 colleagues who play together, 5–10 per game, each on their own device. Everyone is talking on their usual video call, remote or in person; the game has no chat. A game takes roughly 20–30 minutes (an assumption until playtests measure it). Desktop browsers come first, and phones should work.

Rules v0 seats 5–10. At 8–10 there are two Management Plants who know each other and win or lose together, and a larger deck (`docs/rules.md`, decision D18). The whole team of 10 can play one game on one call.

## Product Purpose

Strategic Realignment is a browser game that satirizes life as a software engineer in a toxic workplace. A team ships a release over four sprints while one hidden player, the Management Plant (two of them at 8–10 players), quietly works for the reorganization. It has two goals of equal weight: a game the team wants to play again, and a documented process from design to verification that the team can read as a worked example.

Success means a full game runs with no developer repairing it, and players want to swap roles and play again.

## Positioning

The core joke, and the basis for deduction, is that sabotage looks exactly like the team's normal process. Every harmful card has an innocent explanation:

> "You're sabotaging us."
> "No, this is literally our normal development process."

Contributions are secret and shuffled before the reveal. Everyone sees what happened, never who played what. Suspects are audited, never eliminated.

## Operating Context

- Players join with a room code and a name. One session cookie per browser profile maps to one seat.
- Each sprint goes: management demand → discussion on the call → each player contributes one card secretly → shuffled reveal and resolution → retro with an optional audit vote (sprints 1–3).
- The discussion happens on the call, not in the app. The app is the shared table and each player's private hand.
- Access is gated by Cloudflare Access: private team sessions only.

## Capabilities and Constraints

- Rules v0 lives in `docs/rules.md` and is authoritative. The app implements exactly those rules.
- Hidden information is strict. Each player sees only their own role and hand; with two Plants, each Plant also knows the other. Other players' hands show only a count, and the reveal never shows who played which card (except an audited player's card). Any presentation, ordering or animation must preserve this.
- State lives in one Durable Object's memory. A deploy ends games in progress.
- Non-goals: accounts, matchmaking, public lobbies, persistence or progression, monetization, native apps, a generic engine.
- Stack: Angular with `@loozo/angular-launch` on Cloudflare Workers, plus Tailwind. Playwright drives full games in 5, 7 and 10 browser contexts, locally and deployed.

## Brand Commitments

- The name is **Strategic Realignment**.
- The satire lives in the interface as a parody of corporate work tools: the game wears the look of the software a toxic workplace runs on. Confirmed by loozo, 2026-11-17.
- The voice is deadpan corporate. The demand flavor lines in `docs/rules.md` set the register ("Same scope. We believe in you.").
- Dark mode is supported and is the default.

## Evidence on Hand

- Card, demand and flavor text: `docs/rules.md`.
- The original pitch and example quotes: `docs/concept.md`.
- No logo, illustration or sound assets exist.

## Product Principles

- Everyone stays involved until the end. No elimination and no idle spectators.
- Deduction comes from evidence, never from leaks. The interface must not reveal what the rules hide.
- The joke is the process. Dysfunction is presented with a straight face.
- The table serves the call. The app shows state at a glance so players can keep talking.
