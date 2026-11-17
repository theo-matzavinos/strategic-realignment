import { Component, input, output, signal } from '@angular/core';
import { Button } from '#ui/button';
import { LucideCheck, LucideCopy } from '@lucide/angular';

/**
 * The room's top bar: the brand, the room code with a copy button, which sprint of four this is
 * (not navigation) and the connection status. When they don't fit on one row, as with "Connection
 * lost" and Reconnect on a phone, the sprint and status wrap onto a second row, right-aligned.
 */
@Component({
  selector: 'app-top-bar',
  imports: [Button, LucideCheck, LucideCopy],
  template: `
    <header
      class="flex min-h-14 flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-chrome px-5 py-2 max-desk:min-h-13 max-desk:gap-x-2.5 max-desk:px-3.5"
    >
      <p
        class="flex items-center gap-2.5 text-[16px] font-extrabold tracking-[-0.01em] whitespace-nowrap"
      >
        <span
          aria-hidden="true"
          class="grid size-6.5 place-items-center rounded-control bg-brand-fill text-[12px] text-brand-fg"
          >SR</span
        >
        <span class="max-desk:sr-only">Strategic Realignment</span>
      </p>

      <div class="flex items-center gap-2 text-fg-muted">
        <h1 class="flex items-center gap-2 whitespace-nowrap">
          <span class="max-desk:sr-only">Team calendar</span>&ngsp;
          <span
            class="rounded-l-control border border-r-0 border-line bg-raised py-1 pr-1 pl-2.5 text-[15px] font-extrabold tracking-[0.16em] text-fg"
            >{{ code() }}</span
          >
        </h1>
        <button
          type="button"
          class="-ml-2 grid h-[31px] cursor-pointer place-items-center rounded-r-control border border-l-0 border-line bg-raised pr-2 pl-1 text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          [attr.aria-label]="copyLabel()"
          [title]="copyLabel()"
          (click)="copy()"
        >
          @if (copied()) {
            <svg lucideCheck class="size-4 shrink-0 text-ok"></svg>
          } @else {
            <svg lucideCopy class="size-4 shrink-0"></svg>
          }
        </button>
      </div>

      <div
        class="ms-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2 max-desk:gap-x-2.5"
      >
        @if (sprint(); as current) {
          <ol aria-label="Sprints" class="flex gap-1">
            @for (number of sprints; track number) {
              <li
                class="rounded-control border px-3 py-1.5 font-semibold whitespace-nowrap"
                [class]="sprintClass(number, current)"
                [attr.aria-current]="currentStep(number, current)"
              >
                Sprint {{ number }} of 4
              </li>
            }
          </ol>
        }

        <div class="flex items-center gap-2">
          <p
            role="status"
            class="flex items-center gap-1.5 text-label whitespace-nowrap"
            [class.text-ok]="live()"
            [class.text-fg-muted]="!live()"
          >
            @if (live()) {
              <span aria-hidden="true" class="size-1.75 rounded-full bg-ok"></span>
            }
            {{ status() }}
          </p>
          @if (canReconnect()) {
            <button foldButton size="sm" (click)="reconnect.emit()">Reconnect</button>
          }
        </div>
      </div>
    </header>
  `,
})
export class TopBar {
  readonly code = input.required<string>();
  /** Null outside a game, which hides the sprint indicator. */
  readonly sprint = input<number | null>(null);
  readonly status = input.required<string>();
  readonly live = input(false);
  readonly canReconnect = input(false);
  readonly reconnect = output();

  protected readonly sprints = [1, 2, 3, 4];
  protected readonly copied = signal(false);
  #copiedTimer: ReturnType<typeof setTimeout> | undefined;

  protected copyLabel(): string {
    if (this.copied()) {
      return 'Room code copied';
    }

    return 'Copy room code';
  }

  protected currentStep(number: number, current: number): 'step' | null {
    if (number === current) {
      return 'step';
    }

    return null;
  }

  protected sprintClass(number: number, current: number): string {
    if (number === current) {
      return 'border-brand bg-brand-tint text-fg';
    }

    // All four fit beside the status only beside the whole week; on the day view only the current one shows.
    if (number < current) {
      return 'border-transparent text-fg-muted max-desk:hidden';
    }

    return 'border-transparent text-fg-faint max-desk:hidden';
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
    } catch {
      // The browser refused clipboard access; the code stays readable in the chip.
      return;
    }

    this.copied.set(true);
    clearTimeout(this.#copiedTimer);
    this.#copiedTimer = setTimeout(() => this.copied.set(false), 2000);
  }
}
