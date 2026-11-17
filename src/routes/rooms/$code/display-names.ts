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

/** What each card does to the tracks, shortened from docs/rules.md's contribution deck. */
export const cardEffects: Record<CardType, string> = {
  feature: '+2 Progress',
  workaround: '+3 Progress · +1 Debt',
  tests: '+1 Progress',
  refactoring: '−2 Debt',
  status: 'No effect',
  workshop: 'Meets the demand',
};

/** The rest of a card's rule, on its footer: what it counts as, or the Workshop's cost. */
export const cardTags: Record<CardType, string | null> = {
  feature: null,
  workaround: null,
  tests: 'Counts as Testing',
  refactoring: 'Counts as Refactoring',
  status: 'Counts as Visibility',
  workshop: 'Other cards −2 Progress',
};

/**
 * A card's whole rule on one line, for where its face doesn't show, such as the reveal: the effect,
 * then the rest of its footer. The Workshop's keeps its cost.
 */
export function cardRule(card: CardType): string {
  const tag = cardTags[card];
  if (tag === null) {
    return cardEffects[card];
  }

  return `${cardEffects[card]} · ${tag}`;
}

/** The label on each card's colored band. */
export const cardKinds: Record<CardType, string> = {
  feature: 'Feature',
  workaround: 'Workaround',
  tests: 'Testing',
  refactoring: 'Refactoring',
  status: 'Visibility',
  workshop: 'Workshop',
};

/** Approved flavor lines; display text only. */
export const cardFlavors: Record<CardType, string> = {
  feature: 'Ships what the roadmap promised. Mostly.',
  workaround: 'Nothing is more permanent.',
  tests: 'Green on my machine.',
  refactoring: 'No visible change. You’re welcome.',
  status: 'Per my last email.',
  workshop: 'Let’s take this offline. All of it.',
};

export const demandNames: Record<DemandType, string> = {
  demoTomorrow: 'The Demo Moved to Tomorrow',
  visibilityReview: 'Quarterly Visibility Review',
  penTest: 'The Pen Test Results Are In',
  platformMigration: 'Platform Migration Mandate',
  ceoCompetitor: "The CEO Saw a Competitor's Feature",
  oneWeekSprint: 'The Sprint Is Now One Week',
};

/** Each demand's flavor line, from docs/rules.md. */
export const demandFlavors: Record<DemandType, string> = {
  demoTomorrow: 'Nothing needs to be production-ready. It just needs to work in production.',
  visibilityReview: 'Leadership would love more visibility into the visibility.',
  penTest: 'Nobody panic. Legal is panicking for us.',
  platformMigration: 'The old platform is deprecated. So is the new one.',
  ceoCompetitor: 'It’s basically the same product.',
  oneWeekSprint: 'Same scope. We believe in you.',
};

/** Each demand's requirement and what missing it costs, in docs/rules.md's words. */
export const demandRequirements: Record<DemandType, string> = {
  demoTomorrow: 'Needs at least 5 Progress this sprint.',
  visibilityReview: 'Needs 1 Visibility (Status Update).',
  penTest: 'Needs 2 Testing (Test Coverage).',
  platformMigration: 'Needs 1 Refactoring.',
  ceoCompetitor: 'No requirement. Target +3 for the rest of the game.',
  oneWeekSprint:
    'No requirement. One contribution is removed at random, unseen, before the reveal.',
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

/**
 * Who won and the verb, without the article: "Delivery Team wins", or "Management Plant wins", plural
 * when two Plants won together (8–10 players).
 */
export function winnerPhrase(result: NonNullable<PlayerView['result']>): string {
  if (result.winner === 'delivery') {
    return `${roleNames.delivery} wins`;
  }

  let plants = 0;
  for (const role of Object.values(result.roles)) {
    if (role === 'plant') {
      plants++;
    }
  }
  if (plants > 1) {
    return `${roleNames.plant}s win`;
  }

  return `${roleNames.plant} wins`;
}
