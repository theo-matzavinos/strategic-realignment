import { Directive, computed, input } from '@angular/core';
import type { VariantProps } from 'tailwind-variants';
import { tv } from '../cn';

export const buttonVariants = tv({
  base: [
    'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap',
    'rounded-control border border-transparent text-body font-bold',
    'transition-[background-color,border-color,box-shadow,translate] duration-120 ease-out motion-reduce:transition-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
    'not-data-disabled:active:translate-y-px not-data-disabled:active:shadow-pressed',
    'data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:shadow-none',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ],
  variants: {
    variant: {
      primary:
        'bg-brand-fill text-brand-fg shadow-edge not-data-disabled:hover:bg-brand-hover not-data-disabled:active:bg-brand-pressed',
      secondary:
        'border-line bg-raised text-fg not-data-disabled:hover:bg-raised-hover not-data-disabled:active:bg-raised-pressed',
      positive:
        'border-ok-line bg-ok-bg text-ok not-data-disabled:hover:bg-[color-mix(in_oklab,var(--ok-bg),var(--ok)_12%)]',
      negative:
        'border-bad-line bg-bad-bg text-bad not-data-disabled:hover:bg-[color-mix(in_oklab,var(--bad-bg),var(--bad)_12%)]',
      ghost:
        'bg-transparent text-fg not-data-disabled:hover:bg-fg/8 not-data-disabled:active:bg-fg/14',
      link: 'bg-transparent text-fg underline decoration-1 underline-offset-3 not-data-disabled:hover:decoration-2 not-data-disabled:active:translate-y-0 not-data-disabled:active:shadow-none',
    },
    size: {
      sm: 'h-8 rounded-control-sm px-3 text-label',
      md: 'h-9 px-3.5',
      lg: 'h-11 px-4 text-title',
      icon: 'size-8 px-0',
    },
  },
  // Sizes come after variants, so the link's own height and padding have to win from here.
  compoundVariants: [{ variant: 'link', class: 'h-auto px-0.5' }],
  defaultVariants: { variant: 'secondary', size: 'md' },
});

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

/**
 * The button look: `variant`, `size` and your `class`, merged so your conflicting utilities win.
 * Selectorless; every fold button part composes it.
 */
@Directive({
  host: { '[class]': 'classes()' },
})
export class ButtonStyle {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly class = input('');

  protected readonly classes = computed(() =>
    buttonVariants({ variant: this.variant(), size: this.size(), class: this.class() }),
  );
}
