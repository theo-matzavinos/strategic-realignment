import type { Action } from './action';
import { contribute } from './contribute';
import type { Game, PlayerId } from './game';
import { finishRetro, nominate, vote } from './retro';
import type { RuleError } from './rule-error';
import { startGame } from './start-game';

export type { RuleError, RuleErrorCode } from './rule-error';

/** The refusal codes each action can return, so each RPC mutation declares only its own. */
export type ActionErrorCode<Type extends Action['type']> = {
  startGame: RefusalOf<typeof startGame>;
  contribute: RefusalOf<typeof contribute>;
  nominate: RefusalOf<typeof nominate>;
  vote: RefusalOf<typeof vote>;
  finishRetro: RefusalOf<typeof finishRetro>;
}[Type];

type RefusalOf<Handler extends (...args: never[]) => unknown> = Extract<
  ReturnType<Handler>,
  RuleError
>['code'];

/** Applies one validated action. Returns the next game, or why the action is refused. */
export function applyAction<Validated extends Action>(
  game: Game,
  playerId: PlayerId,
  action: Validated,
): Game | RuleError<ActionErrorCode<Validated['type']>>;
export function applyAction(game: Game, playerId: PlayerId, action: Action): Game | RuleError {
  if (!game.players.includes(playerId)) {
    // The server only acts for seated players, so this is a bug, not a refused action.
    throw new Error(`Player ${playerId} isn't seated in this game`);
  }

  const logged = { playerId, action };
  switch (action.type) {
    case 'startGame': {
      return startGame(game, logged);
    }
    case 'contribute': {
      return contribute(game, logged, action.card);
    }
    case 'nominate': {
      return nominate(game, logged, action.nominee);
    }
    case 'vote': {
      return vote(game, logged, action.yes);
    }
    case 'finishRetro': {
      return finishRetro(game, logged);
    }
  }
}
