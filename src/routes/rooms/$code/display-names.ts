import type { CardType } from '../../../game/cards';
import type { DemandType } from '../../../game/demands';
import type { Role } from '../../../game/game';

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

export const demandNames: Record<DemandType, string> = {
  demoTomorrow: 'The Demo Moved to Tomorrow',
  visibilityReview: 'Quarterly Visibility Review',
  penTest: 'The Pen Test Results Are In',
  platformMigration: 'Platform Migration Mandate',
  ceoCompetitor: "The CEO Saw a Competitor's Feature",
  oneWeekSprint: 'The Sprint Is Now One Week',
};
