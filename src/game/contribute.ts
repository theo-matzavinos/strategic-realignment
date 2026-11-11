import type { CardType } from './cards';
import {
  currentDemand,
  type ContributeGame,
  type EndedGame,
  type Game,
  type LoggedAction,
  type PlayerId,
  type RetroGame,
  type StoredReveal,
} from './game';
import { nextRandom, shuffle } from './random';
import { resolve } from './resolve';
import type { RuleError } from './rule-error';

/** Places one card from the player's hand. The last placement reveals and resolves the sprint. */
export function contribute(
  game: Game,
  logged: LoggedAction,
  card: CardType,
): Game | RuleError<'WRONG_PHASE' | 'ALREADY_CONTRIBUTED' | 'CARD_NOT_IN_HAND'> {
  if (game.phase !== 'contribute') {
    return { code: 'WRONG_PHASE' };
  }

  const { playerId } = logged;
  if (Object.hasOwn(game.contributions, playerId)) {
    return { code: 'ALREADY_CONTRIBUTED' };
  }

  const hand = [...game.hands[playerId]];
  const index = hand.indexOf(card);
  if (index === -1) {
    return { code: 'CARD_NOT_IN_HAND' };
  }
  hand.splice(index, 1);

  const next: ContributeGame = {
    ...game,
    log: [...game.log, logged],
    hands: { ...game.hands, [playerId]: hand },
    contributions: { ...game.contributions, [playerId]: card },
  };

  for (const player of next.players) {
    if (!Object.hasOwn(next.contributions, player)) {
      return next;
    }
  }

  return reveal(next);
}

/** Rules v0 Reveal and Resolve, then the end of the sprint: the retro, or the end of the game. */
function reveal(game: ContributeGame): RetroGame | EndedGame {
  const { phase, contributions, ...seated } = game;
  const demand = currentDemand(game);

  // Seat order, never submission order: the shuffle below is the only thing that orders the cards.
  const faceDown: { card: CardType; playerId: PlayerId }[] = [];
  for (const player of game.players) {
    if (player !== game.audited) {
      faceDown.push({ card: contributions[player], playerId: player });
    }
  }

  const shuffled = shuffle(faceDown, game.random);
  const cards = shuffled.items;
  let random = shuffled.state;

  let removed: StoredReveal['removed'] = null;
  if (demand === 'oneWeekSprint') {
    const pick = nextRandom(random);
    random = pick.state;
    const [removedCard] = cards.splice(Math.floor(pick.value * cards.length), 1);
    removed = removedCard;
  }

  let audited: StoredReveal['audited'] = null;
  if (game.audited !== null) {
    audited = { playerId: game.audited, card: contributions[game.audited] };
  }

  const revealed: CardType[] = [];
  for (const { card } of cards) {
    revealed.push(card);
  }
  if (audited !== null) {
    revealed.push(audited.card);
  }

  const { board, outcome } = resolve(game.board, demand, revealed);

  const discard = [...game.discard];
  for (const player of game.players) {
    discard.push(contributions[player]);
  }

  const resolved = {
    ...seated,
    random,
    board,
    discard,
    audited: null,
    lastReveal: { sprint: game.sprint, cards, audited, removed, outcome },
  };

  if (board.morale <= 0) {
    return { ...resolved, phase: 'ended', winner: 'plant', vote: null };
  }

  if (game.sprint === 4) {
    const delivered = board.progress >= board.target;
    if (delivered) {
      return { ...resolved, phase: 'ended', winner: 'delivery', vote: null };
    }

    return { ...resolved, phase: 'ended', winner: 'plant', vote: null };
  }

  return { ...resolved, phase: 'retro', vote: null, ready: [], nextAudited: null };
}
