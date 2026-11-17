import { largeTablePlayers } from './game';

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

/** Shuffled in with 8–10 players. No Alignment Workshops. */
const largeTableCounts: [card: CardType, count: number][] = [
  ['feature', 6],
  ['workaround', 5],
  ['tests', 4],
  ['refactoring', 3],
  ['status', 2],
];

/**
 * The contribution deck for a player count in a fixed, unshuffled order: 44 cards, or 64 with 8–10
 * players. The large-table cards come after the base ones, so 5–7-player games deal as before.
 */
export function contributionDeck(playerCount: number): CardType[] {
  const deck: CardType[] = [];

  for (const [card, count] of deckCounts) {
    for (let copy = 0; copy < count; copy++) {
      deck.push(card);
    }
  }

  if (playerCount >= largeTablePlayers) {
    for (const [card, count] of largeTableCounts) {
      for (let copy = 0; copy < count; copy++) {
        deck.push(card);
      }
    }
  }

  return deck;
}
