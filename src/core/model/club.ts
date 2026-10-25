import type { GameTime } from './calendar';
import type {
  AiPersonalityId,
  ClubId,
  DistrictId,
  FighterId,
  RegionId,
  TacticsPresetId,
  TierId,
  WingId,
} from './ids';
import type { Gold } from './ledger';

/**
 * A club (player or AI). One rulebook (P-04): the player's club is an
 * ordinary Club; GameState.playerClubId says which one the player manages.
 * Roster membership is owned by Fighter.clubId (derived roster, no array).
 */
export interface Club {
  /** clubs.json id. */
  id: ClubId;
  name: string;
  shortName: string;
  code: string;
  colors: { primary: string; secondary: string };
  regionId: RegionId;
  districtId: DistrictId;
  /** Current tier; changed only by promotion/relegation at season end (core/league). */
  tierId: TierId;
  /** This season's wing (redrawn every season). */
  wingId: WingId | null;
  /** Data-driven AI manager style (economy.json aiPersonalities). Also set for the player's club (ignored). */
  aiPersonalityId: AiPersonalityId;
  /** Scoutable tactics style tag. */
  tacticsStyle: 'aggressive' | 'steady' | 'cautious';
  /** 0-100 (economy.json prestige). */
  prestige: number;
  finance: ClubFinance;

  // ---- captaincy (O6; 03-fighter-lifecycle sys-captaincy) ---------------------------------
  /** The manager's standing club captain. */
  captainId: FighterId | null;
  viceCaptainId: FighterId | null;
  /** Club captain at the previous lineup lock (strip / snubbed rules). */
  captainAtLastLock: FighterId | null;
  captainSince: GameTime | null;
  /** Consecutive matches the club captain was fit but not fielded (losing_the_room). */
  captainNotFieldedStreak: number;
  /** Club-scope lifecycle statuses (e.g. captain_departed). */
  statuses: ClubStatusEntry[];

  /** Next match lineup. AI lineups for week w + 1 are stored at processing w. */
  lineup: Lineup;
  /** Player's watch list (UI convenience, persisted). Empty for AI clubs. */
  shortlist: FighterId[];
  /** One row per completed season. */
  history: ClubSeasonRow[];
}

/** 03-league-economy sys-finance. Wage bill and pending amounts are derived from contracts and offers. */
export interface ClubFinance {
  /** Cash. Changed only by core/economy together with a ledger entry. */
  balance: Gold;
  /** Season budget SB fixed at next-season setup. */
  seasonBudget: Gold;
  /** Wage budget per week WB fixed at setup (hard commitment rule). */
  wageBudgetPerWeek: Gold;
  status: 'healthy' | 'watch' | 'embargo';
  /** Consecutive week processings ending below 0. */
  debtWeeks: number;
  /** Outstanding Registry advance, deducted from future grants (≤ 30% each). */
  registryDebt: Gold;
  /** Parachute seasons remaining after relegation (2 -> 0). */
  parachuteSeasonsLeft: number;
  /** Seasons of the promotion wage-ratio bonus remaining. */
  ascensionSeasonsLeft: number;
}

export interface ClubStatusEntry {
  id: string;
  remainingWeeks: number | null;
  since: GameTime;
}

/**
 * The 5 fighters a club fields in its next match, with starting rows and
 * tactics. Locked at match start; no changes during a match in M1 (open-010).
 */
export interface Lineup {
  /** Up to 5 entries (O1); complete when exactly 5 eligible fighters. Order = slot order. */
  fighters: LineupEntry[];
  /** Match-captain override when neither the club captain nor vice-captain is fielded (open-011). */
  matchCaptainId: FighterId | null;
  /** Tactics per fighter, kept while a reserve; removed when the fighter leaves. */
  tactics: Record<FighterId, TacticsAssignment>;
}

export interface LineupEntry {
  fighterId: FighterId;
  row: StartingRow;
}

export type StartingRow = 'front' | 'back';

/** M1: a preset per fighter (O14). M3 adds custom rule lists. */
export type TacticsAssignment =
  | { kind: 'preset'; presetId: TacticsPresetId }
  /** [M3] rules follow the content rule schema (core/content RuleDef). */
  | { kind: 'custom'; name: string; rules: unknown[]; stance: 'aggressive' | 'steady' | 'cautious' };

/** Club season summary (written at season end). */
export interface ClubSeasonRow {
  season: number;
  tierId: TierId;
  wingId: WingId | null;
  wingPosition: number;
  tierPosition: number;
  points: number;
  matchWins: number;
  matchLosses: number;
  /** Furthest Reckoning stage: null (did not qualify), 'quarterfinal', 'semifinal', 'final', 'champion'. */
  reckoning: 'quarterfinal' | 'semifinal' | 'final' | 'champion' | null;
  shield: boolean;
  promoted: boolean;
  relegated: boolean;
  income: Gold;
  costs: Gold;
  endBalance: Gold;
  prestigeEnd: number;
}
