import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '#ui/button';
import { minPlayers, maxPlayers } from '../../../game/game';
import type { PlayerView } from '../../../game/view';
import { JoinRoomForm } from '../../+lobby/join-room-form';
import { cardNames, demandNames, roleNames } from './display-names';
import { injectRoute } from './route.generated';
import { injectRpc } from './rpc.generated';

const phaseNames: Record<PlayerView['phase'], string> = {
  lobby: 'Lobby',
  contribute: 'Contribute',
  retro: 'Retro',
  ended: 'Game over',
};

@Component({
  imports: [Button, JoinRoomForm, RouterLink],
  template: `
    <main class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
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

          <div class="grid gap-4 sm:grid-cols-2">
            <section aria-labelledby="role-heading" [class]="panel">
              <h2 id="role-heading" class="text-label text-muted-foreground">Your role</h2>
              @if (room.me.role; as role) {
                <p class="text-headline">{{ roleNames[role] }}</p>
              }
            </section>

            <section aria-labelledby="demand-heading" [class]="panel">
              <h2 id="demand-heading" class="text-label text-muted-foreground">
                This sprint's demand
              </h2>
              @if (room.demand; as demand) {
                <p class="text-headline">{{ demandNames[demand] }}</p>
              }
            </section>
          </div>

          <section aria-labelledby="hand-heading" [class]="panel">
            <h2 id="hand-heading" class="text-title">Your hand</h2>
            <ul class="flex flex-wrap gap-2">
              @for (card of room.me.hand; track $index) {
                <li class="rounded-control border border-border bg-muted px-3 py-2">
                  {{ cardNames[card] }}
                </li>
              }
            </ul>
          </section>

          <section aria-labelledby="board-heading" [class]="panel">
            <h2 id="board-heading" class="text-title">Board</h2>
            <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dt class="text-label text-muted-foreground">Progress</dt>
                <dd class="text-headline">{{ room.board.progress }} / {{ room.board.target }}</dd>
              </div>
              <div>
                <dt class="text-label text-muted-foreground">Morale</dt>
                <dd class="text-headline">{{ room.board.morale }}</dd>
              </div>
              <div>
                <dt class="text-label text-muted-foreground">Debt</dt>
                <dd class="text-headline">{{ room.board.debt }}</dd>
              </div>
              <div>
                <dt class="text-label text-muted-foreground">Audits left</dt>
                <dd class="text-headline">{{ room.board.auditsLeft }}</dd>
              </div>
            </dl>
          </section>
        }

        <section aria-labelledby="players-heading" [class]="panel">
          <div class="flex items-baseline justify-between">
            <h2 id="players-heading" class="text-title">Players</h2>
            @if (room.phase === 'lobby') {
              <span class="text-label text-muted-foreground">
                {{ room.players.length }}/{{ maxPlayers }}
              </span>
            }
          </div>
          <ul class="flex flex-col divide-y divide-border">
            @for (player of room.players; track player.playerId) {
              <li class="flex flex-wrap items-baseline gap-x-2 py-2">
                <span class="font-semibold">{{ player.name }}</span>
                @if (player.isHost) {
                  <span class="text-label text-muted-foreground"> (host)</span>
                }
                @if (player.playerId === room.me.playerId) {
                  <span class="text-label text-success"> (you)</span>
                }
                @if (room.phase !== 'lobby') {
                  <span class="ms-auto text-label text-muted-foreground">
                    {{ player.handSize }} cards · Contributed:
                    @if (player.hasContributed) {
                      yes
                    } @else {
                      no
                    }
                  </span>
                }
              </li>
            }
          </ul>
        </section>

        @if (room.phase === 'lobby') {
          @if (isHost(room)) {
            <div class="flex flex-col items-start gap-2">
              <button
                foldButton
                variant="primary"
                size="lg"
                [disabled]="starting() || room.players.length < minPlayers"
                focusableWhenDisabled
                (click)="start()"
              >
                Start the game
              </button>
              @if (room.players.length < minPlayers) {
                <p class="text-muted-foreground">
                  The game needs at least {{ minPlayers }} players. Share the code above.
                </p>
              }
              @if (startError(); as message) {
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

  protected readonly panel =
    'flex flex-col gap-3 rounded-surface border border-border bg-surface p-5';
  protected readonly phaseNames = phaseNames;
  protected readonly roleNames = roleNames;
  protected readonly cardNames = cardNames;
  protected readonly demandNames = demandNames;
  protected readonly minPlayers = minPlayers;
  protected readonly maxPlayers = maxPlayers;

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

  protected readonly starting = signal(false);
  protected readonly startError = signal<string | null>(null);

  protected isHost(room: PlayerView): boolean {
    for (const player of room.players) {
      if (player.isHost) {
        return player.playerId === room.me.playerId;
      }
    }

    return false;
  }

  protected async start(): Promise<void> {
    if (this.starting()) {
      return;
    }

    this.starting.set(true);
    this.startError.set(null);

    try {
      await this.#rpc.room.startGame({ code: this.code() });
    } catch (error) {
      if (this.#rpc.room.startGame.isError(error)) {
        this.startError.set(error.message);
      } else {
        this.startError.set("Couldn't reach the server. Try again.");
      }
    } finally {
      this.starting.set(false);
    }
  }

  #failedWith(code: 'FORBIDDEN' | 'INVALID_INPUT'): boolean {
    const error = this.view.error();

    return (
      this.view.status() === 'failed' && this.#rpc.room.view.isError(error) && error.code === code
    );
  }
}
