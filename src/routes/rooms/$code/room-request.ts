import { computed, effect, linkedSignal, signal } from '@angular/core';
import { frameworkFailures, RpcError } from '@loozo/angular-launch';
import type { PlayerView } from '../../../game/view';

/** What a sent request still waits for: the server's answer, then a view at the returned version. */
type Wait = { until: 'answer' } | { until: 'version'; version: number };

/**
 * One control's request to the room. It stays pending while the request is in flight, then, once
 * accepted, until the view reaches the version the server returned, so the control can't be used
 * again on a view from before its own action, even when other players' changes arrive first.
 * Whether the control is usable after that comes only from the view. A declared refusal
 * re-enables it at once with its message, and so does a lost answer, with "Couldn't reach the
 * server". A retry is checked against the current game: one whose earlier attempt still stands gets
 * its declared refusal, while a Ready that a nomination has since cleared is accepted again.
 *
 * A message belongs to the step of the game it was sent in: a new phase, sprint or vote stage
 * clears it, and a failure that lands after the game has moved on shows nothing. Within a step,
 * show it only beside its control, so it goes once the action's effect replaces the control.
 */
export class RoomRequest {
  readonly #view: () => PlayerView | null;
  readonly #wait = signal<Wait | null>(null);
  /** A computed, so a snapshot within the same step doesn't reset `error`. */
  readonly #step = computed(() => stepOf(this.#view()));

  readonly error = linkedSignal<string, string | null>({
    source: this.#step,
    computation: () => null,
  });
  readonly pending = computed(() => {
    const wait = this.#wait();

    return wait !== null && !reached(wait, this.#view());
  });

  /**
   * `view` is the room as the page's stream shows it now, such as the control's `room` input.
   * Construct it in an injection context, such as a field initializer.
   */
  constructor(view: () => PlayerView | null) {
    this.#view = view;

    effect(() => {
      const wait = this.#wait();
      if (wait !== null && reached(wait, this.#view())) {
        this.#wait.set(null);
      }
    });
  }

  async send(call: () => Promise<{ version: number }>): Promise<void> {
    if (this.pending()) {
      return;
    }

    this.#wait.set({ until: 'answer' });
    this.error.set(null);
    const sentIn = this.#step();

    try {
      const accepted = await call();
      this.#wait.set({ until: 'version', version: accepted.version });
    } catch (error) {
      this.#wait.set(null);
      if (this.#step() === sentIn) {
        this.error.set(messageFor(error));
      }
    }
  }
}

/** Where the game is: its phase and sprint, and in a retro whether its vote is open or decided. */
function stepOf(view: PlayerView | null): string {
  if (view === null) {
    return 'none';
  }

  let vote = 'none';
  if (view.vote !== null && view.vote.outcome === null) {
    vote = 'open';
  }
  if (view.vote !== null && view.vote.outcome !== null) {
    vote = 'decided';
  }

  return `${view.phase}:${view.sprint}:${vote}`;
}

function reached(wait: Wait, view: PlayerView | null): boolean {
  if (wait.until === 'answer' || view === null) {
    return false;
  }

  return view.version >= wait.version;
}

/**
 * A declared refusal's own message; Launch's framework messages aren't written for players, and
 * anything else means the answer never arrived.
 */
function messageFor(error: unknown): string {
  if (!(error instanceof RpcError)) {
    return "Couldn't reach the server. Try again.";
  }

  if (Object.hasOwn(frameworkFailures, error.code)) {
    return 'Something went wrong. Reload the page and try again.';
  }

  return error.message;
}
