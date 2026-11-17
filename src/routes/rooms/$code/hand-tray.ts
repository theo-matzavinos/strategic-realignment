import { Component, computed, input, linkedSignal } from '@angular/core';
import { Button } from '#ui/button';
import { Card } from '#ui/card';
import { LucideCalendar, LucideLock } from '@lucide/angular';
import type { PlayerView } from '../../../game/view';
import { cardTones } from './card-tones';
import {
  cardEffects,
  cardFlavors,
  cardKinds,
  cardNames,
  cardTags,
  playerNames,
  roleNames,
} from './display-names';
import { RoomRequest } from './room-request';
import { injectRpc } from './rpc.generated';

/**
 * The hand tray along the bottom: your role in a private box, styled the same for both roles; your
 * hand as cards; and the phase's action. While the team contributes you pick a card and book it,
 * as two steps, since a booked card is final. Otherwise the hand is display-only.
 */
@Component({
  selector: 'app-hand-tray',
  imports: [Button, Card, LucideCalendar, LucideLock],
  template: `
    <div
      class="grid border-t border-line bg-sunken max-desk:shadow-tray desk:grid-cols-[220px_minmax(0,1fr)_280px]"
    >
      <section
        aria-labelledby="role-heading"
        class="flex flex-col gap-2 px-4.5 py-3.5 max-desk:px-3 max-desk:pt-2.5 max-desk:pb-0 desk:border-r desk:border-line-soft"
      >
        <h2 id="role-heading" class="text-label font-bold text-fg-muted max-desk:sr-only">
          Your role
        </h2>
        <div
          class="grid gap-1 rounded-surface border border-dashed border-line p-3 max-desk:flex max-desk:items-center max-desk:gap-2 max-desk:self-start max-desk:rounded-full max-desk:px-2.5 max-desk:py-1.5"
        >
          <p class="flex items-center gap-1.5 text-[12px] text-fg-muted">
            <svg lucideLock class="shrink-0 size-3.5"></svg>
            Only you can see this
          </p>
          @if (room().me.role; as role) {
            <p class="text-[17px] font-bold max-desk:text-[14px]">{{ roleNames[role] }}</p>
          }
        </div>
      </section>

      <section
        aria-labelledby="hand-heading"
        class="grid min-w-0 desk:col-span-2 desk:grid-cols-[minmax(0,1fr)_280px]"
      >
        <div class="min-w-0 px-4.5 pt-3.5 max-desk:px-3 max-desk:pt-2.5">
          <h2 id="hand-heading" class="text-label font-bold text-fg-muted">
            Your hand · {{ room().me.hand.length }} cards
            @if (room().phase === 'retro') {
              · you draw back to 3 next sprint
            }
          </h2>

          @if (bookable()) {
            <div role="radiogroup" aria-labelledby="hand-heading" [class]="hand">
              @for (card of room().me.hand; track $index) {
                <label
                  class="group/choice flex-none cursor-pointer rounded-card has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-brand has-disabled:cursor-not-allowed"
                >
                  <input
                    type="radio"
                    name="contribution"
                    class="sr-only"
                    [checked]="selected() === $index"
                    [disabled]="request.pending()"
                    [attr.aria-labelledby]="face.nameId"
                    [attr.aria-describedby]="face.rulesIds()"
                    (change)="selected.set($index)"
                  />
                  <fold-card
                    #face
                    deck="Contribution"
                    class="not-data-selected:group-hover/choice:-translate-y-1"
                    [kind]="cardKinds[card]"
                    [name]="cardNames[card]"
                    [effect]="cardEffects[card]"
                    [flavor]="cardFlavors[card]"
                    [tag]="cardTags[card]"
                    [tone]="cardTones[card]"
                    [selected]="selected() === $index"
                  />
                </label>
              }
            </div>
          } @else {
            <ul [class]="hand">
              @for (card of room().me.hand; track $index) {
                <li class="flex-none">
                  <fold-card
                    deck="Contribution"
                    [kind]="cardKinds[card]"
                    [name]="cardNames[card]"
                    [effect]="cardEffects[card]"
                    [flavor]="cardFlavors[card]"
                    [tag]="cardTags[card]"
                    [tone]="cardTones[card]"
                  />
                </li>
              }
            </ul>
          }
        </div>

        <div
          class="flex flex-col justify-center gap-2.5 px-4.5 py-3.5 text-label font-normal text-fg-muted max-desk:px-3 max-desk:pt-0 max-desk:pb-3 desk:border-l desk:border-line-soft"
        >
          @switch (room().phase) {
            @case ('contribute') {
              @if (room().me.contribution; as card) {
                <p class="wrap-anywhere">
                  You booked <strong class="font-bold text-fg">{{ cardNames[card] }}</strong
                  >. Waiting on: {{ waitingOn() }}.
                </p>
              } @else {
                @if (meAudited()) {
                  <p class="text-warn">
                    You're audited this sprint: your card turns over face up, attributed to you.
                  </p>
                }
                <p class="text-pretty max-desk:hidden">
                  A booked card is final. The others see only “Busy”.
                </p>
                <button
                  foldButton
                  variant="primary"
                  size="lg"
                  class="h-auto min-h-11 py-2 whitespace-normal max-desk:w-full"
                  [disabled]="selectedCard() === null || request.pending()"
                  focusableWhenDisabled
                  (click)="book()"
                >
                  <svg lucideCalendar class="size-4 shrink-0"></svg>
                  @if (selectedCard(); as card) {
                    Book {{ cardNames[card] }}
                  } @else {
                    Book a card
                  }
                </button>
                @if (request.error(); as message) {
                  <p role="alert" class="font-semibold text-bad">{{ message }}</p>
                }
              }
            }
            @case ('retro') {
              <p class="max-desk:hidden">{{ retroHint() }}</p>
            }
          }
        </div>
      </section>
    </div>
  `,
  host: { class: 'block' },
})
export class HandTray {
  readonly room = input.required<PlayerView>();

  readonly #rpc = injectRpc();
  protected readonly request = new RoomRequest(this.room);
  protected readonly roleNames = roleNames;
  protected readonly cardNames = cardNames;
  protected readonly cardEffects = cardEffects;
  protected readonly cardFlavors = cardFlavors;
  protected readonly cardKinds = cardKinds;
  protected readonly cardTags = cardTags;
  protected readonly cardTones = cardTones;
  /** Room above the cards for the selected one to lift into, which a scroller would clip. */
  protected readonly hand =
    'flex items-end gap-3.5 overflow-x-auto px-1 pt-4.5 pb-3.5 max-desk:gap-2.5 max-desk:pb-1';

  protected readonly bookable = computed(() => {
    const room = this.room();

    return room.phase === 'contribute' && room.me.contribution === null;
  });

  /**
   * An index into the hand, since a hand can hold the same card type more than once. It clears
   * when your hand changes, as booking or a new sprint's draw does.
   */
  readonly #handKey = computed(() => `${this.room().sprint}:${this.room().me.hand.join(',')}`);
  /**
   * The source is a computed so that a new view with the same hand keeps the pick: `linkedSignal`
   * reruns its computation whenever its source function's dependencies change, equal or not.
   */
  protected readonly selected = linkedSignal<string, number | null>({
    source: this.#handKey,
    computation: () => null,
  });
  protected readonly selectedCard = computed(() => {
    const index = this.selected();
    if (index === null) {
      return null;
    }

    return this.room().me.hand[index] ?? null;
  });

  protected readonly meAudited = computed(() => {
    const room = this.room();
    for (const player of room.players) {
      if (player.playerId === room.me.playerId) {
        return player.isAudited;
      }
    }

    return false;
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

  protected readonly retroHint = computed(() => {
    const room = this.room();
    const vote = room.vote;
    if (vote !== null && vote.outcome === null) {
      return 'You can mark ready once the vote is in.';
    }

    return `Sprint ${room.sprint + 1} starts when everyone is ready.`;
  });

  protected book(): void {
    const card = this.selectedCard();
    if (card === null) {
      return;
    }

    void this.request.send(() => this.#rpc.room.contribute({ code: this.room().code, card }));
  }
}
