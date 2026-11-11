import { afterNextRender, Component, inject, signal } from '@angular/core';
import { form, FormField, submit, validateStandardSchema } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { Button } from '#ui/button';
import { Field, FieldError, FieldLabel } from '#ui/field';
import { Input } from '#ui/input';
import { createRoomInput } from '../../room-input';
import { JoinRoomForm } from './join-room-form';
import { injectRpc } from './rpc.generated';

@Component({
  imports: [Button, Field, FieldError, FieldLabel, FormField, Input, JoinRoomForm],
  template: `
    <main class="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <header class="flex flex-col gap-1">
        <h1 class="text-display">Strategic Realignment</h1>
        <p class="text-muted-foreground">Create a room for your team, or join one by its code.</p>
      </header>

      <div class="grid gap-6 sm:grid-cols-2">
        <section
          aria-labelledby="create-heading"
          class="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5"
        >
          <h2 id="create-heading" class="text-headline">Create a room</h2>
          <form class="flex flex-col gap-4" novalidate (submit)="create($event)">
            <div foldField #nameField="foldField">
              <label foldFieldLabel>Your name</label>
              <input foldInput autocomplete="nickname" [formField]="createForm.name" />
              @if (nameField.state.errorsShown()) {
                <p foldFieldError>{{ nameField.state.errors()[0]?.message }}</p>
              }
            </div>

            @if (createError(); as message) {
              <p role="alert" class="text-destructive-text">{{ message }}</p>
            }

            <button
              foldButton
              variant="primary"
              type="submit"
              class="self-start"
              [disabled]="!hydrated() || createForm().submitting()"
              [focusableWhenDisabled]="hydrated()"
            >
              Create room
            </button>
          </form>
        </section>

        <section
          aria-labelledby="join-heading"
          class="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5"
        >
          <h2 id="join-heading" class="text-headline">Join a room</h2>
          <app-join-room-form (joined)="open($event)" />
        </section>
      </div>
    </main>
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
