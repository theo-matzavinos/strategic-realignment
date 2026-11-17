import { Directive, computed, input } from '@angular/core';
import type { VariantProps } from 'tailwind-variants';
import { tv } from '../cn';

export const tagVariants = tv({
  base: [
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption whitespace-nowrap',
    '[&_svg]:size-3 [&_svg]:shrink-0',
  ],
  variants: {
    tone: {
      neutral: 'bg-neutral-bg text-fg-muted',
      ok: 'bg-ok-bg text-ok',
      warn: 'bg-warn-bg text-warn',
      bad: 'bg-bad-bg text-bad',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type TagTone = NonNullable<VariantProps<typeof tagVariants>['tone']>;

/**
 * A short status pill, such as an attendee's "Booked". The text carries the meaning; the tone only
 * echoes it.
 *
 * @example
 * ```html
 * <span foldTag tone="ok">Booked</span>
 * ```
 */
@Directive({
  selector: '[foldTag]',
  host: { 'data-slot': 'tag', '[class]': 'classes()' },
})
export class Tag {
  readonly tone = input<TagTone>('neutral');
  readonly class = input('');

  protected readonly classes = computed(() =>
    tagVariants({ tone: this.tone(), class: this.class() }),
  );
}
