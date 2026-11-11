import { Component, input } from '@angular/core';
import type { PlayerView } from '../../../game/view';
import { demandNames, demandPenalties, demandRequirements } from './display-names';
import { panel } from './panel';

/** This sprint's demand with its requirement and penalty, and the demands revealed before it. */
@Component({
  selector: 'app-demand-panel',
  template: `
    <section aria-labelledby="demand-heading" [class]="panel">
      <h2 id="demand-heading" class="text-label text-muted-foreground">This sprint's demand</h2>
      @if (room().demand; as demand) {
        <p class="text-headline">{{ demandNames[demand] }}</p>
        <p>
          <span class="text-muted-foreground">Requirement:</span> {{ demandRequirements[demand] }}
        </p>
        @if (demandPenalties[demand]; as penalty) {
          <p>
            <span class="text-muted-foreground">If missed:</span> {{ penalty }}. Any Alignment
            Workshop meets it.
          </p>
        }
      }
      @if (room().pastDemands.length > 0) {
        <div class="flex flex-col gap-1">
          <h3 class="text-label text-muted-foreground">Earlier demands</h3>
          <ol class="flex flex-col">
            @for (demand of room().pastDemands; track $index) {
              <li>Sprint {{ $index + 1 }}: {{ demandNames[demand] }}</li>
            }
          </ol>
        </div>
      }
    </section>
  `,
})
export class DemandPanel {
  readonly room = input.required<PlayerView>();

  protected readonly panel = panel;
  protected readonly demandNames = demandNames;
  protected readonly demandRequirements = demandRequirements;
  protected readonly demandPenalties = demandPenalties;
}
