/** The look the room page's sections share. */
export const panel = 'flex flex-col gap-3 rounded-surface border border-border bg-surface p-5';

/** A card, shown as a tile. */
export const tile = 'rounded-control border border-border bg-muted px-3 py-2';

/** A radio shown as a tile, for picking one card or player: wrap the radio in a label with this. */
export const choiceTile = [
  'relative cursor-pointer rounded-control border border-input bg-muted px-3 py-2 shadow-edge',
  'hover:bg-muted-hover has-checked:border-ring has-checked:bg-muted-pressed has-checked:font-semibold',
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
  'has-disabled:cursor-not-allowed has-disabled:opacity-50',
].join(' ');
