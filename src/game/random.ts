/**
 * Seeded deterministic randomness (mulberry32). The state is a 32-bit unsigned integer stored in
 * the game, so every random step is reproducible from the game's seed and action log.
 */
export type RandomState = number;

export function nextRandom(state: RandomState): { value: number; state: RandomState } {
  const nextState = (state + 0x6d2b79f5) >>> 0;

  let mixed = nextState;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  const value = ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;

  return { value, state: nextState };
}

/** Fisher–Yates shuffle into a new array; the input is left untouched. */
export function shuffle<T>(
  items: readonly T[],
  state: RandomState,
): { items: T[]; state: RandomState } {
  const shuffled = [...items];
  let current = state;

  for (let index = shuffled.length - 1; index > 0; index--) {
    const random = nextRandom(current);
    current = random.state;

    const swapIndex = Math.floor(random.value * (index + 1));
    const item = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = item;
  }

  return { items: shuffled, state: current };
}
