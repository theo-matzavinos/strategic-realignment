import { Component, computed, input } from '@angular/core';
import { LucideCheck } from '@lucide/angular';
import { Tag, type TagTone } from '#ui/tag';
import type { PlayerId } from '../../../game/game';
import type { PlayerView } from '../../../game/view';
import { roleNames } from './display-names';
import { SeatAvatar } from './seat-avatar';

type State = { text: string; tone: TagTone; check: boolean };

type Row = {
  playerId: PlayerId;
  seat: number;
  name: string;
  isMe: boolean;
  isHost: boolean;
  handSize: number;
  states: State[];
};

/**
 * Every seated player as a meeting attendee: name, host, cards in hand, and where they are in this
 * phase. Only what's public: whether someone booked or voted, never what.
 */
@Component({
  selector: 'app-attendees',
  imports: [LucideCheck, SeatAvatar, Tag],
  template: `
    <section
      aria-labelledby="attendees-heading"
      class="flex h-full flex-col gap-1.5 bg-raised px-4 py-3.5 max-desk:border-t max-desk:border-line max-desk:px-3 max-desk:py-2.5 desk:border-l desk:border-line"
    >
      <h2 id="attendees-heading" class="text-label font-bold text-fg-muted">
        Attendees · {{ room().players.length }}
      </h2>
      <ul class="flex flex-col max-desk:flex-row max-desk:flex-wrap max-desk:gap-1.5">
        @for (row of rows(); track row.playerId) {
          <li
            class="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-line-soft py-1.75 max-desk:flex max-desk:max-w-full max-desk:gap-1.5 max-desk:rounded-full max-desk:border-0 max-desk:bg-sunken max-desk:py-1 max-desk:pr-2 max-desk:pl-1"
          >
            <app-seat-avatar
              [name]="row.name"
              [seat]="row.seat"
              class="max-desk:size-6 max-desk:text-[11px]"
            />
            <div class="min-w-0">
              <p class="font-semibold wrap-anywhere">
                {{ row.name }}
                @if (row.isMe) {
                  <span class="text-label font-normal text-fg-muted">(you)</span>
                }
              </p>
              <p class="text-[12px] text-fg-muted max-desk:hidden">
                @if (row.isHost) {
                  host ·
                }
                {{ row.handSize }} cards
              </p>
            </div>
            <div class="flex flex-col items-end gap-1 max-desk:flex-row">
              @for (state of row.states; track state.text) {
                <span foldTag [tone]="state.tone">
                  @if (state.check) {
                    <svg lucideCheck class="size-4 shrink-0"></svg>
                  }
                  {{ state.text }}
                </span>
              }
            </div>
          </li>
        }
      </ul>
    </section>
  `,
  host: { class: 'block min-w-0' },
})
export class Attendees {
  readonly room = input.required<PlayerView>();

  protected readonly rows = computed(() => {
    const room = this.room();
    const rows: Row[] = [];
    for (let seat = 0; seat < room.players.length; seat++) {
      const player = room.players[seat];
      rows.push({
        playerId: player.playerId,
        seat,
        name: player.name,
        isMe: player.playerId === room.me.playerId,
        isHost: player.isHost,
        handSize: player.handSize,
        states: statesOf(room, player),
      });
    }

    return rows;
  });
}

function statesOf(room: PlayerView, player: PlayerView['players'][number]): State[] {
  const states: State[] = [];

  switch (room.phase) {
    case 'lobby': {
      break;
    }
    case 'contribute': {
      if (player.hasContributed) {
        states.push({ text: 'Booked', tone: 'ok', check: true });
      } else {
        states.push({ text: 'Not booked', tone: 'neutral', check: false });
      }
      break;
    }
    case 'retro': {
      const { vote } = room;
      const voteOpen = vote !== null && vote.outcome === null;
      if (voteOpen && vote.nominee === player.playerId) {
        states.push({ text: 'Nominee', tone: 'warn', check: false });
      }

      if (voteOpen && vote.voted.includes(player.playerId)) {
        states.push({ text: 'Voted', tone: 'ok', check: true });
      } else if (voteOpen) {
        states.push({ text: 'Voting…', tone: 'neutral', check: false });
      } else if (room.retroReady.includes(player.playerId)) {
        states.push({ text: 'Ready', tone: 'ok', check: true });
      } else {
        states.push({ text: 'Not ready', tone: 'neutral', check: false });
      }
      break;
    }
    case 'ended': {
      const role = room.result?.roles[player.playerId];
      if (role === 'plant') {
        states.push({ text: roleNames.plant, tone: 'bad', check: false });
      }
      if (role === 'delivery') {
        states.push({ text: roleNames.delivery, tone: 'neutral', check: false });
      }
      break;
    }
  }

  if (player.isAudited) {
    states.push({ text: 'Audited', tone: 'warn', check: false });
  }

  return states;
}
