import { Component, computed, inject, input } from '@angular/core';
import type { DemandType } from '../../../game/demands';
import type { PlayerView } from '../../../game/view';
import { CalendarEvent, eventText } from './calendar-event';
import { cardTones } from './card-tones';
import { cardNames, cardRule, demandNames, demandPenalties, playerName } from './display-names';
import { Moments, reflowTime, rowGap } from './moments';

type Reveal = NonNullable<PlayerView['lastReveal']>;

/**
 * Thursday: the latest reveal during the retro and after the game. One row per revealed card in
 * `lastReveal.cards` order exactly, the order the server shuffled, so a row's place says nothing
 * about who booked it. Yours is marked "You"; the audited card comes last, attributed; a card
 * removed unseen is one dashed row. Then the meeting notes: what the sprint changed.
 */
@Component({
  selector: 'app-sprint-review',
  imports: [CalendarEvent],
  template: `
    @if (shownReveal(); as reveal) {
      <!--
        Keyed by the reveal moment the rows entered with: when the table moves on from it, they're
        built again, settled.
      -->
      @for (moment of [entered()]; track moment) {
        <!-- While the reveal's Reminder is open, the rows wait face down: their turn is paused. -->
        <div
          appCalendarEvent="var(--feature)"
          class="group/review flex flex-col gap-1"
          [attr.data-held]="held() || null"
        >
          <h3 class="mb-1 text-title">Sprint Review</h3>
          <ol aria-label="Revealed cards" class="flex flex-col gap-1">
            <!-- Rows turn over in the payload's order only: the delay comes from the row's index. -->
            @for (card of reveal.cards; track $index) {
              <li
                [class]="row"
                [attr.data-mine]="$index === reveal.mine || null"
                [style.--row-tone]="cardTones[card]"
                [style.--turn-delay.ms]="turnDelay($index)"
                [animate.enter]="turn()"
              >
                <span class="min-w-0">{{ cardNames[card] }}</span
                >&ngsp;
                <span [class]="rowNote">
                  @if ($index === reveal.mine) {
                    You · {{ cardRule(card) }}
                  } @else {
                    {{ cardRule(card) }}
                  }
                </span>
              </li>
            }
            @if (reveal.audited; as audited) {
              <li
                [class]="row"
                [style.--row-tone]="cardTones[audited.card]"
                [style.--turn-delay.ms]="turnDelay(reveal.cards.length)"
                [animate.enter]="turn()"
              >
                <span class="min-w-0">{{ cardNames[audited.card] }}</span
                >&ngsp;
                <span [class]="rowNote"
                  >{{ auditedName() }} · audited · {{ cardRule(audited.card) }}</span
                >
              </li>
            }
            @if (reveal.oneRemoved) {
              <li
                class="rounded-control-sm border-[1.5px] border-dashed border-control-line px-2 py-1 text-label text-fg-faint group-data-held/review:[animation-play-state:paused]"
                [style.--turn-delay.ms]="turnDelay(removedRow(reveal))"
                [animate.enter]="turn()"
              >
                1 removed, unseen
              </li>
            }
          </ol>

          @if (removedWasMine()) {
            <p class="text-label font-normal" [class]="eventText">
              Your card was the one removed: none of the revealed cards is yours.
            </p>
          }

          <!-- The notes follow the last row; their Progress counts up, drawn by a CSS counter. -->
          <dl
            class="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-t border-fg/10 pt-1.5 text-label font-normal group-data-held/review:[animation-play-state:paused]"
            [style.--notes-at.ms]="notesAt()"
            [animate.enter]="notes()"
          >
            <dt>Progress</dt>
            <dd class="text-end font-bold">
              <span class="sr-only">+{{ reveal.outcome.progress }}</span>
              <span
                aria-hidden="true"
                class="[counter-reset:count_var(--count)] after:content-['+'_counter(count)] group-data-held/review:[animation-play-state:paused]"
                [style.--count]="reveal.outcome.progress"
                [animate.enter]="count()"
              ></span>
            </dd>
            <dt>{{ demandNames[demand()] }}</dt>
            <dd class="text-end font-bold" [class]="demandTone()">{{ demandOutcome() }}</dd>
            <dt [class.text-bad]="reveal.outcome.incident">Incident</dt>
            <dd class="text-end font-bold" [class.text-bad]="reveal.outcome.incident">
              @if (reveal.outcome.incident) {
                −5 Progress, −3 Debt
              } @else {
                None
              }
            </dd>
          </dl>
        </div>
      }
    } @else {
      <div appCalendarEvent="var(--feature)" [dim]="true" class="min-h-62">
        <h3 class="text-title">Sprint Review</h3>
        <p class="text-label font-normal" [class]="eventText">
          Cards turn over in shuffled order. Nobody sees who booked what.
        </p>
      </div>
    }
  `,
  host: { class: 'contents' },
})
export class SprintReview {
  readonly room = input.required<PlayerView>();

  protected readonly cardNames = cardNames;
  protected readonly cardRule = cardRule;
  protected readonly cardTones = cardTones;
  protected readonly demandNames = demandNames;
  protected readonly eventText = eventText;
  protected readonly row = [
    'flex flex-wrap items-baseline justify-between gap-x-1.5 rounded-control-sm px-2 py-1 text-label font-bold wrap-anywhere',
    'bg-[color-mix(in_oklab,var(--row-tone)_30%,var(--ground))] shadow-[inset_3px_0_0_var(--row-tone)]',
    'data-mine:ring-[1.5px] data-mine:ring-brand',
    'group-data-held/review:[animation-play-state:paused]',
  ].join(' ');
  protected readonly rowNote =
    'ms-auto min-w-0 text-end font-semibold text-[color-mix(in_oklab,var(--row-tone)_30%,var(--fg))]';

  readonly #moments = inject(Moments);
  protected readonly held = computed(() => this.#moments.revealStage() === 'held');
  protected readonly notesAt = computed(() => this.#moments.reveal()?.notesAt ?? 0);
  /**
   * The reveal moment the rows entered with, 0 for none. It's gone once the table moves on, as when
   * an audit ends the game while the rows still wait or turn over. Their entrance is read once, as
   * they enter, and would play on: the rows are built again, settled, instead.
   */
  protected readonly entered = computed(() => this.#moments.reveal()?.id ?? 0);

  /**
   * The reveal's own entrance, read once as the rows enter. A page that loads or reloads into the
   * retro shows them settled, and so does reduced motion.
   */
  readonly #arrived = computed(() =>
    this.#moments.arrived((from, to) => from.phase === 'contribute' && to.phase === 'retro'),
  );
  protected readonly turn = computed(() => this.#entrance('motion-safe:animate-turn'));
  protected readonly notes = computed(() => this.#entrance('motion-safe:animate-notes'));
  protected readonly count = computed(() => this.#entrance('motion-safe:animate-count'));

  /** The review shows from the reveal until the next sprint's booking starts. */
  protected readonly shownReveal = computed((): Reveal | null => {
    const room = this.room();
    if (room.phase === 'contribute') {
      return null;
    }

    return room.lastReveal;
  });

  /** The demand of the reveal's sprint. */
  protected readonly demand = computed((): DemandType => {
    const room = this.room();
    const demands = [...room.pastDemands];
    if (room.demand !== null) {
      demands.push(room.demand);
    }

    return demands[this.#reveal().sprint - 1];
  });

  /** A row's turn comes from its place in the payload, which the server shuffled, and nothing else. */
  protected turnDelay(index: number): number {
    return reflowTime + index * rowGap;
  }

  /** The removed card's row comes after the revealed cards and the audited one. */
  protected removedRow(reveal: Reveal): number {
    if (reveal.audited === null) {
      return reveal.cards.length;
    }

    return reveal.cards.length + 1;
  }

  #entrance(animation: string): string | null {
    if (this.#arrived()) {
      return animation;
    }

    return null;
  }

  protected readonly auditedName = computed(() => {
    const audited = this.#reveal().audited;
    if (audited === null) {
      return null;
    }

    return playerName(this.room(), audited.playerId);
  });

  /** Under One Week a player whose card isn't among the revealed ones, and wasn't audited, lost it. */
  protected readonly removedWasMine = computed(() => {
    const reveal = this.#reveal();
    const me = this.room().me.playerId;

    return reveal.oneRemoved && reveal.mine === null && reveal.audited?.playerId !== me;
  });

  protected readonly demandOutcome = computed(() => {
    const met = this.#reveal().outcome.demandMet;
    if (met === null) {
      return 'No requirement';
    }

    if (met) {
      return 'Met';
    }

    return `Missed: ${demandPenalties[this.demand()]}`;
  });

  protected readonly demandTone = computed(() => {
    const met = this.#reveal().outcome.demandMet;
    if (met === null) {
      return 'text-fg-muted';
    }

    if (met) {
      return 'text-ok';
    }

    return 'text-bad';
  });

  readonly #reveal = computed((): Reveal => {
    const reveal = this.shownReveal();
    if (reveal === null) {
      throw new Error('The sprint review needs a reveal');
    }

    return reveal;
  });
}
