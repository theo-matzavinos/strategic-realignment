import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RpcError } from '@loozo/angular-launch';
import { viewFor, type PlayerView } from '../../../game/view';
import { Rooms, type ServerRoom } from '../../../server/rooms';
import { RoomRequest } from './room-request';

/** A call the test answers by hand. */
function deferred() {
  let resolve!: (value: { version: number }) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<{ version: number }>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

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
  expect(room.game.phase).toBe('retro');

  return { room, ids };
}

/** The view the page shows `me`; `deliver` is a snapshot arriving on its stream. */
function fakeView(room: ServerRoom, me: string) {
  const view = signal<PlayerView>(viewFor(room, me));

  return {
    view,
    deliver(snapshot: PlayerView) {
      view.set(snapshot);
      TestBed.tick();
    },
  };
}

function request(view: () => PlayerView) {
  return TestBed.runInInjectionContext(() => new RoomRequest(view));
}

describe('RoomRequest', () => {
  it('re-enables at once after a declared refusal, with its message', async () => {
    const { room, ids } = retroRoom();
    const stream = fakeView(room, ids[0]);
    const vote = request(stream.view);
    const call = deferred();

    const sent = vote.send(() => call.promise);
    expect(vote.pending()).toBe(true);

    call.reject(new RpcError('NO_VOTE_OPEN', 409, null, 'There is no audit vote to vote in.'));
    await sent;
    TestBed.tick();

    expect(vote.pending()).toBe(false);
    expect(vote.error()).toBe('There is no audit vote to vote in.');
  });

  it('after success, stays pending through an unrelated lower-version snapshot until its version', async () => {
    const { room, ids } = retroRoom();
    room.act(ids[1], { type: 'nominate', nominee: ids[2] });
    const stream = fakeView(room, ids[0]);
    const vote = request(stream.view);
    const call = deferred();

    let calls = 0;
    const sent = vote.send(() => {
      calls++;
      return call.promise;
    });
    // Another player votes first; then the server applies yours.
    room.act(ids[3], { type: 'vote', yes: true });
    const othersVote = viewFor(room, ids[0]);
    const accepted = room.act(ids[0], { type: 'vote', yes: true });
    if (typeof accepted === 'string') {
      throw new Error(`Refused: ${accepted}`);
    }
    call.resolve(accepted);
    await sent;
    stream.deliver(othersVote);

    expect(othersVote.version).toBeLessThan(accepted.version);
    expect(vote.pending()).toBe(true);
    // A second click while pending sends nothing.
    await vote.send(() => {
      calls++;
      return call.promise;
    });
    expect(calls).toBe(1);

    stream.deliver(viewFor(room, ids[0]));

    expect(vote.pending()).toBe(false);
    expect(vote.error()).toBeNull();
  });

  it('ends usable when a Ready answer arrives after a nomination already cleared the mark', async () => {
    const { room, ids } = retroRoom();
    const stream = fakeView(room, ids[0]);
    const ready = request(stream.view);
    const call = deferred();

    const sent = ready.send(() => call.promise);
    const accepted = room.act(ids[0], { type: 'finishRetro' });
    if (typeof accepted === 'string') {
      throw new Error(`Refused: ${accepted}`);
    }
    stream.deliver(viewFor(room, ids[0]));
    expect(stream.view().retroReady).toContain(ids[0]);
    room.act(ids[1], { type: 'nominate', nominee: ids[2] });
    stream.deliver(viewFor(room, ids[0]));
    expect(stream.view().retroReady).toEqual([]);
    expect(ready.pending()).toBe(true);

    // The answer comes last; the view is already past its version.
    call.resolve(accepted);
    await sent;
    TestBed.tick();

    expect(ready.pending()).toBe(false);
    expect(ready.error()).toBeNull();
  });

  it('re-enables at once after a lost answer, with an error', async () => {
    const { room, ids } = retroRoom();
    room.act(ids[1], { type: 'nominate', nominee: ids[2] });
    const stream = fakeView(room, ids[0]);
    const vote = request(stream.view);
    const call = deferred();

    const sent = vote.send(() => call.promise);
    call.reject(new TypeError('Failed to fetch'));
    await sent;
    TestBed.tick();

    expect(vote.pending()).toBe(false);
    expect(vote.error()).toBe("Couldn't reach the server. Try again.");
  });
});
