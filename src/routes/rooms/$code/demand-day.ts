import { Component, computed, input } from '@angular/core';
import { LucideTriangleAlert } from '@lucide/angular';
import type { PlayerView } from '../../../game/view';
import { CalendarEvent, eventMeta, eventText } from './calendar-event';
import { demandFlavors, demandNames, demandPenalties, demandRequirements } from './display-names';

/**
 * Monday: this sprint's demand as a required invite from Leadership, dimmed once the cards are
 * revealed, and the demands revealed before it.
 */
@Component({
  selector: 'app-demand-day',
  imports: [CalendarEvent, LucideTriangleAlert],
  template: `
    @if (room().demand; as demand) {
      <div
        appCalendarEvent="var(--leadership)"
        [dim]="revealed()"
        class="flex min-h-55 flex-col gap-1"
      >
        <p [class]="eventMeta">
          <svg lucideTriangleAlert class="size-4 shrink-0"></svg>
          Required · from Leadership
        </p>
        <h3 class="text-[16px] leading-tight font-bold text-balance">{{ demandNames[demand] }}</h3>
        <p class="mt-1 text-label font-normal text-pretty italic" [class]="eventText">
          “{{ demandFlavors[demand] }}”
        </p>
        <p class="mt-2 text-label font-normal" [class]="eventText">
          <strong class="font-bold text-fg">{{ demandRequirements[demand] }}</strong>
          @if (demandPenalties[demand]; as penalty) {
            If missed: {{ penalty }}. Any Alignment Workshop meets it.
          }
        </p>
      </div>
    }

    @if (room().pastDemands.length > 0) {
      <section aria-labelledby="earlier-demands" class="mt-1 flex flex-col gap-1 px-1 text-label">
        <h3 id="earlier-demands" class="text-fg-muted">Earlier demands</h3>
        <ol class="flex flex-col gap-0.5 font-normal text-fg-muted">
          @for (past of room().pastDemands; track $index) {
            <li>Sprint {{ $index + 1 }}: {{ demandNames[past] }}</li>
          }
        </ol>
      </section>
    }
  `,
  host: { class: 'contents' },
})
export class DemandDay {
  readonly room = input.required<PlayerView>();

  protected readonly eventMeta = eventMeta;
  protected readonly eventText = eventText;
  protected readonly demandNames = demandNames;
  protected readonly demandFlavors = demandFlavors;
  protected readonly demandRequirements = demandRequirements;
  protected readonly demandPenalties = demandPenalties;

  /** Once contributions are revealed the demand has been answered. */
  protected readonly revealed = computed(() => this.room().phase !== 'contribute');
}
