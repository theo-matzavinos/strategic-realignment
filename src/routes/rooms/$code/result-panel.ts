import { Component, computed, input } from '@angular/core';
import type { PlayerView } from '../../../game/view';
import { roleNames } from './display-names';
import { panel } from './panel';

type Result = NonNullable<PlayerView['result']>;

/** The end of the game: who won, and every player's role. */
@Component({
  selector: 'app-result-panel',
  template: `
    <section aria-labelledby="result-heading" [class]="panel">
      <h2 id="result-heading" class="text-label text-muted-foreground">Result</h2>
      @if (result().winner === 'delivery') {
        <p class="text-display">The Delivery Team wins</p>
      } @else {
        <p class="text-display">The Management Plant wins</p>
      }
      <ul class="flex flex-col divide-y divide-border" aria-label="Roles">
        @for (player of room().players; track player.playerId) {
          <li class="flex flex-wrap items-baseline gap-x-2 py-2">
            <span class="font-semibold">{{ player.name }}</span>
            @if (player.playerId === room().me.playerId) {
              <span class="text-label text-success">(you)</span>
            }
            <span class="ms-auto">{{ roleNames[result().roles[player.playerId]] }}</span>
          </li>
        }
      </ul>
    </section>
  `,
})
export class ResultPanel {
  readonly room = input.required<PlayerView>();

  protected readonly panel = panel;
  protected readonly roleNames = roleNames;

  protected readonly result = computed((): Result => {
    const result = this.room().result;
    if (result === null) {
      throw new Error('The result panel needs a result');
    }

    return result;
  });
}
