import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { LucideTriangleAlert } from '@lucide/angular';
import type { PlayerView } from '../../../game/view';
import { ContributeDay } from './contribute-day';
import { DemandDay } from './demand-day';
import { Moments, reflowTime } from './moments';
import { RetroDay } from './retro-day';
import { SprintReview } from './sprint-review';

type Day = 'demand' | 'contribute' | 'review' | 'retro';

const days: { id: Day; weekday: string; name: string }[] = [
  { id: 'demand', weekday: 'Mon', name: 'Demand' },
  { id: 'contribute', weekday: 'Tue–Wed', name: 'Contribute' },
  { id: 'review', weekday: 'Thu', name: 'Sprint Review' },
  { id: 'retro', weekday: 'Fri', name: 'Retro' },
];

/** The current day widens; the others make room. */
const columns: Record<Day, string> = {
  demand: '1.4fr 2fr 1fr 1fr',
  contribute: '1.1fr 2fr 1fr 0.9fr',
  review: '0.8fr 1fr 2fr 1.2fr',
  retro: '0.8fr 1fr 1.5fr 1.7fr',
};

/** A short shake, for an incident. */
const shake: Keyframe[] = [
  { transform: 'none' },
  { transform: 'translateX(-7px)' },
  { transform: 'translateX(6px)' },
  { transform: 'translateX(-4px)' },
  { transform: 'translateX(2px)' },
  { transform: 'none' },
];

const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

/**
 * Where the table is in the sprint: booking on Tue–Wed, the reveal on Thursday until a vote opens,
 * then the vote on Friday. After the game, the day that shows how it ended.
 */
function currentDay(room: PlayerView): Day {
  switch (room.phase) {
    case 'lobby':
    case 'contribute': {
      return 'contribute';
    }
    case 'retro':
    case 'ended': {
      if (room.vote === null) {
        return 'review';
      }

      return 'retro';
    }
  }
}

/**
 * The sprint as a week view: one lane per day, the current day underlined and widest. At phone
 * width it's a day view: tabs pick one lane, following the phase until you pick another day.
 */
@Component({
  selector: 'app-week',
  imports: [ContributeDay, DemandDay, LucideTriangleAlert, RetroDay, SprintReview],
  template: `
    <section aria-label="This sprint" class="flex h-full min-w-0 flex-col">
      <div
        role="group"
        aria-label="Days"
        class="grid grid-cols-4 gap-1 border-b border-line px-3 py-2 desk:hidden"
      >
        @for (day of days; track day.id) {
          <button
            type="button"
            class="cursor-pointer rounded-surface border border-line px-1 py-1 text-center leading-tight text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand aria-pressed:border-brand-fill aria-pressed:bg-brand-fill aria-pressed:text-brand-fg"
            [attr.aria-pressed]="selected() === day.id"
            [attr.aria-current]="today(day.id)"
            (click)="picked.set(day.id)"
          >
            <span class="block text-caption">{{ day.weekday }}</span
            >&ngsp;
            <span class="block text-label">{{ day.name }}</span>
          </button>
        }
      </div>

      <div
        #grid
        class="grid flex-1 desk:grid-cols-[52px_var(--week-columns)] desk:grid-rows-[auto_1fr_auto]"
        [style.--week-columns]="columns()"
      >
        <div aria-hidden="true" class="border-b border-line max-desk:hidden"></div>
        <!-- The hours are texture: they fill the lanes' height without setting it. -->
        <div
          aria-hidden="true"
          class="relative bg-[linear-gradient(var(--line-soft)_1px,transparent_1px)] bg-size-[100%_64px] max-desk:hidden desk:col-start-1 desk:row-start-2"
        >
          <div
            class="absolute inset-0 grid auto-rows-[64px] overflow-hidden pt-0.5 pl-2 text-caption font-medium text-fg-faint"
          >
            @for (hour of hours; track hour) {
              <span>{{ hour }}</span>
            }
          </div>
        </div>

        @for (day of days; track day.id; let index = $index) {
          <section
            #day
            class="grid min-w-0 max-desk:not-data-shown:hidden desk:col-start-(--day-column) desk:row-span-2 desk:row-start-1 desk:grid-rows-subgrid desk:border-l desk:border-line-soft"
            [attr.aria-labelledby]="'day-' + day.id"
            [attr.data-shown]="selected() === day.id || null"
            [style.--day-column]="index + 2"
          >
            <div
              class="group/day border-b border-line px-3 py-2 text-label text-fg-muted max-desk:hidden aria-[current=date]:shadow-[inset_0_-3px_0_var(--brand)]"
              [attr.aria-current]="today(day.id)"
            >
              {{ day.weekday }}
              <h2
                class="text-title text-fg group-aria-[current=date]/day:text-brand"
                [id]="'day-' + day.id"
              >
                {{ day.name }}
              </h2>
            </div>
            <div
              class="flex min-w-0 flex-col gap-1.5 p-1.5 max-desk:p-3 desk:bg-[linear-gradient(var(--line-soft)_1px,transparent_1px)] desk:bg-size-[100%_64px]"
            >
              @switch (day.id) {
                @case ('demand') {
                  <app-demand-day [room]="room()" />
                }
                @case ('contribute') {
                  <app-contribute-day [room]="room()" />
                }
                @case ('review') {
                  <app-sprint-review [room]="room()" />
                }
                @case ('retro') {
                  <app-retro-day [room]="room()" />
                }
              }
            </div>
          </section>
        }

        @if (room().board.debt > 0) {
          <p
            class="m-1.5 mb-2 flex items-start gap-2 rounded-control bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--leadership)_22%,transparent)_0_8px,color-mix(in_oklab,var(--leadership)_12%,transparent)_8px_16px)] px-2.5 py-1.5 text-label font-bold text-bad shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--leadership)_45%,transparent)] max-desk:mx-3 desk:col-start-2 desk:-col-end-1 desk:row-start-3"
            [style.min-height.px]="debtHeight()"
          >
            <svg lucideTriangleAlert class="size-4 shrink-0 mt-px"></svg>
            Tech debt ×{{ room().board.debt }} · double-booked across the sprint. At 3 it becomes an
            incident: −5 Progress.
          </p>
        }
      </div>
    </section>
  `,
  host: { class: 'block min-w-0' },
})
export class Week {
  readonly room = input.required<PlayerView>();

  protected readonly days = days;
  protected readonly hours = hours;

  protected readonly current = computed(() => currentDay(this.room()));
  /** The day you tapped at phone width; it lets go when the table moves to another day. */
  protected readonly picked = linkedSignal<Day, Day | null>({
    source: this.current,
    computation: () => null,
  });
  protected readonly selected = computed(() => this.picked() ?? this.current());
  readonly #moments = inject(Moments);
  readonly #injector = inject(Injector);
  private readonly grid = viewChild.required<ElementRef<HTMLElement>>('grid');
  private readonly dayLanes = viewChildren<ElementRef<HTMLElement>>('day');

  /**
   * A reveal keeps Tue–Wed's columns while its Reminder is open; the effect below lets go once it
   * has measured where the days were, so they can slide to Thursday's columns. A reveal that shows
   * settled, or that the table has moved past, holds nothing.
   */
  readonly #holdColumns = linkedSignal({
    source: this.#moments.reveal,
    computation: () => untracked(this.#moments.revealStage) === 'held',
  });
  protected readonly columns = computed(() => {
    if (this.#holdColumns() && this.#moments.revealStage() !== null) {
      return columns.contribute;
    }

    return columns[this.current()];
  });

  constructor() {
    // The reveal plays: the days slide to their new columns, then an incident shakes the week.
    effect(() => {
      if (this.#moments.revealStage() !== 'playing') {
        return;
      }

      untracked(() => {
        const reveal = this.#moments.reveal()!;
        const before = this.#dayBoxes();
        this.#holdColumns.set(false);
        afterNextRender(
          () => {
            this.#slideDays(before);
            if (this.room().lastReveal?.outcome.incident) {
              this.#moments.animate(this.grid().nativeElement, shake, {
                duration: 460,
                delay: reveal.notesAt + 200,
                easing: 'ease-out',
              });
            }
          },
          { injector: this.#injector },
        );
      });
    });

    // A new sprint: the calendar moves on to the next week, on the change that started it only.
    effect(() => {
      const started = this.#moments.arrived(
        (from, to) => from.phase === 'retro' && to.phase === 'contribute',
      );
      if (!started) {
        return;
      }

      untracked(() =>
        afterNextRender(
          () =>
            this.#moments.animate(
              this.grid().nativeElement,
              [
                { transform: 'translateX(56px)', opacity: 0.35 },
                { transform: 'none', opacity: 1 },
              ],
              { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
            ),
          { injector: this.#injector },
        ),
      );
    });
  }

  #dayBoxes(): DOMRect[] {
    const boxes: DOMRect[] = [];
    for (const lane of this.dayLanes()) {
      boxes.push(lane.nativeElement.getBoundingClientRect());
    }

    return boxes;
  }

  /** Each day slides from where it was, without resizing: only its position animates. */
  #slideDays(before: DOMRect[]): void {
    const lanes = this.dayLanes();
    for (let index = 0; index < lanes.length; index++) {
      const lane = lanes[index].nativeElement;
      const dx = before[index].left - lane.getBoundingClientRect().left;
      if (Math.abs(dx) < 1 || before[index].width === 0) {
        continue;
      }

      this.#moments.animate(lane, [{ transform: `translateX(${dx}px)` }, { transform: 'none' }], {
        duration: reflowTime,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      });
    }
  }

  /** The band grows with Debt, so it crowds the week as an incident nears. */
  protected readonly debtHeight = computed(() => 28 + this.room().board.debt * 16);

  protected today(day: Day): 'date' | null {
    if (day === this.current()) {
      return 'date';
    }

    return null;
  }
}
