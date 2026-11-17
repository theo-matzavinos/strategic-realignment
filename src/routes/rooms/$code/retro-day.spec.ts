// The component injects the RPC client, whose server types need the generated request context.
/// <reference path="../../../../generated/context.generated.d.ts" />
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { viewFor, type PlayerView } from '../../../game/view';
import { Rooms, type ServerRoom } from '../../../server/rooms';
import { provideMoments } from './moments';
import { RetroDay } from './retro-day';

/** Five players in sprint 1's retro, with no vote yet; you are the first. */
function retroRoom(): { room: ServerRoom; ids: string[] } {
  const room = new Rooms().create({ sessionId: 's1', name: 'Player 1' });
  for (let index = 2; index <= 5; index++) {
    room.join(`s${index}`, `Player ${index}`);
  }
  const ids = room.players.map((player) => player.playerId);
  room.act(ids[0], { type: 'startGame' });
  for (const id of ids) {
    const [card] = viewFor(room, id).me.hand;
    room.act(id, { type: 'contribute', card });
  }

  return { room, ids };
}

function render(view: PlayerView): ComponentFixture<RetroDay> {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  // The room table provides the moments in the app; here they follow the component's own input.
  TestBed.overrideComponent(RetroDay, { add: { providers: [provideMoments(RetroDay)] } });
  const fixture = TestBed.createComponent(RetroDay);
  fixture.componentRef.setInput('room', view);
  fixture.detectChanges();

  return fixture;
}

/** The stream delivers a new snapshot. */
async function deliver(fixture: ComponentFixture<RetroDay>, view: PlayerView): Promise<void> {
  fixture.componentRef.setInput('room', view);
  await fixture.whenStable();
}

function alerts(fixture: ComponentFixture<RetroDay>): string[] {
  const texts: string[] = [];
  for (const alert of fixture.nativeElement.querySelectorAll('[role="alert"]')) {
    texts.push(alert.textContent.trim());
  }

  return texts;
}

function readyButton(fixture: ComponentFixture<RetroDay>): HTMLButtonElement | null {
  for (const button of fixture.nativeElement.querySelectorAll('button')) {
    if (button.textContent.includes('Ready for sprint')) {
      return button;
    }
  }

  return null;
}

describe('RetroDay', () => {
  it("drops a lost Ready answer's error once the mark shows, and through the next retro", async () => {
    const { room, ids } = retroRoom();
    const fixture = render(viewFor(room, ids[0]));
    const http = TestBed.inject(HttpTestingController);

    readyButton(fixture)!.click();
    room.act(ids[0], { type: 'finishRetro' });
    http.expectOne('/_rpc/room/finishRetro').error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(alerts(fixture)).toEqual(["Couldn't reach the server. Try again."]);

    // The stream shows the mark: the Ready control and its message are gone.
    await deliver(fixture, viewFor(room, ids[0]));
    expect(fixture.nativeElement.textContent).toContain("You're ready.");
    expect(alerts(fixture)).toEqual([]);

    // The next sprint, then its retro: a fresh Ready control with no message.
    for (const id of ids.slice(1)) {
      room.act(id, { type: 'finishRetro' });
    }
    await deliver(fixture, viewFor(room, ids[0]));
    expect(alerts(fixture)).toEqual([]);
    for (const id of ids) {
      const [card] = viewFor(room, id).me.hand;
      room.act(id, { type: 'contribute', card });
    }
    await deliver(fixture, viewFor(room, ids[0]));
    expect(fixture.componentInstance.room().sprint).toBe(2);
    expect(readyButton(fixture)).not.toBeNull();
    expect(alerts(fixture)).toEqual([]);
    http.verify();
  });

  it('drops the error when a nomination clears the mark it was for', async () => {
    const { room, ids } = retroRoom();
    const fixture = render(viewFor(room, ids[0]));
    const http = TestBed.inject(HttpTestingController);

    readyButton(fixture)!.click();
    room.act(ids[0], { type: 'finishRetro' });
    http.expectOne('/_rpc/room/finishRetro').error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(alerts(fixture)).toEqual(["Couldn't reach the server. Try again."]);

    // A nomination clears every ready mark, so the Ready control comes back, without the message.
    room.act(ids[1], { type: 'nominate', nominee: ids[2] });
    await deliver(fixture, viewFor(room, ids[0]));
    expect(readyButton(fixture)).not.toBeNull();
    expect(alerts(fixture)).toEqual([]);
    http.verify();
  });

  it('keeps your picked nominee when another player marks ready', async () => {
    const { room, ids } = retroRoom();
    const fixture = render(viewFor(room, ids[0]));

    const second = fixture.nativeElement.querySelectorAll(
      'input[name="nominee"]',
    )[1] as HTMLInputElement;
    second.click();
    await fixture.whenStable();

    room.act(ids[2], { type: 'finishRetro' });
    await deliver(fixture, viewFor(room, ids[0]));

    const radios = fixture.nativeElement.querySelectorAll('input[name="nominee"]');
    expect((radios[1] as HTMLInputElement).checked).toBe(true);
  });
});
