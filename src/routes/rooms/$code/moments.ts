import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
  signal,
  untracked,
  type Provider,
  type Signal,
  type Type,
  type WritableSignal,
} from '@angular/core';
import type { PlayerView } from '../../../game/view';
import { demandNames, demandPenalties, demandRequirements } from './display-names';

/**
 * The latest view this page received, and the one before it. `from` is null for the first view,
 * which renders settled: a page that loads or reloads into a phase replays nothing.
 */
export type Change = { seq: number; from: PlayerView | null; to: PlayerView };

/** A Reminder pop-up: "Now · Thursday", "Sprint Review", "5 contributions, shuffled…". */
export type ReminderContent = { id: number; when: string; title: string; text: string };

/**
 * A reveal this page received. Its rows turn over once its Reminder closes: the columns re-flow
 * first, then one row every `rowGap` ms in `lastReveal.cards` order, then the meeting notes at
 * `notesAt` ms.
 */
export type RevealMoment = { id: number; from: PlayerView; rows: number; notesAt: number };

/** How long the columns take to re-flow before the first row turns over. */
export const reflowTime = 360;
/** Between one row turning over and the next. */
export const rowGap = 180;
const rowTurn = 520;
/** How long a Reminder stays before it closes by itself. */
export const reminderTime = 2500;

/**
 * The table's moments: what changed between the views this page received, and the reveal's
 * sequence. Everything here is derived from the views alone, so a moment's order, timing and origin
 * can only follow public changes and the server-shuffled `lastReveal.cards`, never who booked what.
 *
 * Provided by the room table, so all its parts share one sequence.
 */
export class Moments {
  readonly #host: HTMLElement;
  /** The script moves playing now, each with the phase and sprint it belongs to. */
  readonly #moves = new Map<Animation, string>();
  /**
   * Moments up to this change arrived, or were showing, under reduced motion. They stay settled when
   * motion comes back: only later moments move.
   */
  readonly #stillThrough = signal(0);

  /** Under `prefers-reduced-motion: reduce` nothing moves, and the reveal isn't held. */
  readonly reducedMotion: Signal<boolean>;

  readonly change: Signal<Change>;
  /**
   * The open Reminder, if any. It closes by itself, on Dismiss, a click anywhere, or Esc, and when
   * the table moves to another phase or sprint.
   */
  readonly reminder: WritableSignal<ReminderContent | null>;
  /** The latest reveal received, kept while later views in its retro arrive. */
  readonly reveal: Signal<RevealMoment | null>;
  /**
   * `held` while the reveal's Reminder is open: the rows wait face down and the week keeps its
   * columns. `playing` once it closes. Null without a reveal moment, or when it shows settled.
   */
  readonly revealStage: Signal<'held' | 'playing' | null>;

  /** Where the card you're booking left your hand, until your slot shows it. */
  bookedFrom: { card: HTMLElement; rect: DOMRect } | null = null;

  /**
   * `room` is the table's view, as its input reads it, and `host` the table's element. Construct it
   * in an injection context.
   */
  constructor(room: () => PlayerView, host: HTMLElement) {
    this.#host = host;
    this.reducedMotion = reducedMotion((reduced) => this.#motionChanged(reduced));

    this.change = linkedSignal<PlayerView, Change>({
      source: room,
      computation: (to, previous) => {
        if (previous === undefined) {
          return { seq: 1, from: null, to };
        }

        return { seq: previous.value.seq + 1, from: previous.source, to };
      },
    });

    this.reveal = linkedSignal<Change, RevealMoment | null>({
      source: this.change,
      computation: (change, previous) => {
        const { from, to } = change;
        if (from?.phase === 'contribute' && to.phase === 'retro' && to.lastReveal !== null) {
          const reveal = to.lastReveal;
          let rows = reveal.cards.length;
          if (reveal.audited !== null) {
            rows++;
          }
          if (reveal.oneRemoved) {
            rows++;
          }
          const notesAt = reflowTime + (rows - 1) * rowGap + rowTurn - 160;

          return { id: change.seq, from, rows, notesAt };
        }
        if (movedOn(change)) {
          return null;
        }

        return previous?.value ?? null;
      },
    });

    this.reminder = linkedSignal<Change, ReminderContent | null>({
      source: this.change,
      computation: (change, previous) => {
        const reminder = reminderFor(change);
        if (reminder !== null) {
          return reminder;
        }
        if (movedOn(change)) {
          return null;
        }

        return previous?.value ?? null;
      },
    });

    this.revealStage = computed(() => {
      const reveal = this.reveal();
      if (reveal === null || this.isStill(reveal.id)) {
        return null;
      }
      if (this.reminder()?.id === reveal.id) {
        return 'held';
      }

      return 'playing';
    });

    // Whatever arrives under reduced motion stays settled, even once motion comes back.
    effect(() => {
      if (!this.reducedMotion()) {
        return;
      }

      const { seq } = this.change();
      untracked(() => this.#stillThrough.set(seq));
    });

    // A move belongs to its phase and sprint: once the table has moved on, it stops.
    const context = computed(() => contextOf(this.change().to));
    effect(() => {
      const now = context();
      untracked(() => {
        for (const [move, of] of this.#moves) {
          if (of !== now) {
            move.cancel();
          }
        }
      });
    });
    inject(DestroyRef).onDestroy(() => {
      for (const move of this.#moves.keys()) {
        move.cancel();
      }
    });
  }

  /** Whether the latest change is the one that brought `when` about, as checked on its two views. */
  arrived(when: (from: PlayerView, to: PlayerView) => boolean): boolean {
    const { from, to } = this.change();
    if (from === null) {
      return false;
    }

    return when(from, to);
  }

  /**
   * Whether the moment that arrived with change `seq` shows settled: under reduced motion, or
   * because it arrived or was showing under it.
   */
  isStill(seq: number): boolean {
    return this.reducedMotion() || seq <= this.#stillThrough();
  }

  /**
   * Plays a script move for the moment showing now. Under reduced motion it doesn't play, and
   * returns null. It stops, leaving its element as it rests, when reduced motion turns on, when the
   * table moves to another phase or sprint, or when the table goes.
   */
  animate(
    element: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ): Animation | null {
    return untracked(() => {
      if (this.reducedMotion()) {
        return null;
      }

      const move = element.animate(keyframes, options);
      this.#moves.set(move, contextOf(this.change().to));
      const done = () => this.#moves.delete(move);
      move.addEventListener('finish', done);
      move.addEventListener('cancel', done);

      return move;
    });
  }

  #motionChanged(reduced: boolean): void {
    if (reduced) {
      for (const move of this.#moves.keys()) {
        move.cancel();
      }

      return;
    }

    // Motion is back. An entrance that reduced motion cut short would start over, as its class
    // matches again: it's past, so it ends at once.
    for (const animation of this.#host.getAnimations({ subtree: true })) {
      const end = animation.effect?.getComputedTiming().endTime;
      if (Number.isFinite(end)) {
        animation.finish();
      }
    }
  }
}

/**
 * Provides one `Moments` to a component and everything inside it, following that component's `room`
 * input and on its element: the room table in the app. The component is looked up when the room is
 * first read, so it may inject the moments itself.
 */
export function provideMoments(host: Type<{ room: () => PlayerView }>): Provider {
  return {
    provide: Moments,
    useFactory: () => {
      const injector = inject(Injector);

      return new Moments(() => injector.get(host).room(), inject(ElementRef).nativeElement);
    },
  };
}

/** Whether a change takes the table to another phase or sprint, past the moments of the last one. */
function movedOn({ from, to }: Change): boolean {
  return from !== null && (from.phase !== to.phase || from.sprint !== to.sprint);
}

/** The phase and sprint a view is in, which a move belongs to. */
function contextOf(view: PlayerView): string {
  return `${view.phase}:${view.sprint}`;
}

/** The Reminder a change announces: the reveal, or a new sprint's demand. */
function reminderFor({ seq, from, to }: Change): ReminderContent | null {
  if (from?.phase === 'contribute' && to.phase === 'retro' && to.lastReveal !== null) {
    return {
      id: seq,
      when: 'Now · Thursday',
      title: 'Sprint Review',
      text: `${to.lastReveal.cards.length} contributions, shuffled. Turning them over…`,
    };
  }

  if (from?.phase === 'retro' && to.phase === 'contribute' && to.demand !== null) {
    let text = demandRequirements[to.demand];
    const penalty = demandPenalties[to.demand];
    if (penalty !== null) {
      text += ` If missed: ${penalty}.`;
    }

    return {
      id: seq,
      when: `Now · Monday · Sprint ${to.sprint}`,
      title: demandNames[to.demand],
      text,
    };
  }

  return null;
}

/**
 * Follows `prefers-reduced-motion`, and calls `changed` as it changes. Without media queries, as on
 * the server or in a DOM made for tests, nothing moves.
 */
function reducedMotion(changed: (reduced: boolean) => void): Signal<boolean> {
  const view = inject(DOCUMENT).defaultView;
  if (view === null || typeof view.matchMedia !== 'function') {
    return signal(true).asReadonly();
  }

  const query = view.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = signal(query.matches);
  const update = (event: MediaQueryListEvent) => {
    reduced.set(event.matches);
    changed(event.matches);
  };
  query.addEventListener('change', update);
  inject(DestroyRef).onDestroy(() => query.removeEventListener('change', update));

  return reduced.asReadonly();
}
