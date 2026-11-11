import type { CardType } from './cards';
import type { DemandType } from './demands';
import type { Board, RevealOutcome } from './game';

const cardProgress: Record<CardType, number> = {
  feature: 2,
  workaround: 3,
  tests: 1,
  refactoring: 0,
  status: 0,
  workshop: 0,
};

/** Progress every other card loses per Alignment Workshop. */
const workshopReduction = 2;

const debtPerWorkaround = 1;
const debtPerRefactoring = 2;

const incidentDebt = 3;
const incidentProgressLoss = 5;
const incidentDebtLoss = 3;

const demoProgress = 5;
const visibilityNeeded = 1;
const testingNeeded = 2;
const refactoringNeeded = 1;
const moralePenalty = 1;
const debtPenalty = 2;

type DemandRule = {
  isMet: (counts: Record<CardType, number>, progress: number) => boolean;
  penalize: (board: Board) => void;
};

/** Each demand's requirement and its penalty if missed; null for a demand without a requirement. */
const demandRules: Record<DemandType, DemandRule | null> = {
  demoTomorrow: {
    isMet: (_counts, progress) => progress >= demoProgress,
    penalize: (board) => {
      board.morale -= moralePenalty;
    },
  },
  visibilityReview: {
    isMet: (counts) => counts.status >= visibilityNeeded,
    penalize: (board) => {
      board.morale -= moralePenalty;
    },
  },
  penTest: {
    isMet: (counts) => counts.tests >= testingNeeded,
    penalize: (board) => {
      board.debt += debtPenalty;
    },
  },
  platformMigration: {
    isMet: (counts) => counts.refactoring >= refactoringNeeded,
    penalize: (board) => {
      board.debt += debtPenalty;
    },
  },
  ceoCompetitor: null,
  oneWeekSprint: null,
};

/**
 * Rules v0 Resolve, steps 1–4, over the revealed cards (the removed card is not among them).
 * Step 5, the Morale check, is the caller's: it ends the game.
 */
export function resolve(
  board: Board,
  demand: DemandType,
  revealed: CardType[],
): { board: Board; outcome: RevealOutcome } {
  const next: Board = { ...board };

  const counts: Record<CardType, number> = {
    feature: 0,
    workaround: 0,
    tests: 0,
    refactoring: 0,
    status: 0,
    workshop: 0,
  };
  for (const card of revealed) {
    counts[card]++;
  }

  let progress = 0;
  for (const card of revealed) {
    let otherWorkshops = counts.workshop;
    if (card === 'workshop') {
      otherWorkshops--;
    }
    progress += Math.max(0, cardProgress[card] - workshopReduction * otherWorkshops);
  }
  next.progress += progress;

  next.debt += debtPerWorkaround * counts.workaround;
  next.debt = Math.max(0, next.debt - debtPerRefactoring * counts.refactoring);

  let demandMet: boolean | null = null;
  const rule = demandRules[demand];
  if (rule !== null) {
    demandMet = counts.workshop > 0 || rule.isMet(counts, progress);
    if (!demandMet) {
      rule.penalize(next);
    }
  }

  const incident = next.debt >= incidentDebt;
  if (incident) {
    next.progress = Math.max(0, next.progress - incidentProgressLoss);
    next.debt -= incidentDebtLoss;
  }

  return { board: next, outcome: { progress, demandMet, incident } };
}
