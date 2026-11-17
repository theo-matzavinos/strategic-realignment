import { Component, computed, input, linkedSignal } from '@angular/core';
import { Button } from '#ui/button';
import { LucideCheck } from '@lucide/angular';
import type { PlayerView } from '../../../game/view';
import { AuditVote } from './audit-vote';
import { CalendarEvent, eventText } from './calendar-event';
import { playerName } from './display-names';
import { RoomRequest } from './room-request';
import { injectRpc } from './rpc.generated';

/**
 * Friday: the retro. Its one audit vote (a nomination, then the poll), who plays face up next
 * sprint, and your ready mark. After the game it shows the vote that ended it, if one did.
 */
@Component({
  selector: 'app-retro-day',
  imports: [AuditVote, Button, CalendarEvent, LucideCheck],
  template: `
    @switch (room().phase) {
      @case ('retro') {
        @if (room().vote !== null) {
          <app-audit-vote [room]="room()" />
        }

        <div appCalendarEvent="var(--workaround)" class="flex flex-col gap-1">
          <h3 class="text-title">Retro · now</h3>

          @if (room().vote === null) {
            @if (room().board.auditsLeft > 0) {
              <fieldset class="flex min-w-0 flex-col gap-2" [disabled]="nomination.pending()">
                <legend class="mb-2 text-label font-normal" [class]="eventText">
                  Nominate someone for an audit. If more than half vote yes, they book face up next
                  sprint. Costs 1 Morale. One vote per retro, and a nomination can't be withdrawn.
                </legend>
                <div class="flex flex-wrap gap-1.5">
                  @for (player of others(); track player.playerId) {
                    <label [class]="choice">
                      <input
                        type="radio"
                        name="nominee"
                        class="sr-only"
                        [checked]="nominee() === player.playerId"
                        (change)="nominee.set(player.playerId)"
                      />
                      {{ player.name }}
                    </label>
                  }
                </div>
              </fieldset>
              <!-- Wraps, since a 20-character name doesn't fit on one line in a narrow lane. -->
              <button
                foldButton
                class="mt-1 h-auto min-h-9 py-1.5 text-left whitespace-normal wrap-anywhere"
                [disabled]="nominee() === null || nomination.pending()"
                focusableWhenDisabled
                (click)="nominate()"
              >
                @if (nominee(); as nominee) {
                  Nominate {{ nomineeName(nominee) }} for an audit
                } @else {
                  Nominate for an audit
                }
              </button>
              @if (nomination.error(); as message) {
                <p role="alert" class="text-label text-bad">{{ message }}</p>
              }
            } @else {
              <p class="text-label font-normal" [class]="eventText">
                No audits left, so there's no vote this retro.
              </p>
            }
          }

          @if (nextAudited(); as audited) {
            <p class="text-label text-warn wrap-anywhere">
              {{ audited }} plays face up next sprint.
            </p>
          }

          <div class="mt-2 flex flex-col gap-1.5">
            @if (meReady()) {
              <p class="flex items-center gap-1.5 text-label text-ok">
                <svg lucideCheck class="size-4 shrink-0"></svg>
                You're ready.
              </p>
            } @else {
              <button
                foldButton
                variant="primary"
                [disabled]="voteOpen() || ready.pending()"
                focusableWhenDisabled
                (click)="markReady()"
              >
                <svg lucideCheck class="size-4 shrink-0"></svg>
                Ready for sprint {{ room().sprint + 1 }}
              </button>
              @if (voteOpen()) {
                <p class="text-label font-normal" [class]="eventText">
                  You can mark ready once the vote is in.
                </p>
              }
              @if (ready.error(); as message) {
                <p role="alert" class="text-label text-bad">{{ message }}</p>
              }
            }
          </div>
        </div>
      }
      @case ('ended') {
        @if (room().vote !== null) {
          <p class="px-1 text-label text-bad">The game ended on this audit: Morale reached 0.</p>
          <app-audit-vote [room]="room()" />
        } @else {
          <div appCalendarEvent="var(--workaround)" [dim]="true" class="min-h-37">
            <h3 class="text-title">Retro</h3>
            <p class="text-label font-normal" [class]="eventText">No retro: the game is over.</p>
          </div>
        }
      }
      @default {
        <div appCalendarEvent="var(--workaround)" [dim]="true" class="min-h-37">
          <h3 class="text-title">Retro</h3>
          <p class="text-label font-normal" [class]="eventText">One audit vote, if you want one.</p>
        </div>
      }
    }
  `,
  host: { class: 'contents' },
})
export class RetroDay {
  readonly room = input.required<PlayerView>();

  readonly #rpc = injectRpc();
  protected readonly eventText = eventText;
  protected readonly choice = [
    'relative cursor-pointer rounded-full border border-line bg-raised px-3 py-1 text-label wrap-anywhere',
    'hover:bg-raised-hover has-checked:border-brand has-checked:bg-brand-tint has-checked:text-fg',
    'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand',
    'has-disabled:cursor-not-allowed has-disabled:opacity-50',
  ].join(' ');
  protected readonly nomination = new RoomRequest(this.room);
  protected readonly ready = new RoomRequest(this.room);

  readonly #sprint = computed(() => this.room().sprint);
  /** Your pick, cleared when the next retro starts. A computed source keeps it across other views. */
  protected readonly nominee = linkedSignal<number, string | null>({
    source: this.#sprint,
    computation: () => null,
  });
  protected readonly others = computed(() => {
    const room = this.room();
    const others: PlayerView['players'] = [];
    for (const player of room.players) {
      if (player.playerId !== room.me.playerId) {
        others.push(player);
      }
    }

    return others;
  });

  protected readonly voteOpen = computed(() => {
    const vote = this.room().vote;

    return vote !== null && vote.outcome === null;
  });
  protected readonly meReady = computed(() => {
    const room = this.room();

    return room.retroReady.includes(room.me.playerId);
  });
  protected readonly nextAudited = computed(() => {
    for (const player of this.room().players) {
      if (player.isAudited) {
        return player.name;
      }
    }

    return null;
  });

  protected nomineeName(playerId: string): string {
    return playerName(this.room(), playerId);
  }

  protected nominate(): void {
    const nominee = this.nominee();
    if (nominee === null) {
      return;
    }

    void this.nomination.send(() => this.#rpc.room.nominate({ code: this.room().code, nominee }));
  }

  protected markReady(): void {
    if (this.voteOpen()) {
      return;
    }

    void this.ready.send(() => this.#rpc.room.finishRetro({ code: this.room().code }));
  }
}
