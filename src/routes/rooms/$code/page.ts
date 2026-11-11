import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '#ui/button';
import { minPlayers } from '../../../game/game';
import type { PlayerView } from '../../../game/view';
import { JoinRoomForm } from '../../+lobby/join-room-form';
import { AuditVote } from './audit-vote';
import { BoardPanel } from './board-panel';
import { DemandPanel } from './demand-panel';
import { roleNames } from './display-names';
import { HandPanel } from './hand-panel';
import { panel } from './panel';
import { PlayersPanel } from './players-panel';
import { ResultPanel } from './result-panel';
import { RetroPanel } from './retro-panel';
import { RevealPanel } from './reveal-panel';
import { RoomRequest } from './room-request';
import { injectRoute } from './route.generated';
import { injectRpc } from './rpc.generated';

const phaseNames: Record<PlayerView['phase'], string> = {
  lobby: 'Lobby',
  contribute: 'Contribute',
  retro: 'Retro',
  ended: 'Game over',
};

@Component({
  imports: [
    AuditVote,
    BoardPanel,
    Button,
    DemandPanel,
    HandPanel,
    JoinRoomForm,
    PlayersPanel,
    ResultPanel,
    RetroPanel,
    RevealPanel,
    RouterLink,
  ],
  template: `
    <main class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 wrap-anywhere">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <p class="text-label text-muted-foreground">Room code</p>
          <h1 class="text-display tracking-[0.2em]">{{ code() }}</h1>
        </div>
        <div class="flex items-center gap-3">
          <p role="status" class="text-label" [class.text-success]="view.status() === 'open'">
            {{ statusText() }}
          </p>
          @if (canReconnect()) {
            <button foldButton size="sm" (click)="view.reconnect()">Reconnect</button>
          }
        </div>
      </header>

      @if (invalidCode()) {
        <p>This isn't a room code. <a routerLink="/" class="underline">Back to the lobby</a></p>
      } @else if (refused()) {
        <section aria-labelledby="join-heading" [class]="panel">
          <h2 id="join-heading" class="text-headline">Join this room</h2>
          <p class="text-muted-foreground">You don't have a seat in this room yet.</p>
          <app-join-room-form [code]="code()" (joined)="view.reconnect()" />
        </section>
      } @else if (view.value(); as room) {
        @if (room.phase !== 'lobby') {
          <p class="text-title">Sprint {{ room.sprint }} · {{ phaseNames[room.phase] }}</p>

          @if (room.phase === 'ended') {
            <app-result-panel [room]="room" />
            @if (room.vote !== null) {
              <div [class]="panel">
                <p class="text-muted-foreground">The game ended on this audit: Morale reached 0.</p>
                <app-audit-vote [room]="room" />
              </div>
            }
          }

          <div class="grid gap-4 sm:grid-cols-2">
            <section aria-labelledby="role-heading" [class]="panel">
              <h2 id="role-heading" class="text-label text-muted-foreground">Your role</h2>
              @if (room.me.role; as role) {
                <p class="text-headline">{{ roleNames[role] }}</p>
              }
            </section>

            <app-demand-panel [room]="room" />
          </div>

          <app-board-panel [board]="room.board" />

          @if (room.phase === 'contribute') {
            <app-hand-panel [room]="room" />
          }
          @if (room.lastReveal !== null) {
            <app-reveal-panel [room]="room" />
          }
          @if (room.phase === 'retro') {
            <app-retro-panel [room]="room" />
          }
          @if (room.phase !== 'contribute') {
            <app-hand-panel [room]="room" />
          }
        }

        <app-players-panel [room]="room" />

        @if (room.phase === 'lobby') {
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
                <p class="text-muted-foreground">
                  The game needs at least {{ minPlayers }} players. Share the code above.
                </p>
              }
              @if (start.error(); as message) {
                <p role="alert" class="text-destructive-text">{{ message }}</p>
              }
            </div>
          } @else {
            <p class="text-muted-foreground">Waiting for the host to start the game.</p>
          }
        }
      } @else {
        <p class="text-muted-foreground">Loading the room…</p>
      }
    </main>
  `,
})
export default class RoomPage {
  readonly #route = injectRoute();
  readonly #rpc = injectRpc();

  protected readonly panel = panel;
  protected readonly phaseNames = phaseNames;
  protected readonly roleNames = roleNames;
  protected readonly minPlayers = minPlayers;

  protected readonly code = computed(() => this.#route.params().code.toUpperCase());
  protected readonly view = this.#rpc.room.view.connect({
    input: () => ({ code: this.code() }),
    initial: () => null,
  });

  /** `seated` refuses the stream when this browser has no seat here, or there's no such room. */
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
