import { Directive, input } from '@angular/core';

/**
 * A calendar event block: a tint of its `tone` over the ground, with a 3 px edge in the tone, as a
 * group calendar draws an event. `dim` fades one that's past or not yet relevant, keeping its text legible (4.5:1).
 */
@Directive({
  selector: '[appCalendarEvent]',
  host: {
    class:
      'min-w-0 overflow-hidden rounded-control px-2.5 py-2 bg-[color-mix(in_oklab,var(--event-tone)_22%,var(--ground))] shadow-[inset_3px_0_0_var(--event-tone)] transition-opacity duration-200 motion-reduce:transition-none data-dim:opacity-70',
    '[style.--event-tone]': 'tone()',
    '[attr.data-dim]': 'dim() || null',
  },
})
export class CalendarEvent {
  /** A CSS color, such as `var(--leadership)`. */
  readonly tone = input.required<string>({ alias: 'appCalendarEvent' });
  readonly dim = input(false);
}

/** Secondary text on an event: the foreground tinted toward the event's tone. */
export const eventText = 'text-[color-mix(in_oklab,var(--event-tone)_30%,var(--fg))]';

/** An event's meta line, such as "Required · from Leadership". */
export const eventMeta =
  'flex items-center gap-1.5 text-label text-[color-mix(in_oklab,var(--event-tone)_35%,var(--fg))]';
