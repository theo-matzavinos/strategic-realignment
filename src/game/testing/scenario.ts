import type { Action } from '../action';
import { applyAction, type RuleError } from '../apply-action';
import type { CardType } from '../cards';
import type { DemandType } from '../demands';
import {
  addPlayer,
  createGame,
  type ContributeGame,
  type Game,
  type LobbyGame,
  type LoggedAction,
  type PlayerId,
} from '../game';

/**
 * Test-only: finds a seeded game that can play a scripted sequence of steps, so a rule test can
 * replay it from its seed and action log.
 */

/** The actions one step plays, or null when this seed's game can't play it. */
export type Step = (game: Game) => LoggedAction[] | null;

/** A game past the lobby. */
export type StartedGame = Exclude<Game, LobbyGame>;

export type Scenario = { seed: number; players: PlayerId[]; log: LoggedAction[] };

/** `p1` … `pN`; `p1` is host. */
export function seats(playerCount: number): PlayerId[] {
  const players: PlayerId[] = [];
  for (let seat = 1; seat <= playerCount; seat++) {
    players.push(`p${seat}`);
  }
  return players;
}

export function lobby(playerCount: number, seed = 1): Game {
  const players = seats(playerCount);
  let game: Game = createGame(seed, players[0]);
  for (const player of players.slice(1)) {
    game = addPlayer(game, player);
  }
  return game;
}

/** Applies an action the test expects the rules to accept. */
export function act(game: Game, playerId: PlayerId, action: Action): Game {
  const result: Game | RuleError = applyAction(game, playerId, action);
  if ('code' in result) {
    throw new Error(`${action.type} by ${playerId} was refused: ${result.code}`);
  }
  return result;
}

export function started(playerCount: number, seed = 1): ContributeGame {
  const game = act(lobby(playerCount, seed), 'p1', { type: 'startGame' });
  if (game.phase !== 'contribute') {
    throw new Error(`The game started in phase ${game.phase}`);
  }
  return game;
}

/** The first seed whose game, once started, plays every step. */
export function findScenario(playerCount: number, steps: Step[], maxSeed = 50_000): Scenario {
  const players = seats(playerCount);

  for (let seed = 1; seed <= maxSeed; seed++) {
    const startAction: LoggedAction = { playerId: 'p1', action: { type: 'startGame' } };
    let game = act(lobby(playerCount, seed), 'p1', startAction.action);
    const log = [startAction];

    let playable = true;
    for (const step of steps) {
      const actions = step(game);
      if (actions === null) {
        playable = false;
        break;
      }

      for (const { playerId, action } of actions) {
        game = act(game, playerId, action);
        log.push({ playerId, action });
      }
    }

    if (playable) {
      return { seed, players, log };
    }
  }

  throw new Error(`No seed up to ${maxSeed} plays this scenario`);
}

/** Per sprint from 1, the demand wanted: one type, any of several, or null for any. */
export function demands(...wanted: (DemandType | DemandType[] | null)[]): Step {
  return (game) => {
    if (game.phase === 'lobby') {
      return null;
    }

    for (let index = 0; index < wanted.length; index++) {
      const allowed = wanted[index];
      const actual = game.demands[index];
      if (allowed === null) {
        continue;
      }
      if (typeof allowed === 'string' && actual !== allowed) {
        return null;
      }
      if (Array.isArray(allowed) && !allowed.includes(actual)) {
        return null;
      }
    }

    return [];
  };
}

export type SprintPlan = {
  /** Exactly these cards are contributed this sprint, in any assignment to players. */
  cards?: CardType[];
  /** These players contribute these cards. */
  by?: Record<PlayerId, CardType>;
  /** The game after the last contribution must pass this. */
  check?: (game: StartedGame) => boolean;
  /** Submission order; seat order by default. */
  order?: PlayerId[];
};

/** Every player contributes, as the plan says. Tries assignments until one passes `check`. */
export function sprint(plan: SprintPlan = {}): Step {
  return (game) => {
    if (game.phase !== 'contribute') {
      return null;
    }

    for (const assignment of assignments(game, plan)) {
      const actions = contributions(game, assignment, plan.order);
      const after = playAll(game, actions);
      if (plan.check === undefined || plan.check(after)) {
        return actions;
      }
    }

    return null;
  };
}

/** Plays the sprint whose result scores highest. */
export function bestSprint(score: (game: StartedGame) => number): Step {
  return (game) => {
    if (game.phase !== 'contribute') {
      return null;
    }

    let best: LoggedAction[] | null = null;
    let bestScore = -Infinity;
    for (const assignment of assignments(game, {})) {
      const actions = contributions(game, assignment, undefined);
      const actionScore = score(playAll(game, actions));
      if (actionScore > bestScore) {
        best = actions;
        bestScore = actionScore;
      }
    }

    return best;
  };
}

/** `nominator` nominates `nominee`; everyone votes in seat order, yes if listed in `yes`. */
export function audit(nominator: PlayerId, nominee: PlayerId, yes: PlayerId[]): Step {
  return (game) => {
    const actions: LoggedAction[] = [
      { playerId: nominator, action: { type: 'nominate', nominee } },
    ];
    for (const player of game.players) {
      actions.push({ playerId: player, action: { type: 'vote', yes: yes.includes(player) } });
    }
    return actions;
  };
}

/** Everyone marks the retro ready, in seat order. */
export function allReady(): Step {
  return (game) => {
    const actions: LoggedAction[] = [];
    for (const player of game.players) {
      actions.push({ playerId: player, action: { type: 'finishRetro' } });
    }
    return actions;
  };
}

/** Passes only if the game is in this state now; plays nothing. */
export function expectState(check: (game: StartedGame) => boolean): Step {
  return (game) => {
    if (game.phase !== 'lobby' && check(game)) {
      return [];
    }
    return null;
  };
}

function playAll(game: StartedGame, actions: LoggedAction[]): StartedGame {
  let current: Game = game;
  for (const { playerId, action } of actions) {
    current = act(current, playerId, action);
  }
  if (current.phase === 'lobby') {
    throw new Error('A started game went back to the lobby');
  }
  return current;
}

function contributions(
  game: ContributeGame,
  assignment: Record<PlayerId, CardType>,
  order: PlayerId[] | undefined,
): LoggedAction[] {
  const actions: LoggedAction[] = [];
  for (const player of order ?? game.players) {
    if (!Object.hasOwn(game.contributions, player)) {
      actions.push({ playerId: player, action: { type: 'contribute', card: assignment[player] } });
    }
  }
  return actions;
}

/** Every way the players still to contribute can play one card each, as far as the plan allows. */
function* assignments(
  game: ContributeGame,
  plan: SprintPlan,
): Generator<Record<PlayerId, CardType>> {
  const players: PlayerId[] = [];
  for (const player of game.players) {
    if (!Object.hasOwn(game.contributions, player)) {
      players.push(player);
    }
  }

  const remaining = new Map<CardType, number>();
  if (plan.cards !== undefined) {
    for (const card of plan.cards) {
      remaining.set(card, (remaining.get(card) ?? 0) + 1);
    }
  }

  const chosen: Record<PlayerId, CardType> = {};

  function* choose(index: number): Generator<Record<PlayerId, CardType>> {
    if (index === players.length) {
      yield { ...chosen };
      return;
    }

    const player = players[index];
    const options = new Set(game.hands[player]);
    const fixed = plan.by?.[player];
    for (const card of options) {
      if (fixed !== undefined && card !== fixed) {
        continue;
      }
      if (plan.cards !== undefined && (remaining.get(card) ?? 0) === 0) {
        continue;
      }

      chosen[player] = card;
      if (plan.cards !== undefined) {
        remaining.set(card, (remaining.get(card) ?? 0) - 1);
      }
      yield* choose(index + 1);
      if (plan.cards !== undefined) {
        remaining.set(card, (remaining.get(card) ?? 0) + 1);
      }
    }
  }

  yield* choose(0);
}
