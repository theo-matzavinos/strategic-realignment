import { Component, computed, input } from '@angular/core';
import { cn } from '#ui/cn';
import { LucideCalendar, LucideLock } from '@lucide/angular';
import type { PlayerId } from '../../../game/game';
import type { PlayerView } from '../../../game/view';
import { CalendarEvent, eventMeta } from './calendar-event';
import { cardTones } from './card-tones';
import { cardEffects, cardNames } from './display-names';

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
                <li [appCalendarEvent]="cardTones[card]" class="min-h-13 ring-2 ring-brand">
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
              <li [class]="busySlot">
                <svg lucideLock class="size-4 shrink-0"></svg>
                Busy · private
              </li>
            }
            @case ('audited') {
              @if (slot.booked) {
                <li [class]="busySlot">
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
