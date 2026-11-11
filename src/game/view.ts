import type { CardType } from './cards';
import type { DemandType } from './demands';
import {
  currentDemand,
  startingBoard,
  startingTarget,
  type AuditVote,
  type Board,
  type PlayerId,
  type Role,
  type StoredReveal,
} from './game';
import type { Room } from './room';

export type PlayerView = {
  code: string;
  version: number;
  phase: 'lobby' | 'contribute' | 'retro' | 'ended';
  sprint: 1 | 2 | 3 | 4;
  board: { progress: number; target: number; morale: number; debt: number; auditsLeft: number };
  demand: DemandType | null;
  pastDemands: DemandType[];
  me: {
    playerId: PlayerId;
    role: 'plant' | 'delivery' | null; // null in the lobby
    hand: CardType[];
    contribution: CardType | null; // this sprint, until the reveal
  };
  players: {
    playerId: PlayerId;
    name: string;
    isHost: boolean;
    handSize: number;
    hasContributed: boolean;
    isAudited: boolean;
  }[];
  lastReveal: {
    sprint: number;
    cards: CardType[]; // shuffled server-side, unattributed
    mine: number | null; // index of my card in `cards`
    audited: { playerId: PlayerId; card: CardType } | null;
    oneRemoved: boolean; // true under The Sprint Is Now One Week; the card itself is never sent
    outcome: {
      progress: number; // Progress the revealed cards added, after Workshop reductions
      demandMet: boolean | null; // null when the demand has no requirement
      incident: boolean;
    };
  } | null;
  vote: {
    nominee: PlayerId;
    voted: PlayerId[]; // who has voted so far, not how
    mine: boolean | null;
    outcome: { passed: boolean; yes: PlayerId[]; no: PlayerId[] } | null; // once everyone has voted
  } | null;
  retroReady: PlayerId[];
  result: { winner: 'delivery' | 'plant'; roles: Record<PlayerId, 'plant' | 'delivery'> } | null;
};

/**
 * Builds one player's view of a room, holding only what the rules let that player see
 * (docs/rules.md, Who sees what). Every field is copied explicitly; nothing is spread from the room
 * or the game, so hidden or server-only state can't leak by accident.
 */
export function viewFor(room: Room, playerId: PlayerId): PlayerView {
  const { game } = room;

  if (!game.players.includes(playerId)) {
    throw new Error(`Player ${playerId} isn't seated in room ${room.code}`);
  }

  assertSameRoster(room);

  let sprint: PlayerView['sprint'] = 1;
  let board: Board = { ...startingBoard, target: startingTarget(game.players.length) };
  let demand: DemandType | null = null;
  const pastDemands: DemandType[] = [];
  let role: Role | null = null;
  let hand: CardType[] = [];
  let contribution: CardType | null = null;
  const handSizes: Record<PlayerId, number> = {};
  const contributed = new Set<PlayerId>();
  let audited: PlayerId | null = null;
  let lastReveal: PlayerView['lastReveal'] = null;
  let vote: PlayerView['vote'] = null;
  const retroReady: PlayerId[] = [];
  let result: PlayerView['result'] = null;
  for (const player of game.players) {
    handSizes[player] = 0;
  }

  if (game.phase !== 'lobby') {
    sprint = game.sprint;
    board = { ...game.board };
    demand = currentDemand(game);
    for (let index = 0; index < game.revealedDemands - 1; index++) {
      pastDemands.push(game.demands[index]);
    }
    role = game.roles[playerId];
    hand = [...game.hands[playerId]];
    for (const player of game.players) {
      handSizes[player] = game.hands[player].length;
    }
    if (game.lastReveal !== null) {
      lastReveal = revealFor(game.lastReveal, playerId);
    }
  }

  if (game.phase === 'contribute') {
    for (const player of game.players) {
      if (Object.hasOwn(game.contributions, player)) {
        contributed.add(player);
      }
    }
    if (Object.hasOwn(game.contributions, playerId)) {
      contribution = game.contributions[playerId];
    }
    audited = game.audited;
  }

  if (game.phase === 'retro') {
    audited = game.nextAudited;
    if (game.vote !== null) {
      // A vote that passed without ending the game always names next sprint's audited player.
      vote = voteFor(game.players, game.vote, playerId, game.nextAudited !== null);
    }
    for (const player of game.players) {
      if (game.ready.includes(player)) {
        retroReady.push(player);
      }
    }
  }

  if (game.phase === 'ended') {
    const roles: Record<PlayerId, Role> = {};
    for (const player of game.players) {
      roles[player] = game.roles[player];
    }
    result = { winner: game.winner, roles };
    if (game.vote !== null) {
      // Only a passed audit ends the game with its vote kept.
      vote = voteFor(game.players, game.vote, playerId, true);
    }
  }

  const players: PlayerView['players'] = [];
  for (const player of room.players) {
    players.push({
      playerId: player.playerId,
      name: player.name,
      isHost: player.isHost,
      handSize: handSizes[player.playerId],
      hasContributed: contributed.has(player.playerId),
      isAudited: player.playerId === audited,
    });
  }

  return {
    code: room.code,
    version: room.version,
    phase: game.phase,
    sprint,
    board,
    demand,
    pastDemands,
    me: { playerId, role, hand, contribution },
    players,
    lastReveal,
    vote,
    retroReady,
    result,
  };
}

/** The public reveal, plus which card was this player's. The owners and the removed card stay out. */
function revealFor(
  stored: StoredReveal,
  playerId: PlayerId,
): NonNullable<PlayerView['lastReveal']> {
  const cards: CardType[] = [];
  let mine: number | null = null;
  for (let index = 0; index < stored.cards.length; index++) {
    const revealed = stored.cards[index];
    cards.push(revealed.card);
    if (revealed.playerId === playerId) {
      mine = index;
    }
  }

  let audited: NonNullable<PlayerView['lastReveal']>['audited'] = null;
  if (stored.audited !== null) {
    audited = { playerId: stored.audited.playerId, card: stored.audited.card };
  }

  return {
    sprint: stored.sprint,
    cards,
    mine,
    audited,
    oneRemoved: stored.removed !== null,
    outcome: {
      progress: stored.outcome.progress,
      demandMet: stored.outcome.demandMet,
      incident: stored.outcome.incident,
    },
  };
}

/** Who has voted, your own vote, and everyone's only once all votes are in. */
function voteFor(
  players: PlayerId[],
  held: AuditVote,
  playerId: PlayerId,
  passed: boolean,
): NonNullable<PlayerView['vote']> {
  const voted: PlayerId[] = [];
  const yes: PlayerId[] = [];
  const no: PlayerId[] = [];
  for (const player of players) {
    if (!Object.hasOwn(held.votes, player)) {
      continue;
    }

    voted.push(player);
    if (held.votes[player]) {
      yes.push(player);
    } else {
      no.push(player);
    }
  }

  let mine: boolean | null = null;
  if (Object.hasOwn(held.votes, playerId)) {
    mine = held.votes[playerId];
  }

  let outcome: NonNullable<PlayerView['vote']>['outcome'] = null;
  const everyoneVoted = voted.length === players.length;
  if (everyoneVoted) {
    outcome = { passed, yes, no };
  }

  return { nominee: held.nominee, voted, mine, outcome };
}

/** The room's roster and the game's must be the same players, in the same order, with the same host. */
function assertSameRoster(room: Room): void {
  const { game } = room;
  const matches =
    room.players.length === game.players.length &&
    room.players.every(
      (player, seat) =>
        player.playerId === game.players[seat] && player.isHost === (player.playerId === game.host),
    );

  if (!matches) {
    throw new Error(`Room ${room.code}'s players don't match its game's players`);
  }
}
