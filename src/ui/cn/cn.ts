import {
  cnMerge,
  createTV,
  type CnOptions,
  type CnReturn,
  type TWMergeConfig,
} from 'tailwind-variants';

/**
 * Teaches the class merger theme.css's text sizes, radii and shadows, which Tailwind's defaults
 * don't have: without them `text-title` counts as a text color and cancels `text-fg`.
 * Adding a `--text-*`, `--radius-*` or `--shadow-*` to theme.css means adding its name here.
 */
export const twMergeConfig: TWMergeConfig = {
  extend: {
    theme: {
      text: ['display', 'headline', 'title', 'body', 'label', 'caption'],
      radius: ['control-sm', 'control', 'surface', 'card', 'dialog'],
      shadow: ['edge', 'pressed', 'card', 'card-lifted', 'tray', 'dialog'],
    },
  },
};

/** tailwind-variants' `tv`, merging with theme.css's names. */
export const tv = createTV({ twMergeConfig });

/** Joins classes and merges conflicting utilities, the last one winning, with theme.css's names. */
export function cn(...classes: CnOptions): CnReturn {
  return cnMerge(...classes)({ twMergeConfig });
}
