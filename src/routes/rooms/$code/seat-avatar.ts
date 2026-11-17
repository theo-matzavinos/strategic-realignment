import { Component, computed, input } from '@angular/core';

/** theme.css has one color per seat, --seat-0 to --seat-9. */
const seatCount = 10;

/** A player's initial in their seat's color. Decorative: their name is always beside it. */
@Component({
  selector: 'app-seat-avatar',
  host: {
    'aria-hidden': 'true',
    class:
      'grid size-8 flex-none place-items-center rounded-full text-[13px] font-extrabold text-paper-ink',
    '[style.background-color]': 'color()',
  },
  template: `{{ initial() }}`,
})
export class SeatAvatar {
  readonly name = input.required<string>();
  readonly seat = input.required<number>();

  protected readonly initial = computed(() => Array.from(this.name())[0]?.toUpperCase() ?? '');
  protected readonly color = computed(() => `var(--seat-${this.seat() % seatCount})`);
}
