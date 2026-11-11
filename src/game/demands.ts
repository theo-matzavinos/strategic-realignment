export type DemandType =
  | 'demoTomorrow'
  | 'visibilityReview'
  | 'penTest'
  | 'platformMigration'
  | 'ceoCompetitor'
  | 'oneWeekSprint';

/** The 6-card demand deck in a fixed, unshuffled order. */
export const demandDeck: readonly DemandType[] = [
  'demoTomorrow',
  'visibilityReview',
  'penTest',
  'platformMigration',
  'ceoCompetitor',
  'oneWeekSprint',
];

export const ceoTargetIncrease = 3;
