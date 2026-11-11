import { Component, input } from '@angular/core';
import type { PlayerView } from '../../../game/view';
import { panel } from './panel';

/** The board tracks. */
@Component({
  selector: 'app-board-panel',
  template: `
    <section aria-labelledby="board-heading" [class]="panel">
      <h2 id="board-heading" class="text-title">Board</h2>
      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt class="text-label text-muted-foreground">Progress</dt>
          <dd class="text-headline">{{ board().progress }} / {{ board().target }}</dd>
        </div>
        <div>
          <dt class="text-label text-muted-foreground">Morale</dt>
          <dd class="text-headline">{{ board().morale }}</dd>
        </div>
        <div>
          <dt class="text-label text-muted-foreground">Debt</dt>
          <dd class="text-headline">{{ board().debt }}</dd>
        </div>
        <div>
          <dt class="text-label text-muted-foreground">Audits left</dt>
          <dd class="text-headline">{{ board().auditsLeft }}</dd>
        </div>
      </dl>
    </section>
  `,
})
export class BoardPanel {
  readonly board = input.required<PlayerView['board']>();

  protected readonly panel = panel;
}
