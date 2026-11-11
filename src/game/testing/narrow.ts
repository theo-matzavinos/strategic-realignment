import type { ContributeGame, EndedGame, Game, RetroGame } from '../game';

/** Test-only: the game in the phase the test expects, or a clear failure. */
export function inContribute(game: Game): ContributeGame {
  if (game.phase !== 'contribute') {
    throw new Error(`Expected phase contribute, got ${game.phase}`);
  }
  return game;
}

export function inRetro(game: Game): RetroGame {
  if (game.phase !== 'retro') {
    throw new Error(`Expected phase retro, got ${game.phase}`);
  }
  return game;
}

export function inEnded(game: Game): EndedGame {
  if (game.phase !== 'ended') {
    throw new Error(`Expected phase ended, got ${game.phase}`);
  }
  return game;
}
