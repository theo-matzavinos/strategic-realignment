import type { CardType } from '../../../game/cards';

/** Each card type's color token, for its band, event tint and reveal row. */
export const cardTones: Record<CardType, string> = {
  feature: 'var(--feature)',
  workaround: 'var(--workaround)',
  tests: 'var(--tests)',
  refactoring: 'var(--refactoring)',
  status: 'var(--status)',
  workshop: 'var(--workshop)',
};
