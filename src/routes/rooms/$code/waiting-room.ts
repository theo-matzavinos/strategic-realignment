import { Component, computed, input } from '@angular/core';
import { LucideCalendar, LucideCheck, LucidePlus } from '@lucide/angular';
import { Button } from '#ui/button';
import { Tag } from '#ui/tag';
import { maxPlayers, minPlayers } from '../../../game/game';
import type { PlayerView } from '../../../game/view';
import { RoomRequest } from './room-request';
import { injectRpc } from './rpc.generated';
import { SeatAvatar } from './seat-avatar';

/**
 * The room before the game, as a meeting invite: who has accepted, how many more it needs, and the
 * host's "Start sprint 1".
 */
@Component({
  selector: 'app-waiting-room',
  imports: [Button, LucideCalendar, LucideCheck, LucidePlus, SeatAvatar, Tag],
  template: `
    <section
      aria-labelledby="invite-title"
      class="overflow-hidden rounded-dialog border border-line bg-raised shadow-dialog"
    >
      <p
        class="flex items-center gap-2 bg-brand-fill px-5 py-2.5 text-label font-extrabold text-brand-fg max-md:px-4"
      >
        <svg lucideCalendar class="size-4 shrink-0"></svg>
        Meeting invite · Sprint 1 kickoff
      </p>

      <div class="grid gap-1.5 px-6 pt-5 pb-3 max-md:px-4">
        <h2 id="invite-title" class="text-display text-balance max-md:text-[24px]">
          Release: Q3 Platform Excellence
        </h2>
        <div class="grid gap-0.5 text-pretty text-fg-muted">
          <p>
            Organizer <strong class="font-semibold text-fg">{{ organizer() }}</strong> · join with
            code <strong class="font-semibold tracking-[0.14em] text-fg">{{ room().code }}</strong>
          </p>
          <p>
            4 sprints · {{ minPlayers }}–{{ maxPlayers }} attendees · one or two of you work for
            management
          </p>
        </div>
      </div>

      <div class="border-t border-line px-6 pt-1.5 pb-2.5 max-md:px-4">
        <ul aria-label="Attendees">
          @for (player of room().players; track player.playerId; let seat = $index) {
            <li
              class="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-line-soft py-1.75"
            >
              <app-seat-avatar [name]="player.name" [seat]="seat" class="size-7.5" />
              <span class="font-semibold wrap-anywhere">
                {{ player.name }} {{ noteFor(player) }}
              </span>
              <span foldTag tone="ok">
                <svg lucideCheck></svg>
                Accepted
              </span>
            </li>
          }
        </ul>

        @if (missing() > 0) {
          <p
            class="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-2.5 border-b border-line-soft py-1.75 text-fg-muted"
          >
            <span
              aria-hidden="true"
              class="grid size-7.5 place-items-center rounded-full bg-neutral-bg"
            >
              <svg lucidePlus class="size-3.5 shrink-0"></svg>
            </span>
            Waiting for at least {{ missing() }} more. Share the code.
          </p>
        }
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-6 py-3.5 max-md:px-4">
        @if (isHost()) {
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            @if (missing() > 0) {
              <p id="start-reason" class="text-fg-muted">Needs {{ minPlayers }} to start.</p>
            }
            @if (start.error(); as message) {
              <p role="alert" class="text-bad">{{ message }}</p>
            }
          </div>
          <button
            foldButton
            variant="primary"
            size="lg"
            class="ms-auto"
            [disabled]="start.pending() || missing() > 0"
            focusableWhenDisabled
            [attr.aria-describedby]="startDescription()"
            (click)="startGame()"
          >
            Start sprint 1
          </button>
        } @else {
          <p class="text-fg-muted">Waiting for the host to start the game.</p>
        }
      </div>
    </section>
  `,
  host: { class: 'block w-[640px] max-w-full' },
})
export class WaitingRoom {
  readonly room = input.required<PlayerView>();

  readonly #rpc = injectRpc();
  protected readonly start = new RoomRequest(this.room);
  protected readonly minPlayers = minPlayers;
  protected readonly maxPlayers = maxPlayers;

  /** How many more players the game needs before the host can start it. */
  protected readonly missing = computed(() => Math.max(0, minPlayers - this.room().players.length));

  protected readonly isHost = computed(() => {
    const room = this.room();
    for (const player of room.players) {
      if (player.isHost) {
        return player.playerId === room.me.playerId;
      }
    }

    return false;
  });

  protected readonly organizer = computed(() => {
    const room = this.room();
    for (const player of room.players) {
      if (player.isHost && player.playerId === room.me.playerId) {
        return `${player.name} (you)`;
      }
      if (player.isHost) {
        return player.name;
      }
    }

    return '';
  });

  protected readonly startDescription = computed(() => {
    if (this.missing() > 0) {
      return 'start-reason';
    }

    return null;
  });

  /** "(you, host)", "(you)", "(host)" or nothing, after the attendee's name. */
  protected noteFor(player: PlayerView['players'][number]): string {
    const notes: string[] = [];
    if (player.playerId === this.room().me.playerId) {
      notes.push('you');
    }
    if (player.isHost) {
      notes.push('host');
    }
    if (notes.length === 0) {
      return '';
    }

    return `(${notes.join(', ')})`;
  }

  protected startGame(): void {
    if (this.missing() > 0) {
      return;
    }

    void this.start.send(() => this.#rpc.room.startGame({ code: this.room().code }));
  }
}
