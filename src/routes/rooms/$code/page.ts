import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonLink } from '#ui/button';
import { JoinRoomForm } from '../../+lobby/join-room-form';
import { RoomTable } from './room-table';
import { injectRoute } from './route.generated';
import { injectRpc } from './rpc.generated';
import { TopBar } from './top-bar';
import { WaitingRoom } from './waiting-room';

@Component({
  imports: [ButtonLink, JoinRoomForm, RoomTable, RouterLink, TopBar, WaitingRoom],
  template: `
    <div class="flex min-h-dvh flex-col">
      <app-top-bar
        [code]="code()"
        [sprint]="sprint()"
        [status]="statusText()"
        [live]="view.status() === 'open'"
        [canReconnect]="canReconnect()"
        (reconnect)="view.reconnect()"
      />

      @if (invalidCode()) {
        <main [class]="centered">
          <section aria-labelledby="invalid-heading" [class]="panel">
            <h2 id="invalid-heading" class="text-headline">This isn't a room code.</h2>
            <a foldButton size="lg" routerLink="/" class="self-start">Back to the lobby</a>
          </section>
        </main>
      } @else if (refused()) {
        <main [class]="centered">
          <section aria-labelledby="join-heading" [class]="panel">
            <div class="flex flex-col gap-1.5">
              <h2 id="join-heading" class="text-headline">Join this room</h2>
              <p class="text-fg-muted">You don't have a seat in this room yet.</p>
            </div>
            <app-join-room-form [code]="code()" (joined)="view.reconnect()" />
          </section>
        </main>
      } @else if (view.value(); as room) {
        @if (room.phase === 'lobby') {
          <main [class]="centered">
            <app-waiting-room [room]="room" />
          </main>
        } @else {
          <main class="flex flex-1 flex-col">
            <app-room-table [room]="room" />
          </main>
        }
      } @else {
        <main [class]="centered">
          <p class="text-fg-muted">Loading the room…</p>
        </main>
      }
    </div>
  `,
})
export default class RoomPage {
  readonly #route = injectRoute();
  readonly #rpc = injectRpc();

  /** The states outside the game sit in the middle of the page, under the top bar. */
  protected readonly centered =
    'grid flex-1 grid-cols-[minmax(0,1fr)] place-items-center px-4 pt-6 pb-10 md:py-12';
  /** The join form's panel, as on the lobby page. */
  protected readonly panel =
    'flex w-[430px] max-w-full flex-col gap-3.5 rounded-dialog border border-line bg-raised p-6.5 shadow-dialog max-md:p-5';

  protected readonly code = computed(() => this.#route.params().code.toUpperCase());
  protected readonly view = this.#rpc.room.view.connect({
    input: () => ({ code: this.code() }),
    initial: () => null,
  });

  /** `seated` refuses the stream when this browser has no seat here, or there's no such room. */
  /** The sprint indicator shows only once a game is on. */
  protected readonly sprint = computed(() => {
    const room = this.view.value();
    if (room === null || room.phase === 'lobby') {
      return null;
    }

    return room.sprint;
  });

  protected readonly refused = computed(() => this.#failedWith('FORBIDDEN'));
  protected readonly invalidCode = computed(() => this.#failedWith('INVALID_INPUT'));
  protected readonly canReconnect = computed(() => {
    const status = this.view.status();

    return (status === 'ended' || status === 'failed') && !this.refused() && !this.invalidCode();
  });
  protected readonly statusText = computed(() => {
    switch (this.view.status()) {
      case 'idle':
      case 'connecting': {
        return 'Connecting…';
      }
      case 'open': {
        return 'Live';
      }
      case 'ended': {
        return 'Disconnected';
      }
      case 'failed': {
        if (this.refused()) {
          return 'Not in this room';
        }
        if (this.invalidCode()) {
          return 'Not a room code';
        }

        return 'Connection lost';
      }
    }
  });

  #failedWith(code: 'FORBIDDEN' | 'INVALID_INPUT'): boolean {
    const error = this.view.error();

    return (
      this.view.status() === 'failed' && this.#rpc.room.view.isError(error) && error.code === code
    );
  }
}
