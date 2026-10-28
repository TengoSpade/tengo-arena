import type { LineupEntry, TacticsAssignment } from './club';
import type { TrainingEmphasis } from './fighter';
import type { ClubId, FighterId, FixtureId, NewsId } from './ids';
import type { Gold } from './ledger';
import type { FightCall, MatchViewMode, SwapDecision } from './match';
import type { AutoSwapRules, LevelUpModeSetting, LevelUpPacing, PauseBetweenRounds } from './progression';

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
  | { type: 'news.setRead'; newsIds: NewsId[]; read: boolean }
  // ---- M1.1 (05 M1.1 addendum) ----------------------------------------------------------------------
  /** Set the whole match squad: 5 starters with rows, 0-2 reserves, optional match-captain override (lineup.set keeps the reserves). */
  | { type: 'squad.set'; clubId: ClubId; fighters: LineupEntry[]; reserves: FighterId[]; matchCaptainId: FighterId | null }
  /**
   * Resolve one pending level-up of an own fighter: option index into the
   * offer (null only for an empty level) and the trait offer answer (index,
   * or null for "neither" / no offer). Refused while a match is in progress.
   */
  | { type: 'levelup.choose'; clubId: ClubId; fighterId: FighterId; level: number; optionIndex: number | null; traitIndex: number | null }
  /** Auto-pick policy of one fighter, or (fighterId null) the club default; the club default cannot be 'inherit'. */
  | { type: 'levelup.policy'; clubId: ClubId; fighterId: FighterId | null; mode: LevelUpModeSetting }
  /** The player's swaps for the pending between-round step of GameState.liveMatch ([] = no swaps). Applied when the match continues. */
  | { type: 'match.swap'; clubId: ClubId; fixtureId: FixtureId; afterRound: number; swaps: SwapDecision[] }
  /** Auto-swap rules of the club. */
  | { type: 'autoswap.set'; clubId: ClubId; rules: AutoSwapRules }
  /** Pacing: when level-up dialogs open and when the club's matches pause between rounds. */
  | { type: 'pacing.set'; clubId: ClubId; levelUpPacing: LevelUpPacing; pauseBetweenRounds: PauseBetweenRounds }
  // ---- M2 (docs/design/_drafts/05-technical-m2.md; implemented by WP-M2B) --------------------------------
  /**
   * The player has watched his live round up to `tick` (monotonic: a lower tick is refused). Moves
   * liveMatch.watch.cursorTick so a reload resumes there; changes no result. Sent only when playback stops (pause,
   * auto-pause, round end, window hidden; tech-019), never while it runs. `mode: 'simulate'` switches the rest of the match to Simulate (the
   * current round still finishes with its calls); 'watch' never comes back mid-match. Refused with
   * 'match.watch-unavailable' until WP-M2B lands.
   */
  | { type: 'match.watch'; clubId: ClubId; fixtureId: FixtureId; round: number; tick: number; mode?: MatchViewMode }
  /**
   * RESERVED for the calls package (P-01, Q17): one call for the player's side in the watched round, at
   * call.tick ≥ the cursor. Refused with 'match.calls-unavailable' until that package lands.
   */
  | { type: 'match.call'; clubId: ClubId; fixtureId: FixtureId; round: number; call: FightCall };

export type CommandType = Command['type'];

/** Diagnostics: commands applied since the last save, attached to state dumps for bug reproduction. */
export interface CommandLogEntry {
  seq: number;
  season: number;
  weekIndex: number;
  command: Command;
}
