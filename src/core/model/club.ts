import type { AiProfileId, ClubId, ClubTemplateId, FighterId, RegionId, TacticsPresetId, TierId } from './ids';
import type { Gold } from './ledger';

/**
 * A club in the world (player or AI). One rulebook: the player's club is an
 * ordinary Club; GameState.playerClubId says which one the player manages.
 *
 * Membership is owned by Fighter.clubId (single source of truth). The roster
 * is derived (all active fighters whose clubId is this club); the club does
 * not keep a separate roster array that could drift.
 */
export interface Club {
  id: ClubId;
  /** clubs.json template this club was created from (null for generated clubs). */
  templateId: ClubTemplateId | null;
  /** Display name and colours come from content (or name generation); stored so saves stay readable if content changes. */
  name: string;
  shortName: string;
  colors: { primary: string; secondary: string };
  regionId: RegionId;
  /** Current tier (tier 1 is the top). Changed only by promotion/relegation at season end. */
  tierId: TierId;
  /** AI manager style for AI clubs. Ignored for the player's club. [phase B: profile schema] */
  aiProfileId: AiProfileId | null;
  /** Cash balance in gold. Changed only together with a ledger entry (core/economy). */
  balance: Gold;
  /** [phase B] prestige / reputation used by budgets, revenue and the market (open-028). */
  prestige: number;
  /** The manager's standing captaincy choices (O6; vice-captain per open-011 working assumption). */
  captainId: FighterId | null;
  viceCaptainId: FighterId | null;
  lineup: Lineup;
}

/**
 * The fighters a club fields in its next match, with starting rows and
 * tactics. Locked at match start (open-010: no changes during a match in M1).
 */
export interface Lineup {
  /** Up to lineup size (5, O1) entries; complete when it has exactly 5 eligible fighters. Order = deployment order within each row. */
  fighters: LineupEntry[];
  /**
   * Match captain override, used only when neither the club captain nor the
   * vice-captain is in the lineup (open-011 working assumption). null = default rule.
   */
  matchCaptainId: FighterId | null;
  /** Tactics per fighter, kept while the fighter is a reserve; removed when the fighter leaves the club. */
  tactics: Record<FighterId, TacticsAssignment>;
}

export interface LineupEntry {
  fighterId: FighterId;
  /** Starting row in the top-down arena (P-03). */
  row: StartingRow;
}

export type StartingRow = 'front' | 'back';

/**
 * Which rule list a fighter fights with. M1 uses presets only (O14); custom
 * rule lists arrive with the tactics editor (M3).
 */
export type TacticsAssignment =
  | { kind: 'preset'; presetId: TacticsPresetId }
  /** [phase B / M3] `rules` follows the rule-list schema from 03-combat (core/tactics owns its type). */
  | { kind: 'custom'; name: string; rules: unknown[] };
