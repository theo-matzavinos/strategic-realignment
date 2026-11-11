export type RuleErrorCode =
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'WRONG_PHASE'
  | 'CARD_NOT_IN_HAND'
  | 'ALREADY_CONTRIBUTED'
  | 'UNKNOWN_PLAYER'
  | 'SELF_NOMINATION'
  | 'NO_AUDITS_LEFT'
  | 'VOTE_ALREADY_HELD'
  | 'NO_VOTE_OPEN'
  | 'ALREADY_VOTED'
  | 'VOTE_OPEN'
  | 'ALREADY_READY';

/** Why the rules refused an action. A refused action changes nothing. */
export type RuleError<Code extends RuleErrorCode = RuleErrorCode> = { code: Code };
