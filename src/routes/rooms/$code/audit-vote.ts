import { Component, computed, input } from '@angular/core';
import { Button } from '#ui/button';
import { LucideCheck, LucideClock } from '@lucide/angular';
import type { PlayerView } from '../../../game/view';
import { CalendarEvent, eventMeta, eventText } from './calendar-event';
import { playerName, playerNames } from './display-names';
import { RoomRequest } from './room-request';
import { injectRpc } from './rpc.generated';

type Vote = NonNullable<PlayerView['vote']>;

/**
 * An audit vote as a poll: who has voted so far while it's open, never how; your own vote; and how
 * everyone voted once all have. In the retro you vote here; after the game it shows the vote that
 * ended it.
 */
@Component({
  selector: 'app-audit-vote',
  imports: [Button, CalendarEvent, LucideCheck, LucideClock],
  template: `
    <section
      aria-labelledby="vote-heading"
      appCalendarEvent="var(--workaround)"
      class="flex flex-col gap-1"
    >
      <p [class]="eventMeta"><svg lucideClock class="size-4 shrink-0"></svg> Poll</p>
      <h3 id="vote-heading" class="text-[16px] leading-tight font-bold wrap-anywhere">
        Audit {{ nominee() }}?
      </h3>
      <p class="text-label font-normal" [class]="eventText">
        Yes needs more than half: {{ threshold() }} of {{ room().players.length }}.
      </p>

      @if (vote().outcome; as outcome) {
        @if (outcome.passed) {
          <p class="mt-1 text-title">The audit passed.</p>
        } @else {
          <p class="mt-1 text-title">The audit failed.</p>
        }
        <p class="text-label font-normal wrap-anywhere" [class]="eventText">
          Yes: {{ names(outcome.yes) }}
        </p>
        <p class="text-label font-normal wrap-anywhere" [class]="eventText">
          No: {{ names(outcome.no) }}
        </p>
      } @else if (vote().mine === null && room().phase === 'retro') {
        <div class="mt-1.5 grid grid-cols-2 gap-1.5">
          <button
            foldButton
            variant="positive"
            [disabled]="request.pending()"
            focusableWhenDisabled
            (click)="cast(true)"
          >
            <svg lucideCheck class="size-4 shrink-0"></svg>
            Yes
          </button>
          <button
            foldButton
            variant="negative"
            [disabled]="request.pending()"
            focusableWhenDisabled
            (click)="cast(false)"
          >
            No
          </button>
        </div>
        @if (request.error(); as message) {
          <p role="alert" class="text-label text-bad">{{ message }}</p>
        }
      }

      <p class="mt-1 text-label font-normal" [class]="eventText">
        @if (vote().mine === true) {
          You voted Yes.
        } @else if (vote().mine === false) {
          You voted No.
        } @else if (vote().outcome === null) {
          Votes are final.
        }
        @if (vote().outcome === null) {
          {{ vote().voted.length }} of {{ room().players.length }} have voted. Votes show once
          everyone is in.
        }
      </p>
    </section>
  `,
})
export class AuditVote {
  readonly room = input.required<PlayerView>();

  readonly #rpc = injectRpc();
  protected readonly request = new RoomRequest(this.room);
  protected readonly eventMeta = eventMeta;
  protected readonly eventText = eventText;

  protected readonly vote = computed((): Vote => {
    const vote = this.room().vote;
    if (vote === null) {
      throw new Error('The audit vote needs a vote');
    }

    return vote;
  });
  protected readonly nominee = computed(() => playerName(this.room(), this.vote().nominee));
  /** An audit passes if more than half of all players vote yes. */
  protected readonly threshold = computed(() => Math.floor(this.room().players.length / 2) + 1);

  protected names(playerIds: string[]): string {
    return playerNames(this.room(), playerIds);
  }

  protected cast(yes: boolean): void {
    void this.request.send(() => this.#rpc.room.vote({ code: this.room().code, yes }));
  }
}
