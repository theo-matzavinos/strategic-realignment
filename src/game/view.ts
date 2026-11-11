import type { CardType } from './cards';
import type { DemandType } from './demands';
import { startingBoard, startingTarget, type Board, type PlayerId, type Role } from './game';
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
  const handSizes: Record<PlayerId, number> = {};
  for (const player of game.players) {
    handSizes[player] = 0;
  }

  if (game.phase === 'contribute') {
    sprint = game.sprint;
    board = { ...game.board };
    demand = game.demands[game.revealedDemands - 1];
    for (let index = 0; index < game.revealedDemands - 1; index++) {
      pastDemands.push(game.demands[index]);
    }
    role = game.roles[playerId];
    hand = [...game.hands[playerId]];
    for (const player of game.players) {
      handSizes[player] = game.hands[player].length;
    }
  }

  const players: PlayerView['players'] = [];
  for (const player of room.players) {
    players.push({
      playerId: player.playerId,
      name: player.name,
      isHost: player.isHost,
      handSize: handSizes[player.playerId],
      hasContributed: false,
      isAudited: false,
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
    me: { playerId, role, hand, contribution: null },
    players,
    lastReveal: null,
    vote: null,
    retroReady: [],
    result: null,
  };
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
