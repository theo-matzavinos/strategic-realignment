import { Component, input } from '@angular/core';
import { maxPlayers } from '../../../game/game';
import type { PlayerView } from '../../../game/view';
import { roleNames } from './display-names';
import { panel } from './panel';

/** Every seated player, with their hand size and where they are in this phase. */
@Component({
  selector: 'app-players-panel',
  template: `
    <section aria-labelledby="players-heading" [class]="panel">
      <div class="flex items-baseline justify-between">
        <h2 id="players-heading" class="text-title">Players</h2>
        @if (room().phase === 'lobby') {
          <span class="text-label text-muted-foreground">
            {{ room().players.length }}/{{ maxPlayers }}
          </span>
        }
      </div>
      <ul class="flex flex-col divide-y divide-border">
        @for (player of room().players; track player.playerId) {
          <li class="flex flex-wrap items-baseline gap-x-2 py-2">
            <span class="font-semibold">{{ player.name }}</span>
            @if (player.isHost) {
              <span class="text-label text-muted-foreground"> (host)</span>
            }
            @if (player.playerId === room().me.playerId) {
              <span class="text-label text-success"> (you)</span>
            }
            @switch (room().phase) {
              @case ('contribute') {
                <span class="ms-auto text-label text-muted-foreground">
                  {{ player.handSize }} cards · Contributed: {{ yesNo(player.hasContributed) }}
                  @if (player.isAudited) {
                    · <span class="text-warning">Audited</span>
                  }
                </span>
              }
              @case ('retro') {
                <span class="ms-auto text-label text-muted-foreground">
                  {{ player.handSize }} cards · Ready:
                  {{ yesNo(room().retroReady.includes(player.playerId)) }}
                  @if (player.isAudited) {
                    · <span class="text-warning">Face up next sprint</span>
                  }
                </span>
              }
              @case ('ended') {
                @if (room().result; as result) {
                  <span class="ms-auto text-label text-muted-foreground">
                    {{ player.handSize }} cards · {{ roleNames[result.roles[player.playerId]] }}
                  </span>
                }
              }
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
  protected readonly roleNames = roleNames;

  protected yesNo(value: boolean): string {
    if (value) {
      return 'yes';
    }

    return 'no';
  }
}
