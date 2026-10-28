/**
 * Read-only view helpers shared by the app frame and screens: the player's
 * club with its tier, roster, cap, money and standing, all read through the
 * engine seam (core views), never computed as rules in the UI. A view that
 * is not implemented yet yields null / [] instead of breaking the screen.
 */
import type { ContentDB, TierDef, WingDef } from '../../core/content';
import type { FighterView } from '../../core/game';
import { fieldedFive, type Club, type ClubId, type CompetitionId, type Fighter, type FighterId, type Fixture, type GameState, type MatchResult, type StandingRow, type WingId } from '../../core/model';
import type { FinanceView } from '../../core/economy';
import { useStore } from './contract';
import { safeView, useEngine, type GameEngine } from './engine';

export interface ClubContext {
  state: GameState;
  content: ContentDB;
  engine: GameEngine;
  club: Club;
  tier: TierDef;
  roster: Fighter[];
  rosterCap: number;
  finance: FinanceView | null;
  wageBill: number | null;
  competitionId: CompetitionId | null;
  wing: WingDef | null;
  wingRows: StandingRow[];
  tierRows: StandingRow[];
  standing: StandingRow | null;
  /** This week's fixture of the club, if any. */
  fixture: Fixture | null;
}

export function clubContext(state: GameState, content: ContentDB, engine: GameEngine, clubId: ClubId): ClubContext | null {
  const club = state.clubs[clubId];
  if (!club) return null;
  const tier = content.tiers.get(club.tierId);
  if (!tier) return null;
  const roster = safeView(() => engine.roster(state, clubId), [] as Fighter[]);
  const finance = safeView<FinanceView | null>(() => engine.financeView(state, clubId, content), null);
  const wageBill = finance?.wageBill ?? safeView<number | null>(() => engine.wageBill(state, clubId), null);
  const competitionId = safeView<CompetitionId | null>(() => engine.leagueCompetitionOf(state, state.calendar.season, club.tierId), null);
  const wing = club.wingId ? (content.leagues.wings.list.find((w) => w.id === club.wingId) ?? null) : null;
  const wingRows =
    competitionId && club.wingId ? safeView(() => engine.standings(state, competitionId, club.wingId as WingId, content), [] as StandingRow[]) : [];
  const tierRows = competitionId ? safeView(() => engine.standings(state, competitionId, 'tier', content), [] as StandingRow[]) : [];
  const standing = wingRows.find((r) => r.clubId === clubId) ?? null;
  const fixture = state.calendar.phase === 'season-end' ? null : safeView(() => engine.clubFixture(state, clubId, state.calendar.weekIndex), null as Fixture | null);
  return { state, content, engine, club, tier, roster, rosterCap: tier.rosterCap, finance, wageBill, competitionId, wing, wingRows, tierRows, standing, fixture };
}

/** The player's club context, or null before a club is chosen. Re-renders on every committed state. */
export function usePlayerClub(): ClubContext | null {
  const store = useStore();
  const engine = useEngine();
  const state = store.game.value;
  const content = store.content.value;
  if (!state || !content || !state.playerClubId) return null;
  return clubContext(state, content, engine, state.playerClubId);
}

/** fighterView through the seam; null when the view is not available. */
export function fighterViewOf(engine: GameEngine, state: GameState, content: ContentDB, id: FighterId): FighterView | null {
  return safeView<FighterView | null>(() => engine.fighterView(state, id, content), null);
}

/** One fighter of a lineup a club actually fielded, as the stored sim input has it. */
export interface PlayedEntry {
  fighterId: FighterId;
  row: 'front' | 'back';
  /** Rating at that kickoff. */
  rating: number;
}

/**
 * The lineup a club fielded in its latest match this season (D-R: M1 shows an opponent only as they
 * last played). Null before its first match: never their planned lineup for the coming one.
 */
export function lastPlayedLineup(state: GameState, clubId: ClubId): PlayedEntry[] | null {
  let latest: MatchResult | undefined;
  for (const r of Object.values(state.results)) {
    if (r.season !== state.calendar.season || (r.homeClubId !== clubId && r.awayClubId !== clubId)) continue;
    if (!latest || r.weekIndex > latest.weekIndex) latest = r;
  }
  if (!latest) return null;
  // The sim input, or the five a compacted match kept (core/model fieldedFive); null for a result that kept neither.
  const five = fieldedFive(latest, latest.homeClubId === clubId ? 'home' : 'away');
  if (five.length === 0) return null;
  return five.map((f) => ({ fighterId: f.fighterId, row: f.row, rating: f.rating }));
}
