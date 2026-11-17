import { Component, computed, input, output } from '@angular/core';
import { Button } from '#ui/button';
import type { PlayerView } from '../../../game/view';
import { playerName } from './display-names';

/** Morale starts at 4 and never rises (docs/rules.md, Components). */
const moralePips = [1, 2, 3, 4];

/** The board tracks, and a "Now" cell saying what the table is doing. */
@Component({
  selector: 'app-tracks',
  imports: [Button],
  template: `
    <!-- On a phone the Now cell shows only at the end, where it reopens the result. -->
    <section
      aria-label="Board"
      class="grid border-b border-line bg-sunken max-desk:grid-cols-4 desk:grid-cols-[1.7fr_1fr_1fr_1fr_280px]"
    >
      <dl class="contents">
        <div [class]="track">
          <dt [class]="trackName">Progress</dt>
          <dd class="flex flex-col gap-1.5">
            <span [class]="trackValue">
              {{ board().progress }}
              <small [class]="trackUnit">/ {{ board().target }} target</small>
            </span>
            <span aria-hidden="true" class="h-1.5 overflow-hidden rounded-full bg-line">
              <span
                class="block h-full rounded-full bg-tests transition-[width] duration-500 motion-reduce:transition-none"
                [style.width.%]="progressShare()"
              ></span>
            </span>
          </dd>
        </div>
        <div [class]="track">
          <dt [class]="trackName">Morale</dt>
          <dd class="flex flex-col gap-1.5">
            <span [class]="trackValue">{{ board().morale }}</span>
            <span aria-hidden="true" class="flex gap-1">
              @for (pip of moralePips; track pip) {
                <span
                  class="h-1.75 w-5 rounded-[2px] max-desk:w-3.5"
                  [class.bg-workaround]="pip <= board().morale"
                  [class.bg-line]="pip > board().morale"
                ></span>
              }
            </span>
          </dd>
        </div>
        <div [class]="track">
          <dt [class]="trackName">Debt</dt>
          <dd [class]="trackValue">
            {{ board().debt }} <small [class]="trackUnit">incident at 3</small>
          </dd>
        </div>
        <div [class]="track">
          <dt [class]="trackName">Audits left</dt>
          <dd [class]="trackValue">{{ board().auditsLeft }}</dd>
        </div>
      </dl>

      <div
        class="grid min-w-0 content-start gap-1 px-5 py-3 max-desk:col-span-4 max-desk:border-t max-desk:border-line-soft max-desk:px-3 max-desk:not-data-ended:hidden"
        [attr.data-ended]="room().phase === 'ended' || null"
      >
        <p [class]="trackName">{{ nowLabel() }}</p>
        <p class="text-title wrap-anywhere">{{ hint() }}</p>
        @if (room().phase === 'ended') {
          <button foldButton size="sm" class="mt-1 justify-self-start" (click)="showResult.emit()">
            Show result
          </button>
        }
      </div>
    </section>
  `,
})
export class Tracks {
  readonly room = input.required<PlayerView>();
  /** Asks to reopen the end-of-game invite. */
  readonly showResult = output();

  protected readonly moralePips = moralePips;
  protected readonly track =
    'grid content-start gap-1.5 border-r border-line-soft px-5 py-3 max-desk:px-3 max-desk:py-2.5';
  protected readonly trackName = 'text-label text-fg-muted max-desk:text-caption';
  protected readonly trackValue =
    'text-[26px] leading-none font-extrabold tracking-[-0.02em] max-desk:text-[20px]';
  protected readonly trackUnit =
    'text-[15px] font-semibold tracking-normal text-fg-muted max-desk:text-[12px]';

  protected readonly board = computed(() => this.room().board);
  protected readonly progressShare = computed(() => {
    const { progress, target } = this.board();

    return Math.min(100, (progress / target) * 100);
  });

  protected readonly nowLabel = computed(() => {
    if (this.room().phase === 'ended') {
      return 'Game over';
    }

    return 'Now';
  });

  protected readonly hint = computed(() => {
    const room = this.room();

    switch (room.phase) {
      case 'lobby': {
        return '';
      }
      case 'contribute': {
        if (room.me.contribution === null) {
          return 'Book one card into the sprint';
        }

        let waiting = 0;
        for (const player of room.players) {
          if (!player.hasContributed) {
            waiting++;
          }
        }

        return `Booked. Waiting on ${waiting} more`;
      }
      case 'retro': {
        const { vote } = room;
        if (vote !== null && vote.outcome === null) {
          return `Audit vote on ${playerName(room, vote.nominee)}`;
        }
        if (vote === null && room.board.auditsLeft > 0) {
          return 'Retro: discuss, maybe audit';
        }

        return `Retro: ready for sprint ${room.sprint + 1}?`;
      }
      case 'ended': {
        if (room.result?.winner === 'delivery') {
          return 'The Delivery Team wins';
        }

        return 'The Management Plant wins';
      }
    }
  });
}
