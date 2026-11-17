// The component injects the RPC client, whose server types need the generated request context.
/// <reference path="../../../../generated/context.generated.d.ts" />
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { viewFor, type PlayerView } from '../../../game/view';
import { Rooms, type ServerRoom } from '../../../server/rooms';
import { HandTray } from './hand-tray';

/** Five players in sprint 1, booking; you are the first. */
function contributeRoom(): { room: ServerRoom; ids: string[] } {
  const room = new Rooms().create({ sessionId: 's1', name: 'Player 1' });
  for (let index = 2; index <= 5; index++) {
    room.join(`s${index}`, `Player ${index}`);
  }
  const ids = room.players.map((player) => player.playerId);
  room.act(ids[0], { type: 'startGame' });

  return { room, ids };
}

function render(view: PlayerView): ComponentFixture<HandTray> {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(HandTray);
  fixture.componentRef.setInput('room', view);
  fixture.detectChanges();

  return fixture;
}

/** The stream delivers a new snapshot. */
async function deliver(fixture: ComponentFixture<HandTray>, view: PlayerView): Promise<void> {
  fixture.componentRef.setInput('room', view);
  await fixture.whenStable();
}

function alerts(fixture: ComponentFixture<HandTray>): string[] {
  const texts: string[] = [];
  for (const alert of fixture.nativeElement.querySelectorAll('[role="alert"]')) {
    texts.push(alert.textContent.trim());
  }

  return texts;
}

function bookButton(fixture: ComponentFixture<HandTray>): HTMLButtonElement | null {
  for (const button of fixture.nativeElement.querySelectorAll('button')) {
    if (button.textContent.includes('Book')) {
      return button;
    }
  }

  return null;
}

describe('HandTray', () => {
  it("drops a lost Book answer's error once the booking shows, and through the next sprint", async () => {
    const { room, ids } = contributeRoom();
    const fixture = render(viewFor(room, ids[0]));
    const http = TestBed.inject(HttpTestingController);

    const firstCard = fixture.nativeElement.querySelector(
      'input[type="radio"]',
    ) as HTMLInputElement;
    firstCard.click();
    await fixture.whenStable();
    bookButton(fixture)!.click();

    // The server applies the booking, but its answer never arrives.
    const [card] = viewFor(room, ids[0]).me.hand;
    room.act(ids[0], { type: 'contribute', card });
    http.expectOne('/_rpc/room/contribute').error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(alerts(fixture)).toEqual(["Couldn't reach the server. Try again."]);

    // The stream shows the booking: the Book control and its message are gone.
    await deliver(fixture, viewFor(room, ids[0]));
    expect(fixture.nativeElement.textContent).toContain('You booked');
    expect(bookButton(fixture)).toBeNull();
    expect(alerts(fixture)).toEqual([]);

    // Through the retro to the next sprint's Book control, with no message.
    for (const id of ids.slice(1)) {
      const [other] = viewFor(room, id).me.hand;
      room.act(id, { type: 'contribute', card: other });
    }
    await deliver(fixture, viewFor(room, ids[0]));
    expect(alerts(fixture)).toEqual([]);
    for (const id of ids) {
      room.act(id, { type: 'finishRetro' });
    }
    await deliver(fixture, viewFor(room, ids[0]));
    expect(fixture.componentInstance.room().sprint).toBe(2);
    expect(bookButton(fixture)).not.toBeNull();
    expect(alerts(fixture)).toEqual([]);
    http.verify();
  });

  it('keeps your picked card when another player books', async () => {
    const { room, ids } = contributeRoom();
    const fixture = render(viewFor(room, ids[0]));

    const second = fixture.nativeElement.querySelectorAll(
      'input[type="radio"]',
    )[1] as HTMLInputElement;
    second.click();
    await fixture.whenStable();

    const [other] = viewFor(room, ids[1]).me.hand;
    room.act(ids[1], { type: 'contribute', card: other });
    await deliver(fixture, viewFor(room, ids[0]));

    const radios = fixture.nativeElement.querySelectorAll('input[type="radio"]');
    expect((radios[1] as HTMLInputElement).checked).toBe(true);
    expect(bookButton(fixture)!.disabled).toBe(false);
  });
});
