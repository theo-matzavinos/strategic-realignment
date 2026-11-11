import { Component, computed, input } from '@angular/core';
import type { PlayerView } from '../../../game/view';
import { ContributeForm } from './contribute-form';
import { cardEffects, cardNames, playerNames } from './display-names';
import { panel, tile } from './panel';

/**
 * Your hand. While the team contributes it's where you place your card, and then shows the card you
 * placed and who the team is still waiting on.
 */
@Component({
  selector: 'app-hand-panel',
  imports: [ContributeForm],
  template: `
    <section aria-labelledby="hand-heading" [class]="panel">
      <h2 id="hand-heading" class="text-title">Your hand</h2>

      @if (room().phase === 'contribute') {
        @if (audited(); as audited) {
          @if (audited.playerId === room().me.playerId) {
            <p class="text-warning">
              You're audited this sprint: your card will be shown face up, attributed to you.
            </p>
          } @else {
            <p class="text-warning">
              {{ audited.name }} is audited this sprint: their card will be shown face up,
              attributed to them.
            </p>
          }
        }
      }

      @if (room().phase === 'contribute' && room().me.contribution === null) {
        <app-contribute-form [room]="room()" />
      } @else {
        <ul class="flex flex-wrap gap-2" aria-label="Cards in your hand">
          @for (card of room().me.hand; track $index) {
            <li [class]="tile">
              <span class="font-semibold">{{ cardNames[card] }}</span>
              <span class="block text-label text-muted-foreground">{{ cardEffects[card] }}</span>
            </li>
          }
        </ul>
      }

      @if (room().me.contribution; as card) {
        <p>
          Your card this sprint: <strong>{{ cardNames[card] }}</strong>
        </p>
        <p class="text-muted-foreground">Waiting on: {{ waitingOn() }}</p>
      }
    </section>
  `,
})
export class HandPanel {
  readonly room = input.required<PlayerView>();

  protected readonly panel = panel;
  protected readonly tile = tile;
  protected readonly cardNames = cardNames;
  protected readonly cardEffects = cardEffects;

  protected readonly audited = computed(() => {
    for (const player of this.room().players) {
      if (player.isAudited) {
        return player;
      }
    }

    return null;
  });

  protected readonly waitingOn = computed(() => {
    const room = this.room();
    const waiting: string[] = [];
    for (const player of room.players) {
      if (!player.hasContributed) {
        waiting.push(player.playerId);
      }
    }

    return playerNames(room, waiting);
  });
}
