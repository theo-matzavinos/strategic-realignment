import { Directive, computed, input } from '@angular/core';
import { OrigamiFieldControl } from '@loozo/origami-ui/field';
import { cn } from '../cn';

/** The text control look, shared with Textarea. */
export const inputClasses = [
  'w-full min-w-0 rounded-control border border-control-line bg-sunken px-3 text-[16px] font-semibold text-fg',
  'placeholder:font-normal placeholder:text-fg-faint',
  'transition-[border-color] duration-120 ease-out motion-reduce:transition-none',
  'hover:border-[color-mix(in_oklab,var(--control-line),var(--fg)_35%)] disabled:border-control-line',
  'focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
  'aria-invalid:border-bad',
  '[&[readonly]]:border-dashed [&[readonly]]:bg-transparent',
  'disabled:cursor-not-allowed disabled:opacity-50',
];

/**
 * A styled native text-like input, such as `text`, `email`, `password`, `search`, `number` or
 * `date`; checkbox, radio and file inputs don't fit its look. Inside a Field, Origami gives it an
 * id, `aria-describedby` and, while errors show, `aria-invalid`; outside one it keeps your own.
 *
 * @example
 * ```html
 * <input foldInput type="search" aria-label="Search" />
 * ```
 */
@Directive({
  selector: 'input[foldInput]',
  hostDirectives: [{ directive: OrigamiFieldControl, inputs: ['id'] }],
  host: { 'data-slot': 'input', '[class]': 'classes()' },
})
export class Input {
  readonly class = input('');

  protected readonly classes = computed(() => cn(inputClasses, 'h-10', this.class()));
}
