import type { CardType } from './cards';
import { ceoTargetIncrease } from './demands';
import {
  handSize,
  type ContributeGame,
  type Game,
  type LoggedAction,
  type PlayerId,
  type RetroGame,
  type Sprint,
} from './game';
import { shuffle } from './random';
import type { RuleError } from './rule-error';

const moraleLostPerAudit = 1;

/** Opens this retro's one audit vote on another player. */
export function nominate(
  game: Game,
  logged: LoggedAction,
  nominee: PlayerId,
):
  | Game
  | RuleError<
      'WRONG_PHASE' | 'VOTE_ALREADY_HELD' | 'NO_AUDITS_LEFT' | 'UNKNOWN_PLAYER' | 'SELF_NOMINATION'
    > {
  if (game.phase !== 'retro') {
    return { code: 'WRONG_PHASE' };
  }

  if (game.vote !== null) {
    return { code: 'VOTE_ALREADY_HELD' };
  }

  if (game.board.auditsLeft === 0) {
    return { code: 'NO_AUDITS_LEFT' };
  }

  if (!game.players.includes(nominee)) {
    return { code: 'UNKNOWN_PLAYER' };
  }

  if (nominee === logged.playerId) {
    return { code: 'SELF_NOMINATION' };
  }

  // The vote's outcome is new to discuss, so everyone's ready mark is cleared.
  return { ...game, log: [...game.log, logged], vote: { nominee, votes: {} }, ready: [] };
}

/** Casts one final vote. The last vote decides the audit. */
export function vote(
  game: Game,
  logged: LoggedAction,
  yes: boolean,
): Game | RuleError<'WRONG_PHASE' | 'NO_VOTE_OPEN' | 'ALREADY_VOTED'> {
  if (game.phase !== 'retro') {
    return { code: 'WRONG_PHASE' };
  }

  if (game.vote === null) {
    return { code: 'NO_VOTE_OPEN' };
  }

  const { playerId } = logged;
  if (Object.hasOwn(game.vote.votes, playerId)) {
    return { code: 'ALREADY_VOTED' };
  }

  const votes = { ...game.vote.votes, [playerId]: yes };
  const next: RetroGame = {
    ...game,
    log: [...game.log, logged],
    vote: { nominee: game.vote.nominee, votes },
  };

  if (!isComplete(next)) {
    return next;
  }

  let yesVotes = 0;
  for (const player of next.players) {
    if (votes[player]) {
      yesVotes++;
    }
  }

  const passed = yesVotes > next.players.length / 2;
  if (!passed) {
    return next;
  }

  const board = {
    ...next.board,
    auditsLeft: next.board.auditsLeft - 1,
    morale: next.board.morale - moraleLostPerAudit,
  };

  // The game ends on this vote, so the ended game keeps it for everyone to see.
  if (board.morale <= 0) {
    const { phase, vote: decidingVote, ready, nextAudited, ...seated } = next;
    return { ...seated, board, phase: 'ended', winner: 'plant', vote: decidingVote };
  }

  return { ...next, board, nextAudited: game.vote.nominee };
}

/** Marks the player ready. When everyone is, the next sprint starts. */
export function finishRetro(
  game: Game,
  logged: LoggedAction,
): Game | RuleError<'WRONG_PHASE' | 'VOTE_OPEN' | 'ALREADY_READY'> {
  if (game.phase !== 'retro') {
    return { code: 'WRONG_PHASE' };
  }

  if (game.vote !== null && !isComplete(game)) {
    return { code: 'VOTE_OPEN' };
  }

  const { playerId } = logged;
  if (game.ready.includes(playerId)) {
    return { code: 'ALREADY_READY' };
  }

  const next: RetroGame = {
    ...game,
    log: [...game.log, logged],
    ready: [...game.ready, playerId],
  };

  if (next.ready.length < next.players.length) {
    return next;
  }

  return startNextSprint(next);
}

function isComplete(game: RetroGame): boolean {
  if (game.vote === null) {
    return false;
  }

  return Object.keys(game.vote.votes).length === game.players.length;
}

const sprints: Sprint[] = [1, 2, 3, 4];

/** Rules v0 Demand and Draw for the next sprint. */
function startNextSprint(game: RetroGame): ContributeGame {
  const { phase, vote, ready, nextAudited, ...seated } = game;

  const sprint = sprints[game.sprint];
  if (sprint === undefined) {
    throw new Error(`Sprint ${game.sprint} has no next sprint`);
  }

  const revealedDemands = game.revealedDemands + 1;
  const demand = game.demands[revealedDemands - 1];
  const board = { ...game.board };
  if (demand === 'ceoCompetitor') {
    board.target += ceoTargetIncrease;
  }

  let deck = [...game.deck];
  let discard = [...game.discard];
  let random = game.random;
  const hands: Record<PlayerId, CardType[]> = {};
  for (const player of game.players) {
    const hand = [...game.hands[player]];

    while (hand.length < handSize) {
      if (deck.length === 0) {
        const reshuffled = shuffle(discard, random);
        deck = reshuffled.items;
        random = reshuffled.state;
        discard = [];
      }

      const card = deck.shift();
      if (card === undefined) {
        // 44 cards and at most 21 in hands: the deck and discard pile can't both be empty.
        throw new Error('The deck and the discard pile are both empty');
      }
      hand.push(card);
    }

    hands[player] = hand;
  }

  return {
    ...seated,
    phase: 'contribute',
    sprint,
    random,
    board,
    hands,
    deck,
    discard,
    revealedDemands,
    audited: nextAudited,
    contributions: {},
  };
}
