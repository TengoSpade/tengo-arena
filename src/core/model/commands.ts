import type { LineupEntry, TacticsAssignment } from './club';
import type { ClubId, FighterId, NewsId } from './ids';
import type { Gold } from './ledger';

/**
 * Commands are the ONLY way management decisions change GameState, for the
 * player and for AI clubs alike (one rulebook, P-04). The UI dispatches
 * commands; core/ai emits the same commands for AI clubs. core/game
 * validates and applies them (applyCommand). Every club command names the
 * acting club so the same validation applies to everyone.
 *
 * Phase A lists the M1 command set; payloads marked [phase B] depend on
 * 03-league-economy (contracts, market) and 03-fighter-lifecycle (captaincy).
 */
export type Command =
  | { type: 'club.choose'; clubId: ClubId }
  | { type: 'lineup.set'; clubId: ClubId; fighters: LineupEntry[]; matchCaptainId: FighterId | null }
  | { type: 'captaincy.set'; clubId: ClubId; captainId: FighterId | null; viceCaptainId: FighterId | null }
  | { type: 'tactics.assign'; clubId: ClubId; fighterId: FighterId; tactics: TacticsAssignment }
  | { type: 'market.sign'; clubId: ClubId; fighterId: FighterId; offer: ContractOffer }
  | { type: 'roster.release'; clubId: ClubId; fighterId: FighterId }
  | { type: 'contract.renew'; clubId: ClubId; fighterId: FighterId; offer: ContractOffer }
  | { type: 'news.read'; newsIds: NewsId[] };

export type CommandType = Command['type'];

/** [phase B] negotiation terms from 03-league-economy. */
export interface ContractOffer {
  wagePerWeek: Gold;
  /** Length in whole seasons, including the current one; expires at a season end. */
  seasons: number;
}

/** Diagnostics: commands applied since the last save, attached to state dumps for bug reproduction. */
export interface CommandLogEntry {
  seq: number;
  season: number;
  week: number;
  command: Command;
}
