import { Component, computed, input, linkedSignal } from '@angular/core';
import type { PlayerView } from '../../../game/view';
import { Attendees } from './attendees';
import { EndInvite } from './end-invite';
import { HandTray } from './hand-tray';
import { provideMoments } from './moments';
import { Reminder } from './reminder';
import { Tracks } from './tracks';
import { Week } from './week';

/**
 * The game table: the board tracks, the sprint's week beside its attendees, and your hand tray along
 * the bottom, sticky at phone width. After the game, the result as an invite over it. Its parts share
 * one `Moments`, so the big events play as one sequence.
 */
@Component({
  selector: 'app-room-table',
  imports: [Attendees, EndInvite, HandTray, Reminder, Tracks, Week],
  providers: [provideMoments(RoomTable)],
  template: `
    <!-- First, so a keyboard reaches its Dismiss right after the top bar, never mid-action. -->
    <app-reminder />
    <app-tracks [room]="room()" (showResult)="inviteOpen.set(true)" />
    <div class="grid flex-1 desk:grid-cols-[minmax(0,1fr)_280px]">
      <app-week [room]="room()" />
      <app-attendees [room]="room()" />
    </div>
    <app-hand-tray [room]="room()" class="sticky bottom-0 z-10" />
    @if (ended()) {
      <app-end-invite [room]="room()" [(open)]="inviteOpen" />
    }
  `,
  host: { class: 'flex flex-1 flex-col' },
})
export class RoomTable {
  readonly room = input.required<PlayerView>();

  protected readonly ended = computed(() => this.room().phase === 'ended');
  /** The result opens by itself when the game ends; closing it leaves the final board. */
  protected readonly inviteOpen = linkedSignal(() => this.ended());
}
