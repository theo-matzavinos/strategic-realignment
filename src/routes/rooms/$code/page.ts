import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '#ui/button';
import { minPlayers } from '../../../game/game';
import type { PlayerView } from '../../../game/view';
import { JoinRoomForm } from '../../+lobby/join-room-form';
import { panel } from './panel';
import { PlayersPanel } from './players-panel';
import { RoomRequest } from './room-request';
import { RoomTable } from './room-table';
import { injectRoute } from './route.generated';
import { injectRpc } from './rpc.generated';
import { TopBar } from './top-bar';

@Component({
  imports: [Button, JoinRoomForm, PlayersPanel, RoomTable, RouterLink, TopBar],
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
        <main class="mx-auto w-full max-w-3xl px-4 py-10">
          <p>This isn't a room code. <a routerLink="/" class="underline">Back to the lobby</a></p>
        </main>
      } @else if (refused()) {
        <main class="mx-auto w-full max-w-3xl px-4 py-10">
          <section aria-labelledby="join-heading" [class]="panel">
            <h2 id="join-heading" class="text-headline">Join this room</h2>
            <p class="text-fg-muted">You don't have a seat in this room yet.</p>
            <app-join-room-form [code]="code()" (joined)="view.reconnect()" />
          </section>
        </main>
      } @else if (view.value(); as room) {
        @if (room.phase === 'lobby') {
          <main class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 wrap-anywhere">
            <app-players-panel [room]="room" />

            @if (isHost(room)) {
              <div class="flex flex-col items-start gap-2">
                <button
                  foldButton
                  variant="primary"
                  size="lg"
                  [disabled]="start.pending() || room.players.length < minPlayers"
                  focusableWhenDisabled
                  (click)="startGame()"
                >
                  Start the game
                </button>
                @if (room.players.length < minPlayers) {
                  <p class="text-fg-muted">
                    The game needs at least {{ minPlayers }} players. Share the code above.
                  </p>
                }
                @if (start.error(); as message) {
                  <p role="alert" class="text-bad">{{ message }}</p>
                }
              </div>
            } @else {
              <p class="text-fg-muted">Waiting for the host to start the game.</p>
            }
          </main>
        } @else {
          <main class="flex flex-1 flex-col">
            <app-room-table [room]="room" />
          </main>
        }
      } @else {
        <main class="mx-auto w-full max-w-3xl px-4 py-10">
          <p class="text-fg-muted">Loading the room…</p>
        </main>
      }
    </div>
  `,
})
export default class RoomPage {
  readonly #route = injectRoute();
  readonly #rpc = injectRpc();

  protected readonly panel = panel;
  protected readonly minPlayers = minPlayers;

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

        return 'Connection lost';
      }
    }
  });

  protected readonly start = new RoomRequest(this.view.value);

  protected isHost(room: PlayerView): boolean {
    for (const player of room.players) {
      if (player.isHost) {
        return player.playerId === room.me.playerId;
      }
    }

    return false;
  }

  protected startGame(): void {
    const room = this.view.value();
    if (room === null || room.players.length < minPlayers) {
      return;
    }

    void this.start.send(() => this.#rpc.room.startGame({ code: this.code() }));
  }

  #failedWith(code: 'FORBIDDEN' | 'INVALID_INPUT'): boolean {
    const error = this.view.error();

    return (
      this.view.status() === 'failed' && this.#rpc.room.view.isError(error) && error.code === code
    );
  }
}
