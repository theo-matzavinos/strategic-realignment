import { Component, inject, input } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { PlayerView } from '../../../game/view';
import { Moments, provideMoments } from './moments';

/** Stands in for the room table: it provides the moments and follows a `room` input. */
@Component({ selector: 'app-table', template: '', providers: [provideMoments(Table)] })
class Table {
  readonly room = input.required<PlayerView>();
  readonly moments = inject(Moments);
}

const names = ['Ana', 'Ben', 'Chidi', 'Dimitri', 'Eleni'];

/** Five players booking in sprint 1; you are p1. */
const booking: PlayerView = {
  code: 'ETNQ',
  version: 10,
  phase: 'contribute',
  sprint: 1,
  board: { progress: 0, target: 23, morale: 4, debt: 0, auditsLeft: 2 },
  demand: 'penTest',
  pastDemands: [],
  me: {
    playerId: 'p1',
    role: 'delivery',
    hand: ['feature', 'tests'],
    contribution: 'feature',
    otherPlant: null,
  },
  players: names.map((name, seat) => ({
    playerId: `p${seat + 1}`,
    name,
    isHost: seat === 0,
    handSize: 2,
    hasContributed: seat < 4,
    isAudited: false,
  })),
  lastReveal: null,
  vote: null,
  retroReady: [],
  result: null,
};

/** The last booking revealed sprint 1, with an incident. */
const revealed: PlayerView = {
  ...booking,
  version: 11,
  phase: 'retro',
  board: { ...booking.board, progress: 4, debt: 0 },
  me: { ...booking.me, contribution: null },
  lastReveal: {
    sprint: 1,
    cards: ['feature', 'workaround', 'workaround', 'workaround', 'tests'],
    mine: 0,
    audited: null,
    oneRemoved: false,
    outcome: { progress: 9, demandMet: false, incident: true },
  },
};

/** Everyone was ready: sprint 2 starts. */
const nextSprint: PlayerView = {
  ...booking,
  version: 12,
  sprint: 2,
  demand: 'oneWeekSprint',
  pastDemands: ['penTest'],
  board: revealed.board,
  me: { ...booking.me, contribution: null },
  players: booking.players.map((player) => ({ ...player, hasContributed: false })),
  lastReveal: revealed.lastReveal,
};

/** The game ended while sprint 1's reveal was still showing. */
const ended: PlayerView = {
  ...revealed,
  version: 12,
  phase: 'ended',
  result: { winner: 'plant', roles: {} },
};

/** Sprint 2's reveal. */
const revealedAgain: PlayerView = {
  ...nextSprint,
  version: 18,
  phase: 'retro',
  lastReveal: { ...revealed.lastReveal!, sprint: 2 },
};

/** A stand-in for `prefers-reduced-motion`, which the DOM made for tests doesn't have. */
let reduce: (reduced: boolean) => void;
/** Every script move started, as the moments started it. */
let moves: FakeMove[];

class FakeMove extends EventTarget {
  playState: AnimationPlayState = 'running';

  cancel(): void {
    this.playState = 'idle';
    this.dispatchEvent(new Event('cancel'));
  }
}

beforeEach(() => {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  const query = {
    matches: false,
    addEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
      listeners.delete(listener),
  };
  reduce = (reduced) => {
    query.matches = reduced;
    for (const listener of listeners) {
      listener({ matches: reduced });
    }
  };
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => query });

  moves = [];
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: () => {
      const move = new FakeMove();
      moves.push(move);

      return move;
    },
  });
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
  Reflect.deleteProperty(Element.prototype, 'animate');
  Reflect.deleteProperty(Element.prototype, 'getAnimations');
});

function table(first: PlayerView): { fixture: ComponentFixture<Table>; moments: Moments } {
  const fixture = TestBed.createComponent(Table);
  fixture.componentRef.setInput('room', first);
  TestBed.tick();

  return { fixture, moments: fixture.componentInstance.moments };
}

function receive(fixture: ComponentFixture<Table>, view: PlayerView): void {
  fixture.componentRef.setInput('room', view);
  TestBed.tick();
}

describe('Moments', () => {
  it('holds a received reveal while its Reminder is open, then plays it', () => {
    const { fixture, moments } = table(booking);
    expect(moments.reminder()).toBeNull();

    receive(fixture, revealed);
    expect(moments.reminder()?.title).toBe('Sprint Review');
    expect(moments.revealStage()).toBe('held');

    moments.reminder.set(null);
    expect(moments.revealStage()).toBe('playing');
  });

  it('drops the reveal and its Reminder when the result arrives during them', () => {
    const { fixture, moments } = table(booking);
    receive(fixture, revealed);
    expect(moments.revealStage()).toBe('held');

    receive(fixture, ended);
    expect(moments.reminder()).toBeNull();
    expect(moments.reveal()).toBeNull();
    expect(moments.revealStage()).toBeNull();
  });

  it('replaces the reveal with the next sprint’s demand', () => {
    const { fixture, moments } = table(booking);
    receive(fixture, revealed);
    moments.reminder.set(null);

    receive(fixture, nextSprint);
    expect(moments.reminder()?.when).toBe('Now · Monday · Sprint 2');
    expect(moments.revealStage()).toBeNull();
  });

  it('settles a held reveal when reduced motion turns on, and doesn’t replay it when it turns off', () => {
    const { fixture, moments } = table(booking);
    receive(fixture, revealed);
    const reminder = moments.reminder()!;
    expect(moments.isStill(reminder.id)).toBe(false);

    reduce(true);
    TestBed.tick();
    expect(moments.revealStage()).toBeNull();

    reduce(false);
    TestBed.tick();
    expect(moments.revealStage()).toBeNull();
    // The open Reminder stays a banner.
    expect(moments.isStill(reminder.id)).toBe(true);

    // The next reveal moves again.
    receive(fixture, nextSprint);
    receive(fixture, revealedAgain);
    expect(moments.revealStage()).toBe('held');
  });

  it('stops a move once the table moves to another phase or sprint, but not a move of the new one', () => {
    const { fixture, moments } = table(booking);
    receive(fixture, revealed);
    const shake = moments.animate(fixture.nativeElement, [], { delay: 1640 });

    receive(fixture, nextSprint);
    expect(shake?.playState).toBe('idle');

    const slide = moments.animate(fixture.nativeElement, [], { duration: 520 });
    receive(fixture, { ...nextSprint, version: 13 });
    expect(slide?.playState).toBe('running');

    receive(fixture, { ...nextSprint, version: 14, phase: 'ended' });
    expect(slide?.playState).toBe('idle');
  });

  it('stops every move when reduced motion turns on, starts none under it, and stops them as the table goes', () => {
    const { fixture, moments } = table(booking);
    receive(fixture, revealed);
    const reflow = moments.animate(fixture.nativeElement, [], { duration: 360 });

    reduce(true);
    expect(reflow?.playState).toBe('idle');
    expect(moments.animate(fixture.nativeElement, [], { duration: 360 })).toBeNull();

    reduce(false);
    const shake = moments.animate(fixture.nativeElement, [], { delay: 1640 });
    fixture.destroy();
    expect(shake?.playState).toBe('idle');
    expect(moves).toHaveLength(2);
  });
});
