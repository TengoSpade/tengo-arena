/**
 * Read-only view helpers shared by the app frame and screens: the player's
 * club with its tier, roster, cap, money and standing, all read through the
 * engine seam (core views), never computed as rules in the UI. A view that
 * is not implemented yet yields null / [] instead of breaking the screen.
 */
import type { ContentDB, TierDef, WingDef } from '../../core/content';
import type { FighterView } from '../../core/game';
import type { Club, ClubId, CompetitionId, Fighter, FighterId, Fixture, GameState, StandingRow, WingId } from '../../core/model';
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

