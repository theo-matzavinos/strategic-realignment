import { TestBed } from '@angular/core/testing';
import type { CardType } from '../../../game/cards';
import type { PlayerView } from '../../../game/view';
import { provideMoments } from './moments';
import { SprintReview } from './sprint-review';

type Reveal = NonNullable<PlayerView['lastReveal']>;

/** Five players in sprint 1's retro; you are p1. Only the reveal varies. */
function retroView(reveal: Partial<Reveal> & { cards: CardType[] }): PlayerView {
  const names = ['Ana', 'Ben', 'Chidi', 'Dimitri', 'Eleni'];

  return {
    code: 'ETNQ',
    version: 12,
    phase: 'retro',
    sprint: 1,
    board: { progress: 9, target: 23, morale: 4, debt: 1, auditsLeft: 2 },
    demand: 'penTest',
    pastDemands: [],
    me: {
      playerId: 'p1',
      role: 'delivery',
      hand: ['feature', 'tests'],
      contribution: null,
      otherPlant: null,
    },
    players: names.map((name, seat) => ({
      playerId: `p${seat + 1}`,
      name,
      isHost: seat === 0,
      handSize: 2,
      hasContributed: false,
      isAudited: false,
    })),
    lastReveal: {
      sprint: 1,
      mine: null,
      audited: null,
      oneRemoved: false,
      outcome: { progress: 9, demandMet: false, incident: false },
      ...reveal,
    },
    vote: null,
    retroReady: [],
    result: null,
  };
}

function render(view: PlayerView): HTMLElement {
  const fixture = TestBed.createComponent(SprintReview);
  fixture.componentRef.setInput('room', view);
  fixture.detectChanges();

  return fixture.nativeElement as HTMLElement;
}

function rows(element: HTMLElement): string[] {
  const items = element.querySelectorAll('ol[aria-label="Revealed cards"] > li');
  const texts: string[] = [];
  for (const item of items) {
    texts.push(item.textContent!.replace(/\s+/g, ' ').trim());
  }

  return texts;
}

describe('SprintReview', () => {
  // The room table provides the moments in the app; here they follow the component's own input.
  beforeEach(() => {
    TestBed.overrideComponent(SprintReview, {
      add: { providers: [provideMoments(SprintReview)] },
    });
  });

  it('renders one row per card in lastReveal.cards order, yours marked, the audited card last and attributed, and the removed card as one row', () => {
    const element = render(
      retroView({
        cards: ['workaround', 'feature', 'tests', 'workaround'],
        mine: 1,
        audited: { playerId: 'p3', card: 'tests' },
        oneRemoved: true,
      }),
    );

    expect(rows(element)).toEqual([
      'Temporary Workaround +3 Progress · +1 Debt',
      'Feature Work You · +2 Progress',
      'Test Coverage +1 Progress · Counts as Testing',
      'Temporary Workaround +3 Progress · +1 Debt',
      'Test Coverage Chidi · audited · +1 Progress · Counts as Testing',
      '1 removed, unseen',
    ]);
  });

  it('follows the order the server sent, not a canonical one, and marks only the row at `mine`', () => {
    const element = render(
      retroView({ cards: ['tests', 'workaround', 'feature', 'tests'], mine: 3 }),
    );

    expect(rows(element)).toEqual([
      'Test Coverage +1 Progress · Counts as Testing',
      'Temporary Workaround +3 Progress · +1 Debt',
      'Feature Work +2 Progress',
      'Test Coverage You · +1 Progress · Counts as Testing',
    ]);
    expect(element.querySelectorAll('[data-mine]')).toHaveLength(1);
  });

  it('shows a revealed or audited Workshop’s cost to a player who holds no Workshop', () => {
    const view = retroView({
      cards: ['feature', 'feature', 'tests', 'workaround', 'workshop'],
      audited: { playerId: 'p4', card: 'workshop' },
    });
    expect(view.me.hand).not.toContain('workshop');

    const element = render(view);

    expect(rows(element)).toEqual([
      'Feature Work +2 Progress',
      'Feature Work +2 Progress',
      'Test Coverage +1 Progress · Counts as Testing',
      'Temporary Workaround +3 Progress · +1 Debt',
      'Alignment Workshop Meets the demand · Other cards −2 Progress',
      'Alignment Workshop Dimitri · audited · Meets the demand · Other cards −2 Progress',
    ]);
  });

  it('tells only the removed card’s owner that none of the revealed cards is theirs', () => {
    const removedMine = render(
      retroView({ cards: ['feature', 'tests', 'status', 'refactoring'], oneRemoved: true }),
    );
    const revealedMine = render(
      retroView({
        cards: ['feature', 'tests', 'status', 'refactoring'],
        mine: 0,
        oneRemoved: true,
      }),
    );
    const line = 'Your card was the one removed: none of the revealed cards is yours.';

    expect(removedMine.textContent).toContain(line);
    expect(revealedMine.textContent).not.toContain(line);
  });

  it('shows no rows while the next sprint books', () => {
    const view = retroView({
      cards: ['feature', 'feature', 'tests', 'status', 'workshop'],
      mine: 2,
    });
    const element = render({ ...view, phase: 'contribute', sprint: 2 });

    expect(rows(element)).toEqual([]);
    expect(element.textContent).toContain('Cards turn over in shuffled order.');
  });
});
