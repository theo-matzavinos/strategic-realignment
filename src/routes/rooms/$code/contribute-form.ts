import { Component, computed, input, signal } from '@angular/core';
import { Button } from '#ui/button';
import type { PlayerView } from '../../../game/view';
import { cardEffects, cardNames } from './display-names';
import { choiceTile } from './panel';
import { RoomRequest } from './room-request';
import { injectRpc } from './rpc.generated';

/**
 * Picks one card from your hand and places it. Picking and placing are separate steps, since a
 * placed card is final.
 */
@Component({
  selector: 'app-contribute-form',
  imports: [Button],
  template: `
    <fieldset class="flex flex-col gap-3" [disabled]="request.pending()">
      <legend class="mb-3 text-muted-foreground">
        Choose one card to contribute. A placed card is final.
      </legend>
      <div class="flex flex-wrap gap-2">
        @for (card of room().me.hand; track $index) {
          <label [class]="choiceTile">
            <input
              type="radio"
              name="contribution"
              class="sr-only"
              [checked]="selected() === $index"
              (change)="selected.set($index)"
            />
            <span>{{ cardNames[card] }}</span>
            <span class="block text-label font-normal text-muted-foreground">{{
              cardEffects[card]
            }}</span>
          </label>
        }
      </div>
    </fieldset>

    <div class="flex flex-col items-start gap-2">
      <button
        foldButton
        variant="primary"
        [disabled]="selectedCard() === null || request.pending()"
        focusableWhenDisabled
        (click)="place()"
      >
        @if (selectedCard(); as card) {
          Place {{ cardNames[card] }}
        } @else {
          Place a card
        }
      </button>
      @if (request.error(); as message) {
        <p role="alert" class="text-destructive-text">{{ message }}</p>
      }
    </div>
  `,
  host: { class: 'flex flex-col gap-3' },
})
export class ContributeForm {
  readonly room = input.required<PlayerView>();

  readonly #rpc = injectRpc();
  protected readonly cardNames = cardNames;
  protected readonly cardEffects = cardEffects;
  protected readonly choiceTile = choiceTile;
  protected readonly request = new RoomRequest(this.room);

  /** An index into the hand, since a hand can hold the same card type more than once. */
  protected readonly selected = signal<number | null>(null);
  protected readonly selectedCard = computed(() => {
    const index = this.selected();
    if (index === null) {
      return null;
    }

    return this.room().me.hand[index] ?? null;
  });

  protected place(): void {
    const card = this.selectedCard();
    if (card === null) {
      return;
    }

    void this.request.send(() => this.#rpc.room.contribute({ code: this.room().code, card }));
  }
}
