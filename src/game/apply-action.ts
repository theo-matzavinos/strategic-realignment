import type { Action } from './action';
import { contributionDeck, type CardType } from './cards';
import { ceoTargetIncrease, demandDeck } from './demands';
import {
  maxPlayers,
  minPlayers,
  startingBoard,
  startingTarget,
  type Game,
  type LobbyGame,
  type PlayerId,
  type PlayingGame,
  type Role,
} from './game';
import { shuffle } from './random';

export type RuleErrorCode = 'NOT_HOST' | 'NOT_ENOUGH_PLAYERS' | 'WRONG_PHASE';

export type RuleError = { code: RuleErrorCode };

const handSize = 3;
const demandsPerGame = 4;

/** Applies one validated action. Returns the next game, or why the action is refused. */
export function applyAction(game: Game, playerId: PlayerId, action: Action): Game | RuleError {
  switch (action.type) {
    case 'startGame': {
      return startGame(game, playerId, action);
    }
  }
}

function startGame(game: Game, playerId: PlayerId, action: Action): PlayingGame | RuleError {
  if (game.phase !== 'lobby') {
    return { code: 'WRONG_PHASE' };
  }

  if (playerId !== game.host) {
    return { code: 'NOT_HOST' };
  }

  if (game.players.length < minPlayers) {
    return { code: 'NOT_ENOUGH_PLAYERS' };
  }

  if (game.players.length > maxPlayers) {
    // addPlayer never seats an 8th player, so this is a corrupted game, not a refused action.
    throw new Error(`A lobby can't hold ${game.players.length} players`);
  }

  return setUp(game, { playerId, action });
}

/** Rules v0 Setup, then sprint 1's Demand step. Draw is a no-op: every hand starts full. */
function setUp(game: LobbyGame, logged: { playerId: PlayerId; action: Action }): PlayingGame {
  const playerCount = game.players.length;

  const roleCards: Role[] = ['plant'];
  for (let index = 1; index < playerCount; index++) {
    roleCards.push('delivery');
  }
  const shuffledRoles = shuffle(roleCards, game.random);

  const shuffledDeck = shuffle(contributionDeck(), shuffledRoles.state);
  const deck = shuffledDeck.items;

  const shuffledDemands = shuffle(demandDeck, shuffledDeck.state);
  const demands = shuffledDemands.items.slice(0, demandsPerGame);
  const unusedDemands = shuffledDemands.items.slice(demandsPerGame);

  const roles: Record<PlayerId, Role> = {};
  const hands: Record<PlayerId, CardType[]> = {};
  for (let seat = 0; seat < playerCount; seat++) {
    const player = game.players[seat];
    roles[player] = shuffledRoles.items[seat];
    hands[player] = deck.splice(0, handSize);
  }

  let target = startingTarget(playerCount);
  const firstDemand = demands[0];
  if (firstDemand === 'ceoCompetitor') {
    target += ceoTargetIncrease;
  }

  return {
    seed: game.seed,
    random: shuffledDemands.state,
    host: game.host,
    players: [...game.players],
    log: [...game.log, logged],
    phase: 'contribute',
    sprint: 1,
    board: { ...startingBoard, target },
    roles,
    hands,
    deck,
    discard: [],
    demands,
    revealedDemands: 1,
    unusedDemands,
  };
}
