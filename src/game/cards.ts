export const cardTypes = [
  'feature',
  'workaround',
  'tests',
  'refactoring',
  'status',
  'workshop',
] as const;

export type CardType = (typeof cardTypes)[number];

const deckCounts: [card: CardType, count: number][] = [
  ['feature', 11],
  ['workaround', 9],
  ['tests', 8],
  ['refactoring', 6],
  ['status', 4],
  ['workshop', 6],
];

/** The 44-card contribution deck in a fixed, unshuffled order. */
export function contributionDeck(): CardType[] {
  const deck: CardType[] = [];

  for (const [card, count] of deckCounts) {
    for (let copy = 0; copy < count; copy++) {
      deck.push(card);
    }
  }

  return deck;
}
