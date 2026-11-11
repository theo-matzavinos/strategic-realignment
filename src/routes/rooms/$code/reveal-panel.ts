import { Component, computed, input } from '@angular/core';
import type { DemandType } from '../../../game/demands';
import type { PlayerView } from '../../../game/view';
import { cardEffects, cardNames, demandNames, demandPenalties, playerName } from './display-names';
import { panel, tile } from './panel';

type Reveal = NonNullable<PlayerView['lastReveal']>;

/** The latest reveal: its cards with yours marked, the audited card, and what the sprint changed. */
@Component({
  selector: 'app-reveal-panel',
  template: `
    <section aria-labelledby="reveal-heading" [class]="panel">
      <h2 id="reveal-heading" class="text-title">Sprint {{ reveal().sprint }} reveal</h2>

      <ul class="flex flex-wrap gap-2" aria-label="Revealed cards">
        @for (card of reveal().cards; track $index) {
          <li [class]="tile">
            <span class="font-semibold">{{ cardNames[card] }}</span>
            @if ($index === reveal().mine) {
              <span class="ms-1 text-label text-success">(yours)</span>
            }
            <span class="block text-label text-muted-foreground">{{ cardEffects[card] }}</span>
          </li>
        }
      </ul>

      @if (reveal().audited; as audited) {
        <p>
          Audited, face up: <strong>{{ auditedName() }}</strong> played
          <strong>{{ cardNames[audited.card] }}</strong>
          ({{ cardEffects[audited.card] }}).
        </p>
      }

      @if (reveal().oneRemoved) {
        <p>
          One card was removed unseen.
          @if (removedWasMine()) {
            Your card was the one removed: none of the revealed cards is yours.
          }
        </p>
      }

      <dl class="grid gap-3 sm:grid-cols-3">
        <div>
          <dt class="text-label text-muted-foreground">Progress gained</dt>
          <dd class="text-headline">+{{ reveal().outcome.progress }}</dd>
        </div>
        <div>
          <dt class="text-label text-muted-foreground">{{ demandNames[demand()] }}</dt>
          <dd>{{ demandOutcome() }}</dd>
        </div>
        <div>
          <dt class="text-label text-muted-foreground">Incident</dt>
          <dd>
            @if (reveal().outcome.incident) {
              Yes: Debt reached 3, so −5 Progress and −3 Debt.
            } @else {
              None.
            }
          </dd>
        </div>
      </dl>
    </section>
  `,
})
export class RevealPanel {
  readonly room = input.required<PlayerView>();

  protected readonly panel = panel;
  protected readonly tile = tile;
  protected readonly cardNames = cardNames;
  protected readonly cardEffects = cardEffects;
  protected readonly demandNames = demandNames;

  protected readonly reveal = computed((): Reveal => {
    const reveal = this.room().lastReveal;
    if (reveal === null) {
      throw new Error('The reveal panel needs a reveal');
    }

    return reveal;
  });

  /** The demand of the reveal's sprint, which is an earlier one once the next sprint has started. */
  protected readonly demand = computed((): DemandType => {
    const room = this.room();
    const demands = [...room.pastDemands];
    if (room.demand !== null) {
      demands.push(room.demand);
    }

    return demands[this.reveal().sprint - 1];
  });

  protected readonly auditedName = computed(() => {
    const audited = this.reveal().audited;
    if (audited === null) {
      return null;
    }

    return playerName(this.room(), audited.playerId);
  });

  /** Under One Week a player whose card isn't among the revealed ones, and wasn't audited, lost it. */
  protected readonly removedWasMine = computed(() => {
    const reveal = this.reveal();
    const me = this.room().me.playerId;

    return reveal.oneRemoved && reveal.mine === null && reveal.audited?.playerId !== me;
  });

  protected readonly demandOutcome = computed(() => {
    const met = this.reveal().outcome.demandMet;
    if (met === null) {
      return 'No requirement.';
    }

    if (met) {
      return 'Met.';
    }

    return `Missed: ${demandPenalties[this.demand()]}.`;
  });
}
