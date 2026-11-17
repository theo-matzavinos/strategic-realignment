import { Component, input } from '@angular/core';
import { maxPlayers } from '../../../game/game';
import type { PlayerView } from '../../../game/view';
import { panel } from './panel';

/** Who has taken a seat while the room waits for the host to start. */
@Component({
  selector: 'app-players-panel',
  template: `
    <section aria-labelledby="players-heading" [class]="panel">
      <div class="flex items-baseline justify-between">
        <h2 id="players-heading" class="text-title">Players</h2>
        <span class="text-label text-fg-muted"> {{ room().players.length }}/{{ maxPlayers }} </span>
      </div>
      <ul class="flex flex-col divide-y divide-line">
        @for (player of room().players; track player.playerId) {
          <li class="flex flex-wrap items-baseline gap-x-2 py-2">
            <span class="font-semibold">{{ player.name }}</span>
            @if (player.isHost) {
              <span class="text-label text-fg-muted"> (host)</span>
            }
            @if (player.playerId === room().me.playerId) {
              <span class="text-label text-ok"> (you)</span>
            }
          </li>
        }
      </ul>
    </section>
  `,
})
export class PlayersPanel {
  readonly room = input.required<PlayerView>();

  protected readonly panel = panel;
  protected readonly maxPlayers = maxPlayers;
}
