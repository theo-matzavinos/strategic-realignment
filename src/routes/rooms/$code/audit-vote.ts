import { Component, computed, input } from '@angular/core';
import { Button } from '#ui/button';
import type { PlayerView } from '../../../game/view';
import { playerName, playerNames } from './display-names';
import { RoomRequest } from './room-request';
import { injectRpc } from './rpc.generated';

type Vote = NonNullable<PlayerView['vote']>;

/**
 * An audit vote: who has voted while it's open, your own vote, and how everyone voted once all
 * have. In the retro you vote here; after the game it shows the vote that ended it.
 */
@Component({
  selector: 'app-audit-vote',
  imports: [Button],
  template: `
    <section aria-labelledby="vote-heading" class="flex flex-col gap-2">
      <h3 id="vote-heading" class="text-title">Audit vote on {{ nominee() }}</h3>

      @if (vote().outcome; as outcome) {
        @if (outcome.passed) {
          <p class="text-headline">The audit passed.</p>
        } @else {
          <p class="text-headline">The audit failed.</p>
        }
        <p>Yes: {{ names(outcome.yes) }}</p>
        <p>No: {{ names(outcome.no) }}</p>
      } @else {
        <p>
          Voted so far ({{ vote().voted.length }} of {{ room().players.length }}):
          {{ names(vote().voted) }}
        </p>
        <p class="text-muted-foreground">How everyone voted shows once all have voted.</p>
      }

      @if (vote().mine === true) {
        <p>Your vote: Yes</p>
      } @else if (vote().mine === false) {
        <p>Your vote: No</p>
      } @else if (room().phase === 'retro') {
        <div class="flex flex-wrap items-center gap-2">
          <button
            foldButton
            variant="primary"
            [disabled]="request.pending()"
            focusableWhenDisabled
            (click)="cast(true)"
          >
            Vote yes
          </button>
          <button
            foldButton
            [disabled]="request.pending()"
            focusableWhenDisabled
            (click)="cast(false)"
          >
            Vote no
          </button>
        </div>
        <p class="text-muted-foreground">Votes are final.</p>
      }
      @if (request.error(); as message) {
        <p role="alert" class="text-destructive-text">{{ message }}</p>
      }
    </section>
  `,
})
export class AuditVote {
  readonly room = input.required<PlayerView>();

  readonly #rpc = injectRpc();
  protected readonly request = new RoomRequest(this.room);

  protected readonly vote = computed((): Vote => {
    const vote = this.room().vote;
    if (vote === null) {
      throw new Error('The audit vote needs a vote');
    }

    return vote;
  });
  protected readonly nominee = computed(() => playerName(this.room(), this.vote().nominee));

  protected names(playerIds: string[]): string {
    return playerNames(this.room(), playerIds);
  }

  protected cast(yes: boolean): void {
    void this.request.send(() => this.#rpc.room.vote({ code: this.room().code, yes }));
  }
}
