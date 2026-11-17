import {
  afterNextRender,
  Component,
  computed,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { Button } from '#ui/button';
import { LucideBell } from '@lucide/angular';
import { Moments, reminderTime } from './moments';

/**
 * A Reminder pop-up for a moment: the reveal ("Now · Thursday · Sprint Review"), or a new sprint's
 * demand. It closes by itself after 2.5 s, on Dismiss, on a click or tap anywhere, or on Esc.
 *
 * It's non-modal on purpose: it never takes focus and never blocks input. The scrim and the card are
 * drawn but let presses through, and only Dismiss takes one, so a press meant for a control under
 * either both reaches that control and closes the Reminder. It's announced politely, as a calendar
 * notification would be. Under reduced motion it's a static banner under the top bar, without a scrim
 * or countdown, and one that showed as a banner stays one when motion comes back. A card that turns
 * into the banner, as reduced motion turns on, keeps the focus it held on its Dismiss.
 */
@Component({
  selector: 'app-reminder',
  imports: [Button, LucideBell],
  template: `
    @if (moments.reminder(); as reminder) {
      @if (moments.isStill(reminder.id)) {
        <div class="pointer-events-none fixed inset-x-0 top-14 z-40 flex justify-center px-4 pt-2">
          <div
            #card
            data-slot="reminder"
            class="flex w-[560px] max-w-full items-start gap-3 rounded-surface border border-line bg-raised px-4 py-3 shadow-dialog"
            (focusin)="rememberFocus($event)"
          >
            <svg lucideBell class="mt-0.5 size-4 shrink-0 text-brand"></svg>
            <div class="grid min-w-0 flex-1 gap-0.5">
              <p class="text-label text-fg-muted">
                Reminder · <span class="font-bold text-brand-text">{{ reminder.when }}</span>
              </p>
              <p class="text-title wrap-anywhere">{{ reminder.title }}</p>
              <p class="text-label font-normal text-pretty text-fg-muted">{{ reminder.text }}</p>
            </div>
            <button
              #dismiss
              foldButton
              variant="ghost"
              size="sm"
              class="pointer-events-auto"
              (click)="close()"
            >
              Dismiss
            </button>
          </div>
        </div>
      } @else {
        <div
          class="pointer-events-none fixed inset-0 z-40 grid grid-cols-[minmax(0,1fr)] place-items-center bg-scrim p-4 backdrop-blur-[3px] motion-safe:animate-scrim"
          animate.leave="motion-safe:animate-[scrim_160ms_ease-in_reverse_both]"
        >
          <div
            #card
            data-slot="reminder"
            class="w-[440px] max-w-full overflow-hidden rounded-dialog border border-line bg-raised shadow-dialog motion-safe:animate-reminder"
            animate.leave="motion-safe:animate-reminder-out"
            (focusin)="rememberFocus($event)"
          >
            <p class="flex items-center gap-2 bg-chrome px-4 py-2.5 text-label text-fg-muted">
              <svg lucideBell class="size-4 shrink-0"></svg>
              Reminder
            </p>
            <div class="grid gap-1.5 p-5 max-desk:p-4">
              <p class="font-bold text-brand-text">{{ reminder.when }}</p>
              <p
                class="text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-balance wrap-anywhere max-desk:text-[22px]"
              >
                {{ reminder.title }}
              </p>
              <p class="text-pretty text-fg-muted">{{ reminder.text }}</p>
            </div>
            <!-- Keyed by the Reminder, so a Reminder that replaces another restarts its countdown. -->
            @for (id of [reminder.id]; track id) {
              <div
                aria-hidden="true"
                class="h-0.75 origin-left bg-brand motion-safe:animate-countdown"
              ></div>
            }
            <div
              class="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-label font-normal text-fg-muted max-desk:px-4"
            >
              Closes by itself
              <button
                #dismiss
                foldButton
                variant="secondary"
                size="sm"
                class="pointer-events-auto"
                (click)="close()"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
  host: { class: 'block', 'aria-live': 'polite' },
})
export class Reminder {
  protected readonly moments = inject(Moments);
  readonly #document = inject(DOCUMENT);
  readonly #host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly card = viewChild<ElementRef<HTMLElement>>('card');
  private readonly dismiss = viewChild<string, ElementRef<HTMLElement>>('dismiss', {
    read: ElementRef,
  });
  /** Where focus was before it entered the Reminder, to put it back when the Reminder closes. */
  #returnFocus: HTMLElement | null = null;

  constructor() {
    // The card and the banner are different elements: when one turns into the other, focus inside
    // the one leaving would fall to the page. It moves to the new Dismiss instead. This runs before
    // the Reminder's view changes, so focus is still where it was.
    const injector = inject(Injector);
    const still = computed(() => {
      const reminder = this.moments.reminder();
      if (reminder === null) {
        return null;
      }

      return this.moments.isStill(reminder.id);
    });
    let was: boolean | null = null;
    effect(() => {
      const now = still();
      const turned = was !== null && now !== null && was !== now;
      was = now;
      if (turned && this.#host.contains(this.#document.activeElement)) {
        afterNextRender(() => this.dismiss()?.nativeElement.focus(), { injector });
      }
    });

    effect((onCleanup) => {
      const reminder = this.moments.reminder();
      if (reminder === null) {
        return;
      }

      const timer = setTimeout(() => this.close(), reminderTime);
      // Any press anywhere closes it, without stopping the press: it still reaches its control.
      const press = () => this.close();
      const key = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          this.close();
        }
      };
      this.#document.addEventListener('pointerdown', press, { capture: true });
      this.#document.addEventListener('keydown', key);
      onCleanup(() => {
        clearTimeout(timer);
        this.#document.removeEventListener('pointerdown', press, { capture: true });
        this.#document.removeEventListener('keydown', key);
      });
    });
  }

  protected rememberFocus(event: FocusEvent): void {
    // Focus moving from the card to the banner, or from one that has gone, isn't where it was.
    const from = event.relatedTarget;
    if (from instanceof HTMLElement && from.isConnected && !this.#host.contains(from)) {
      this.#returnFocus = from;
    }
  }

  protected close(): void {
    if (this.moments.reminder() === null) {
      return;
    }

    // Focus inside the Reminder would fall to the page when it goes: put it back where it was.
    const card = this.card()?.nativeElement;
    const focused = this.#document.activeElement;
    const returnTo = this.#returnFocus;
    this.#returnFocus = null;
    this.moments.reminder.set(null);
    if (card?.contains(focused) && returnTo?.isConnected) {
      returnTo.focus();
    }
  }
}
