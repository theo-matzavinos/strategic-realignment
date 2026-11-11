import { Component, computed, input, signal } from '@angular/core';
import { Button } from '#ui/button';
import type { PlayerView } from '../../../game/view';
import { AuditVote } from './audit-vote';
import { playerName, playerNames } from './display-names';
import { choiceTile, panel } from './panel';
import { RoomRequest } from './room-request';
import { injectRpc } from './rpc.generated';

/** The retro: this retro's one audit vote, who plays face up next sprint, and ready marks. */
@Component({
  selector: 'app-retro-panel',
  imports: [AuditVote, Button],
  template: `
    <section aria-labelledby="retro-heading" [class]="panel">
      <h2 id="retro-heading" class="text-title">Retro</h2>

      @if (room().vote !== null) {
        <app-audit-vote [room]="room()" />
      } @else if (room().board.auditsLeft > 0) {
        <div class="flex flex-col gap-3">
          <fieldset class="flex flex-col gap-3" [disabled]="nomination.pending()">
            <legend class="mb-3 text-muted-foreground">
              Nominate another player for an audit: if more than half vote yes, they play face up
              next sprint. This retro has one vote, and a nomination can't be withdrawn.
            </legend>
            <div class="flex flex-wrap gap-2">
              @for (player of others(); track player.playerId) {
                <label [class]="choiceTile">
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
          <div class="flex flex-col items-start gap-2">
            <!-- Wraps, since a 20-character name doesn't fit on one line at phone width. -->
            <button
              foldButton
              class="h-auto min-h-8 py-1 text-left whitespace-normal"
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
              <p role="alert" class="text-destructive-text">{{ message }}</p>
            }
          </div>
        </div>
      } @else {
        <p class="text-muted-foreground">No audits left, so there's no vote this retro.</p>
      }

      @if (nextAudited(); as audited) {
        <p class="text-warning">{{ audited }} plays face up next sprint.</p>
      }

      <div class="flex flex-col items-start gap-2 border-t border-border pt-3">
        @if (meReady()) {
          <p>You're ready.</p>
        } @else {
          <button
            foldButton
            variant="primary"
            [disabled]="voteOpen() || ready.pending()"
            focusableWhenDisabled
            (click)="markReady()"
          >
            Ready for sprint {{ room().sprint + 1 }}
          </button>
          @if (voteOpen()) {
            <p class="text-muted-foreground">You can mark ready once everyone has voted.</p>
          }
        }
        @if (ready.error(); as message) {
          <p role="alert" class="text-destructive-text">{{ message }}</p>
        }
        <p class="text-muted-foreground">
          Ready: {{ readyNames() }}. Waiting on: {{ waitingOn() }}.
        </p>
      </div>
    </section>
  `,
})
export class RetroPanel {
  readonly room = input.required<PlayerView>();

  readonly #rpc = injectRpc();
  protected readonly panel = panel;
  protected readonly choiceTile = choiceTile;
  protected readonly nomination = new RoomRequest(this.room);
  protected readonly ready = new RoomRequest(this.room);

  protected readonly nominee = signal<string | null>(null);
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
  protected readonly readyNames = computed(() => playerNames(this.room(), this.room().retroReady));
  protected readonly waitingOn = computed(() => {
    const room = this.room();
    const waiting: string[] = [];
    for (const player of room.players) {
      if (!room.retroReady.includes(player.playerId)) {
        waiting.push(player.playerId);
      }
    }

    return playerNames(room, waiting);
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
