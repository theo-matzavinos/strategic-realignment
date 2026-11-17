import { type AnimationCallbackEvent, Component, computed, inject, input } from '@angular/core';
import { cn } from '#ui/cn';
import { LucideCalendar, LucideLock } from '@lucide/angular';
import type { PlayerId } from '../../../game/game';
import type { PlayerView } from '../../../game/view';
import { CalendarEvent, eventMeta } from './calendar-event';
import { cardTones } from './card-tones';
import { cardEffects, cardNames } from './display-names';
import { Moments } from './moments';

type Slot =
  | { kind: 'mine'; playerId: PlayerId; audited: boolean }
  | { kind: 'busy'; playerId: PlayerId }
  | { kind: 'audited'; playerId: PlayerId; name: string; booked: boolean }
  | { kind: 'open'; playerId: PlayerId };

/**
 * Tuesday to Wednesday: one slot per player, in seat order. A booked slot is "Busy · private";
 * yours shows your card once you book. After the reveal every slot was busy.
 */
@Component({
  selector: 'app-contribute-day',
  imports: [CalendarEvent, LucideCalendar, LucideLock],
  template: `
    @if (room().phase === 'contribute') {
      <ul aria-label="Slots" class="grid grid-cols-2 content-start gap-1.5">
        @for (slot of slots(); track slot.playerId) {
          @switch (slot.kind) {
            @case ('mine') {
              @if (room().me.contribution; as card) {
                <li
                  [appCalendarEvent]="cardTones[card]"
                  class="min-h-13 ring-2 ring-brand"
                  (animate.enter)="arrive($event)"
                >
                  <p [class]="eventMeta">
                    <svg lucideCalendar class="size-4 shrink-0"></svg>
                    Your slot
                    @if (slot.audited) {
                      · audited, face up
                    }
                  </p>
                  <p class="text-label font-bold">{{ cardNames[card] }}</p>
                  <p class="text-label font-normal text-fg-muted">{{ cardEffects[card] }}</p>
                </li>
              } @else {
                <li [class]="myOpenSlot">
                  <svg lucideCalendar class="size-4 shrink-0"></svg>
                  <span>
                    Your slot
                    @if (slot.audited) {
                      · audited, books face up
                    }
                  </span>
                </li>
              }
            }
            @case ('busy') {
              <li [class]="busySlot" [animate.enter]="settle(slot.playerId)">
                <svg lucideLock class="size-4 shrink-0"></svg>
                Busy · private
              </li>
            }
            @case ('audited') {
              @if (slot.booked) {
                <li [class]="busySlot" [animate.enter]="settle(slot.playerId)">
                  <svg lucideLock class="size-4 shrink-0"></svg>
                  {{ slot.name }} · audited, booked face up
                </li>
              } @else {
                <li [class]="openSlot">{{ slot.name }} · audited, books face up</li>
              }
            }
            @case ('open') {
              <li [class]="openSlot">Open</li>
            }
          }
        }
      </ul>
    } @else {
      <ul aria-label="Slots" class="grid grid-cols-2 content-start gap-1.5 opacity-70">
        @for (player of room().players; track player.playerId) {
          <li [class]="busySlot">
            <svg lucideLock class="size-4 shrink-0"></svg>
            Busy
          </li>
        }
      </ul>
    }
  `,
  host: { class: 'contents' },
})
export class ContributeDay {
  readonly room = input.required<PlayerView>();

  protected readonly cardNames = cardNames;
  protected readonly cardEffects = cardEffects;
  protected readonly cardTones = cardTones;
  protected readonly eventMeta = eventMeta;
  protected readonly busySlot = [
    'flex min-h-13 min-w-0 items-center gap-1.5 rounded-control px-2.5 py-2 text-label text-busy-fg wrap-anywhere',
    'bg-[repeating-linear-gradient(135deg,var(--busy)_0_6px,var(--busy-alt)_6px_12px)] shadow-[inset_3px_0_0_var(--busy-edge)]',
  ].join(' ');
  protected readonly openSlot =
    'flex min-h-13 min-w-0 items-center gap-1.5 rounded-control border-[1.5px] border-dashed border-open-line px-2.5 py-2 text-label font-normal text-fg-faint wrap-anywhere';
  protected readonly myOpenSlot = cn(
    this.openSlot,
    'border-brand bg-brand-tint font-semibold text-brand-text',
  );

  readonly #moments = inject(Moments);

  /** Who booked in the view that just arrived: their slot settles in as Busy, on every screen. */
  readonly #justBooked = computed(() => {
    const { from, to } = this.#moments.change();
    const booked = new Set<PlayerId>();
    if (from === null || from.phase !== 'contribute' || from.sprint !== to.sprint) {
      return booked;
    }

    const before = new Set<PlayerId>();
    for (const player of from.players) {
      if (player.hasContributed) {
        before.add(player.playerId);
      }
    }
    for (const player of to.players) {
      if (player.hasContributed && !before.has(player.playerId)) {
        booked.add(player.playerId);
      }
    }

    return booked;
  });

  protected settle(playerId: PlayerId): string | null {
    if (this.#justBooked().has(playerId)) {
      return 'motion-safe:animate-settle';
    }

    return null;
  }

  /**
   * Your slot as your booking lands: the card you booked flies from your hand into it, shrinking,
   * and the slot fades in under it. Only on your screen, and only when this page sent the booking.
   */
  protected arrive({ target, animationComplete }: AnimationCallbackEvent): void {
    const from = this.#moments.bookedFrom;
    this.#moments.bookedFrom = null;
    animationComplete();
    if (from === null || !(target instanceof HTMLElement)) {
      return;
    }

    // At phone width the slot shows only on the Tue–Wed tab.
    const slot = target.getBoundingClientRect();
    if (!target.checkVisibility() || slot.width === 0) {
      return;
    }

    const ghost = from.card;
    const scale = slot.width / from.rect.width;
    const dx = slot.left - from.rect.left;
    const dy = slot.top - from.rect.top;
    const flight = this.#moments.animate(
      ghost,
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: 'translate(0, -10px) scale(1.03)', opacity: 1, offset: 0.18 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1, offset: 0.8 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
      ],
      { duration: 620, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
    // Under reduced motion nothing flies.
    if (flight === null) {
      return;
    }

    ghost.setAttribute('aria-hidden', 'true');
    for (const named of ghost.querySelectorAll('[id]')) {
      named.removeAttribute('id');
    }
    Object.assign(ghost.style, {
      position: 'fixed',
      left: `${from.rect.left}px`,
      top: `${from.rect.top}px`,
      width: `${from.rect.width}px`,
      height: `${from.rect.height}px`,
      margin: '0',
      translate: 'none',
      transformOrigin: 'top left',
      pointerEvents: 'none',
      zIndex: '50',
    });
    target.ownerDocument.body.append(ghost);
    this.#moments.animate(target, [{ opacity: 0 }, { opacity: 1 }], {
      duration: 220,
      delay: 400,
      easing: 'ease-out',
      fill: 'backwards',
    });
    // It lands, or stops when the moment does: either way the copy goes.
    const land = () => ghost.remove();
    void flight.finished.then(land, land);
  }

  protected readonly slots = computed(() => {
    const room = this.room();
    const slots: Slot[] = [];
    for (const player of room.players) {
      const { playerId } = player;
      if (playerId === room.me.playerId) {
        slots.push({ kind: 'mine', playerId, audited: player.isAudited });
      } else if (player.isAudited) {
        slots.push({ kind: 'audited', playerId, name: player.name, booked: player.hasContributed });
      } else if (player.hasContributed) {
        slots.push({ kind: 'busy', playerId });
      } else {
        slots.push({ kind: 'open', playerId });
      }
    }

    return slots;
  });
}
