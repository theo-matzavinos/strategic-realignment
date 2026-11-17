import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, ButtonLink } from '#ui/button';
import { LucideCalendar, LucideTriangleAlert } from '@lucide/angular';
import { Tag } from '#ui/tag';
import type { PlayerView } from '../../../game/view';
import { roleNames, winnerPhrase } from './display-names';
import { Moments } from './moments';
import { SeatAvatar } from './seat-avatar';

type Result = NonNullable<PlayerView['result']>;

/**
 * The end of the game as a calendar invite over the blurred board: a mandatory all-hands when the
 * Management Plant wins (or both, at 8–10 players), an optional celebration when the Delivery Team
 * does. It lists every role.
 * "Back to the board" closes it; `open` reopens it.
 */
@Component({
  selector: 'app-end-invite',
  imports: [Button, ButtonLink, LucideCalendar, LucideTriangleAlert, RouterLink, SeatAvatar, Tag],
  template: `
    <!-- autofocus focuses the dialog itself on open, not the footer, so it opens scrolled to the top. -->
    <dialog
      #dialog
      autofocus
      aria-labelledby="end-title"
      class="m-auto max-h-[calc(100dvh-32px)] w-[620px] max-w-[calc(100vw-32px)] overflow-y-auto overscroll-contain rounded-dialog border border-line bg-raised p-0 text-fg shadow-dialog backdrop:bg-scrim backdrop:backdrop-blur-[3px]"
      (close)="open.set(false)"
    >
      @if (plantWins()) {
        <p
          class="flex items-center gap-2 bg-bad-fill px-5 py-2.5 text-label font-extrabold text-white"
        >
          <svg lucideTriangleAlert class="size-4 shrink-0"></svg>
          MANDATORY · All-hands · Attendance is required
        </p>
      } @else {
        <p
          class="flex items-center gap-2 bg-refactoring px-5 py-2.5 text-label font-extrabold text-paper-ink"
        >
          <svg lucideCalendar class="size-4 shrink-0"></svg>
          Release celebration (optional)
        </p>
      }

      <div class="grid gap-1.5 px-6 pt-5 pb-3 max-desk:px-4">
        <h2 id="end-title" class="text-display text-balance max-desk:text-[24px]">
          @if (plantWins()) {
            Strategic Realignment: an exciting new chapter
          } @else {
            Q3 Platform Excellence has shipped
          }
        </h2>
        <p class="text-pretty text-fg-muted">
          @if (plantWins()) {
            From <strong class="font-semibold text-fg">People &amp; Culture</strong> · Monday 09:00
            · Room: Everyone
          } @else {
            From <strong class="font-semibold text-fg">Leadership</strong> · Friday 16:30 · Room:
            The kitchen
          }
        </p>
        <p class="text-pretty text-fg-muted">
          Result: <strong class="font-semibold text-fg">{{ winnerLine() }}</strong>
          {{ scoreLine() }}
        </p>
      </div>

      <p class="max-w-[62ch] px-6 pb-3.5 text-fg max-desk:px-4">
        @if (plantWins()) {
          As part of our ongoing commitment to excellence, the delivery team will be realigned into
          a new structure that better reflects our strategic priorities. The slide deck was ready in
          sprint 1.
        } @else {
          The release shipped on time. Leadership would like to thank themselves for their vision.
          Pizza in the kitchen until it’s gone.
        }
      </p>

      <ul aria-label="Roles" class="grid border-t border-line px-6 pt-1.5 pb-2.5 max-desk:px-4">
        @for (player of room().players; track player.playerId; let seat = $index) {
          <li
            class="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-line-soft py-1.75"
          >
            <app-seat-avatar [name]="player.name" [seat]="seat" class="size-7.5" />
            <span class="font-semibold wrap-anywhere">
              {{ player.name }}
              @if (player.playerId === room().me.playerId) {
                (you)
              }
            </span>
            @if (result().roles[player.playerId] === 'plant') {
              <span foldTag tone="bad">{{ roleNames.plant }}</span>
            } @else {
              <span foldTag>{{ roleNames.delivery }}</span>
            }
          </li>
        }
      </ul>

      <div class="flex flex-wrap justify-end gap-2.5 px-6 py-3.5 max-desk:px-4">
        <button foldButton size="lg" (click)="close()">Back to the board</button>
        <a foldButton variant="primary" size="lg" routerLink="/">New room</a>
      </div>
    </dialog>
  `,
})
export class EndInvite {
  readonly room = input.required<PlayerView>();
  readonly open = model(true);

  protected readonly roleNames = roleNames;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly result = computed((): Result => {
    const result = this.room().result;
    if (result === null) {
      throw new Error('The end invite needs a result');
    }

    return result;
  });
  protected readonly plantWins = computed(() => this.result().winner === 'plant');
  protected readonly winnerLine = computed(() => `the ${winnerPhrase(this.result())}.`);
  protected readonly scoreLine = computed(() => {
    const { board, sprint } = this.room();
    if (board.morale === 0) {
      return `Morale reached 0 in sprint ${sprint}.`;
    }

    return `Progress ${board.progress} of ${board.target} after sprint ${sprint}.`;
  });

  readonly #moments = inject(Moments);
  /**
   * Whether the game ended in the view that just arrived, read once as the invite is created: then
   * it slides up the first time it opens. A page that loads into the end shows it settled.
   */
  #slideUp = this.#moments.arrived((from, to) => from.phase !== 'ended' && to.phase === 'ended');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) {
        dialog.showModal();
        if (this.#slideUp) {
          this.#moments.animate(
            dialog,
            [
              { transform: 'translateY(72px)', opacity: 0.25 },
              { transform: 'none', opacity: 1 },
            ],
            { duration: 560, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
          );
          this.#moments.animate(dialog, [{ opacity: 0 }, { opacity: 1 }], {
            duration: 320,
            easing: 'ease-out',
            pseudoElement: '::backdrop',
          });
        }
        this.#slideUp = false;
      }
      if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  protected close(): void {
    this.open.set(false);
  }
}
