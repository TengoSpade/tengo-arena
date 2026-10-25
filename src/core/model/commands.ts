import type { LineupEntry, TacticsAssignment } from './club';
import type { TrainingEmphasis } from './fighter';
import type { ClubId, FighterId, NewsId } from './ids';
import type { Gold } from './ledger';

/**
 * Commands are the ONLY way management decisions change GameState, for the
 * player and for AI clubs alike (one rulebook, P-04). The UI dispatches
 * them through the store; core/ai returns them for AI clubs; core/game
 * validates and applies them (applyCommand). Every club command names the
 * acting club so the same validation applies to everyone.
 */
export type Command =
  /** Pick the player's club after world generation. */
  | { type: 'club.choose'; clubId: ClubId }
  /** Set the next match lineup: 5 fighters with rows, plus an optional match-captain override. */
  | { type: 'lineup.set'; clubId: ClubId; fighters: LineupEntry[]; matchCaptainId: FighterId | null }
  /** Assign a fighter's tactics (M1: a preset of the fighter's class). */
  | { type: 'tactics.assign'; clubId: ClubId; fighterId: FighterId; tactics: TacticsAssignment }
  /** Name the club captain and vice-captain (O6, open-011). */
  | { type: 'captaincy.set'; clubId: ClubId; captainId: FighterId | null; viceCaptainId: FighterId | null }
  /** Standing training emphasis of one fighter. */
  | { type: 'training.set'; clubId: ClubId; fighterId: FighterId; emphasis: TrainingEmphasis }
  /** Offer a contract to a free agent; answered at week processing (reserves cap and wage room now). */
  | { type: 'offer.make'; clubId: ClubId; fighterId: FighterId; wagePerWeek: Gold; seasons: number; acceptCounter: boolean }
  | { type: 'offer.withdraw'; clubId: ClubId; fighterId: FighterId }
  /** Renew an own fighter in the contract's final season; answered at once. */
  | { type: 'contract.renew'; clubId: ClubId; fighterId: FighterId; wagePerWeek: Gold; seasons: number }
  /** Sign an exclusive trials-day rookie (P1); answered at once. */
  | { type: 'trials.sign'; clubId: ClubId; fighterId: FighterId; wagePerWeek: Gold; seasons: number }
  /** Release a fighter (payout per economy.json; cap relief after relegation). */
  | { type: 'roster.release'; clubId: ClubId; fighterId: FighterId }
  | { type: 'shortlist.toggle'; clubId: ClubId; fighterId: FighterId }
  | { type: 'news.markRead'; newsIds: NewsId[] }
  /** Set the read flag either way (Undo of mark-read). */
  | { type: 'news.setRead'; newsIds: NewsId[]; read: boolean };

export type CommandType = Command['type'];

/** Diagnostics: commands applied since the last save, attached to state dumps for bug reproduction. */
export interface CommandLogEntry {
  seq: number;
  season: number;
  weekIndex: number;
  command: Command;
}
