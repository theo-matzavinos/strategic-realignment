import { Component, computed, input } from '@angular/core';
import { cn } from '../cn';

let nextId = 0;

/**
 * A playing card: light paper on the dark table, with a colored type band, its name, effect, an
 * italic flavor line and a footer tag. `tone` is the band color, such as `var(--feature)`.
 * `selected` lifts it. It holds no controls, so it can sit inside a label: point the control's
 * `aria-labelledby` at `nameId` to name it by the card's name alone, and its `aria-describedby` at
 * `rulesIds` so its effect and footer rule are announced with it.
 *
 * @example
 * ```html
 * <fold-card kind="Testing" name="Test Coverage" effect="+1 Progress" tone="var(--tests)" />
 * ```
 */
@Component({
  selector: 'fold-card',
  host: {
    'data-slot': 'card',
    '[attr.data-selected]': 'selected() || null',
    '[class]': 'classes()',
    '[style.--card-tone]': 'tone()',
  },
  template: `
    <div
      class="flex items-center justify-between gap-2 bg-(--card-tone) px-2.5 py-1.5 text-caption text-paper-ink"
    >
      <span>{{ kind() }}</span>
      @if (deck(); as deck) {
        <span class="max-desk:hidden">{{ deck }}</span>
      }
    </div>
    <div class="flex min-h-0 flex-col gap-1.5 px-3 py-2.5">
      <p
        [id]="nameId"
        class="text-[18px] leading-[1.1] font-extrabold tracking-[-0.01em] text-balance max-desk:text-[15px]"
      >
        {{ name() }}
      </p>
      <p
        [id]="effectId"
        class="text-[14px] leading-snug font-bold text-[color-mix(in_oklab,var(--card-tone)_55%,var(--paper-ink))]"
      >
        {{ effect() }}
      </p>
      @if (flavor(); as flavor) {
        <p class="mt-auto text-label font-normal text-paper-muted italic max-desk:hidden">
          “{{ flavor }}”
        </p>
      }
    </div>
    <p
      [id]="tagId"
      class="min-h-7 border-t border-paper-line px-3 py-1.5 text-caption text-paper-muted"
    >
      {{ tag() }}
    </p>
  `,
})
export class Card {
  readonly kind = input.required<string>();
  readonly name = input.required<string>();
  readonly effect = input.required<string>();
  readonly tone = input.required<string>();
  readonly flavor = input<string | null>(null);
  readonly tag = input<string | null>(null);
  /** A note on the band's right, such as the deck it comes from; hidden at phone width. */
  readonly deck = input<string | null>(null);
  readonly selected = input(false);
  readonly class = input('');

  readonly #id = nextId++;
  /** The id of the element holding the card's name. */
  readonly nameId = `fold-card-name-${this.#id}`;
  protected readonly effectId = `fold-card-effect-${this.#id}`;
  protected readonly tagId = `fold-card-tag-${this.#id}`;
  /** The ids of the elements holding the card's rule: its effect, then its footer tag if any. */
  readonly rulesIds = computed(() =>
    this.tag() === null ? this.effectId : `${this.effectId} ${this.tagId}`,
  );

  protected readonly classes = computed(() =>
    cn(
      'relative grid h-[214px] w-[176px] flex-none grid-rows-[auto_1fr_auto] overflow-hidden rounded-card bg-paper text-paper-ink shadow-card',
      'max-desk:h-[176px] max-desk:w-[138px]',
      'transition-[translate,box-shadow] duration-250 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none',
      'data-selected:-translate-y-3.5 data-selected:shadow-[0_0_0_3px_var(--brand),var(--shadow-card-lifted)] max-desk:data-selected:-translate-y-1.5',
      this.class(),
    ),
  );
}
