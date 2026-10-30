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
import type { AutoSwapRules, LevelUpMode, LevelUpPacing, PauseBetweenRounds } from './progression';

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

  // ---- M1.1 match-day settings (progression.md, combat-skills.md sys-match) --------------------------
  /** Level-up policy of fighters set to 'inherit': the player's club 'manual', AI clubs 'auto' (levels.json autoPick). */
  levelUpDefault: LevelUpMode;
  /** When the level-up dialog opens (player's club; AI clubs never pause). */
  levelUpPacing: LevelUpPacing;
  /** Auto-swap rules: suggestions on the player's between-round screen, decisions for AI clubs and unpaused matches. */
  autoSwap: AutoSwapRules;
  /** When the player's matches pause between rounds (AI-vs-AI matches never pause). */
  pauseBetweenRounds: PauseBetweenRounds;
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
 * The match squad a club names for its next match: 5 starters with starting
 * rows and up to 2 reserves (M1.1 sys-match), plus tactics. Locked at match
 * start; between rounds only swaps change the active five.
 */
export interface Lineup {
  /** The starters: up to 5 entries (O1); complete when exactly 5 eligible fighters. Order = slot order. */
  fighters: LineupEntry[];
  /** M1.1: 0-2 squad reserves (combat.json match.squad.reservesMax), distinct from the starters. They enter in the outgoing fighter's slot and row. */
  reserves: FighterId[];
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
