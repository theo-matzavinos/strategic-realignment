import type { CardType } from '../../../game/cards';
import type { DemandType } from '../../../game/demands';
import type { PlayerId, Role } from '../../../game/game';
import type { PlayerView } from '../../../game/view';

/** What docs/rules.md calls each role, card and demand. */
export const roleNames: Record<Role, string> = {
  plant: 'Management Plant',
  delivery: 'Delivery Team',
};

export const cardNames: Record<CardType, string> = {
  feature: 'Feature Work',
  workaround: 'Temporary Workaround',
  tests: 'Test Coverage',
  refactoring: 'Refactoring',
  status: 'Status Update',
  workshop: 'Alignment Workshop',
};

/** What each card does, shortened from docs/rules.md's contribution deck. Display text only. */
export const cardEffects: Record<CardType, string> = {
  feature: '+2 Progress',
  workaround: '+3 Progress, +1 Debt',
  tests: '+1 Progress · Testing',
  refactoring: '−2 Debt · Refactoring',
  status: 'No effect · Visibility',
  workshop: 'Meets the demand · every other card −2 Progress',
};

export const demandNames: Record<DemandType, string> = {
  demoTomorrow: 'The Demo Moved to Tomorrow',
  visibilityReview: 'Quarterly Visibility Review',
  penTest: 'The Pen Test Results Are In',
  platformMigration: 'Platform Migration Mandate',
  ceoCompetitor: "The CEO Saw a Competitor's Feature",
  oneWeekSprint: 'The Sprint Is Now One Week',
};

/** Each demand's requirement and what missing it costs, in docs/rules.md's words. */
export const demandRequirements: Record<DemandType, string> = {
  demoTomorrow: 'Gain at least 5 Progress this sprint.',
  visibilityReview: '1 Visibility (Status Update).',
  penTest: '2 Testing (Test Coverage).',
  platformMigration: '1 Refactoring.',
  ceoCompetitor: 'None. Target +3 for the rest of the game.',
  oneWeekSprint: 'None. One contribution is removed at random, unseen, before the reveal.',
};

/** Null for the demands with no requirement. */
export const demandPenalties: Record<DemandType, string | null> = {
  demoTomorrow: '−1 Morale',
  visibilityReview: '−1 Morale',
  penTest: '+2 Debt',
  platformMigration: '+2 Debt',
  ceoCompetitor: null,
  oneWeekSprint: null,
};

/** A seated player's name. */
export function playerName(room: PlayerView, playerId: PlayerId): string {
  const player = room.players.find((candidate) => candidate.playerId === playerId);
  if (player === undefined) {
    throw new Error(`Player ${playerId} isn't in room ${room.code}`);
  }

  return player.name;
}

/** Players' names as a list in a sentence, or "nobody". */
export function playerNames(room: PlayerView, playerIds: PlayerId[]): string {
  if (playerIds.length === 0) {
    return 'nobody';
  }

  const names: string[] = [];
  for (const playerId of playerIds) {
    names.push(playerName(room, playerId));
  }

  return names.join(', ');
}
