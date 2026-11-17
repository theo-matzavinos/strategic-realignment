import { afterNextRender, Component, inject, signal } from '@angular/core';
import { form, FormField, submit, validateStandardSchema } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { LucideCalendar } from '@lucide/angular';
import { Button } from '#ui/button';
import { Field, FieldError, FieldLabel } from '#ui/field';
import { Input } from '#ui/input';
import { createRoomInput } from '../../room-input';
import { JoinRoomForm } from './join-room-form';
import { injectRpc } from './rpc.generated';

@Component({
  imports: [Button, Field, FieldError, FieldLabel, FormField, Input, JoinRoomForm, LucideCalendar],
  template: `
    <div class="flex min-h-dvh flex-col">
      <header
        class="flex min-h-14 items-center border-b border-line bg-chrome px-5 max-md:min-h-13 max-md:px-3.5"
      >
        <p
          class="flex items-center gap-2.5 text-[16px] font-extrabold tracking-[-0.01em] whitespace-nowrap"
        >
          <span
            aria-hidden="true"
            class="grid size-6.5 place-items-center rounded-control bg-brand-fill text-[12px] text-brand-fg"
            >SR</span
          >
          <span class="max-md:sr-only">Strategic Realignment</span>
        </p>
      </header>

      <main
        class="grid flex-1 grid-cols-[minmax(0,1fr)] place-items-center px-4 pt-6 pb-10 md:py-12"
      >
        <div class="flex w-full max-w-[860px] flex-col gap-5.5">
          <div class="flex flex-col gap-2">
            <h1
              class="text-[32px] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance md:text-[44px]"
            >
              <span class="block">Your release ships in four sprints.</span>&ngsp;
              <span class="block">One of you would rather it didn’t.</span>
            </h1>
            <p class="max-w-[60ch] text-[16px] text-pretty text-fg-muted">
              A hidden-role card game for 5–10 colleagues on a call. Book your work in secret,
              review it together, and audit whoever seems a little too aligned.
            </p>
          </div>

          <div
            class="grid rounded-dialog border border-line bg-raised shadow-dialog md:grid-cols-2"
          >
            <section
              aria-labelledby="create-heading"
              class="flex flex-col gap-3.5 p-6.5 max-md:p-5"
            >
              <div class="flex flex-col gap-1.5">
                <h2 id="create-heading" class="text-headline">New team calendar</h2>
                <p class="text-fg-muted">Start a room and share its code with the team.</p>
              </div>

              <form class="flex flex-col gap-3.5" novalidate (submit)="create($event)">
                <div foldField #nameField="foldField">
                  <label foldFieldLabel>Your name</label>
                  <input foldInput autocomplete="nickname" [formField]="createForm.name" />
                  @if (nameField.state.errorsShown()) {
                    <p foldFieldError>{{ nameField.state.errors()[0]?.message }}</p>
                  }
                </div>

                @if (createError(); as message) {
                  <p role="alert" class="text-bad">{{ message }}</p>
                }

                <button
                  foldButton
                  variant="primary"
                  size="lg"
                  type="submit"
                  class="self-start"
                  [disabled]="!hydrated() || createForm().submitting()"
                  [focusableWhenDisabled]="hydrated()"
                >
                  <svg lucideCalendar></svg>
                  Create room
                </button>
              </form>
            </section>

            <section
              aria-labelledby="join-heading"
              class="flex flex-col gap-3.5 border-line p-6.5 max-md:border-t max-md:p-5 md:border-l"
            >
              <div class="flex flex-col gap-1.5">
                <h2 id="join-heading" class="text-headline">Join with a code</h2>
                <p class="text-fg-muted">Someone sent you a four-letter code.</p>
              </div>
              <app-join-room-form (joined)="open($event)" />
            </section>
          </div>
        </div>
      </main>
    </div>
  `,
})
export default class Lobby {
  readonly #rpc = injectRpc();
  readonly #router = inject(Router);
  /**
   * False until the browser app runs. Until then the submit button is natively disabled, so an
   * early click or Enter can't submit the form natively and reload the page.
   */
  protected readonly hydrated = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly createForm = form(signal({ name: '' }), (path) => {
    validateStandardSchema(path, createRoomInput);
  });

  constructor() {
    afterNextRender(() => this.hydrated.set(true));
  }

  protected async create(event: Event): Promise<void> {
    event.preventDefault();

    await submit(this.createForm, async () => {
      this.createError.set(null);

      try {
        const room = await this.#rpc.lobby.createRoom(this.createForm().value());
        await this.open(room.code);
      } catch {
        this.createError.set("Couldn't create the room. Try again.");
      }

      return undefined;
    });
  }

  protected async open(code: string): Promise<void> {
    await this.#router.navigate(['/rooms', code]);
  }
}
