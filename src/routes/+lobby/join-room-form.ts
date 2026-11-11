import { afterNextRender, Component, input, output, signal } from '@angular/core';
import { form, FormField, submit, validateStandardSchema } from '@angular/forms/signals';
import { Button } from '#ui/button';
import { Field, FieldError, FieldLabel } from '#ui/field';
import { Input } from '#ui/input';
import { playerNameSchema, roomCodeSchema } from '../../room-input';
import { injectRpc } from './rpc.generated';

/**
 * Joins a room by code under a name. With a `code`, it asks only for the name, as on the page of a
 * room you aren't in yet. Emits the room's code once you have a seat.
 */
@Component({
  selector: 'app-join-room-form',
  imports: [Button, Field, FieldError, FieldLabel, FormField, Input],
  template: `
    <form class="flex flex-col gap-4" novalidate (submit)="join($event)">
      @if (code() === undefined) {
        <div foldField #codeField="foldField">
          <label foldFieldLabel>Room code</label>
          <input
            foldInput
            class="uppercase tracking-widest"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            [formField]="joinForm.code"
          />
          @if (codeField.state.errorsShown()) {
            <p foldFieldError>{{ codeField.state.errors()[0]?.message }}</p>
          }
        </div>
      }

      <div foldField #nameField="foldField">
        <label foldFieldLabel>Your name</label>
        <input foldInput autocomplete="nickname" [formField]="joinForm.name" />
        @if (nameField.state.errorsShown()) {
          <p foldFieldError>{{ nameField.state.errors()[0]?.message }}</p>
        }
      </div>

      @if (error(); as message) {
        <p role="alert" class="text-destructive-text">{{ message }}</p>
      }

      <button
        foldButton
        variant="primary"
        type="submit"
        class="self-start"
        [disabled]="!hydrated() || joinForm().submitting()"
        [focusableWhenDisabled]="hydrated()"
      >
        Join room
      </button>
    </form>
  `,
})
export class JoinRoomForm {
  readonly code = input<string>();
  readonly joined = output<string>();

  readonly #rpc = injectRpc();
  /**
   * False until the browser app runs. Until then the submit button is natively disabled, so an
   * early click or Enter can't submit the form natively and reload the page.
   */
  protected readonly hydrated = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly joinForm = form(signal({ code: '', name: '' }), (path) => {
    validateStandardSchema(path.code, () => {
      if (this.code() === undefined) {
        return roomCodeSchema;
      }

      return undefined;
    });
    validateStandardSchema(path.name, playerNameSchema);
  });

  constructor() {
    afterNextRender(() => this.hydrated.set(true));
  }

  protected async join(event: Event): Promise<void> {
    event.preventDefault();

    await submit(this.joinForm, async () => {
      this.error.set(null);
      const { code, name } = this.joinForm().value();

      try {
        const room = await this.#rpc.lobby.joinRoom({ code: this.code() ?? code, name });
        this.joined.emit(room.code);
      } catch (error) {
        this.error.set(this.#messageFor(error));
      }

      return undefined;
    });
  }

  #messageFor(error: unknown): string {
    if (!this.#rpc.lobby.joinRoom.isError(error)) {
      return "Couldn't reach the server. Try again.";
    }

    switch (error.code) {
      case 'ROOM_NOT_FOUND':
      case 'ROOM_FULL':
      case 'NAME_TAKEN':
      case 'GAME_STARTED': {
        return error.message;
      }
      case 'INVALID_INPUT': {
        return error.data.issues[0]?.message ?? 'Check the room code and your name.';
      }
      default: {
        return 'Something went wrong. Try again.';
      }
    }
  }
}
