/**
 * GameEngine: the core functions the UI calls, behind one seam.
 *
 * Production uses `coreEngine` (the real module indexes). Tests and the dev
 * fixture world can pass a different engine (src/ui/debug/dev-engine.ts
 * falls back to PROVISIONAL dev-only implementations while a core function
 * still throws NotImplementedError). Screens read views through
 * `useEngine()` so they work the same either way. The UI never mutates
 * GameState: every write goes through the store's dispatch / advance.
 */
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import * as economy from '../../core/economy';
import * as fighters from '../../core/fighters';
import * as game from '../../core/game';
import * as league from '../../core/league';
import * as save from '../../core/save';
import * as tactics from '../../core/tactics';
import type { FighterId, GameState } from '../../core/model';

/** One fighter's season-end change, as core/game developmentSummary returns it. */
export interface DevelopmentSummaryRow {
  fighterId: FighterId;
  ageBefore: number;
  ageAfter: number;
  ratingBefore: number;
  ratingAfter: number;
  /** Per attribute change: a map by stat id, or a list of { statId | id, delta }. */
  attributeDeltas: Readonly<Record<string, number>> | readonly { statId?: string; id?: string; delta: number }[];
  potentialChange?: number;
  retired?: boolean;
}

/** Attribute deltas as a list, whichever shape core used; zeros dropped, largest first. */
export function attributeDeltaList(row: Pick<DevelopmentSummaryRow, 'attributeDeltas'>): { statId: string; delta: number }[] {
  const raw = row.attributeDeltas;
  const list = Array.isArray(raw)
    ? (raw as readonly { statId?: string; id?: string; delta: number }[]).map((d) => ({ statId: d.statId ?? d.id ?? '', delta: d.delta }))
    : Object.entries(raw as Readonly<Record<string, number>>).map(([statId, delta]) => ({ statId, delta }));
  return list.filter((d) => d.statId && d.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.statId.localeCompare(b.statId));
}

export interface GameEngine {
  // transitions (core/game)
  createWorld: typeof game.createWorld;
  applyCommand: typeof game.applyCommand;
  getBlockers: typeof game.getBlockers;
  advanceWeek: typeof game.advanceWeek;
  runSeasonEnd: typeof game.runSeasonEnd;
  buildMatchReport: typeof game.buildMatchReport;
  // views (core/game)
  roster: typeof game.roster;
  fighterView: typeof game.fighterView;
  freeAgents: typeof game.freeAgents;
  suggestLineup: typeof game.suggestLineup;
  /** Who a captaincy change would Snub or pass over, and the chemistry before and after (m1/fix-perf). */
  captaincyPreview: typeof game.captaincyPreview;
  // views (other modules, read-only)
  lineupChemistry: typeof fighters.lineupChemistry;
  captaincy: typeof fighters.captaincy;
  isFit: typeof fighters.isFit;
  standings: typeof league.standings;
  leagueCompetitionOf: typeof league.leagueCompetitionOf;
  clubFixture: typeof league.clubFixture;
  clubSchedule: typeof league.clubSchedule;
  financeView: typeof economy.financeView;
  wageBill: typeof economy.wageBill;
  pendingWages: typeof economy.pendingWages;
  /** Integrator (WP5) addition for WP7's market (additive). */
  ask: typeof economy.ask;
  checkOffer: typeof economy.checkOffer;
  marketWage: typeof economy.marketWage;
  /** Polish pass: the payout a release would cost now (shown before the player confirms). */
  releasePayout: typeof economy.releasePayout;
  /**
   * Season-end development per fighter (core/game developmentSummary). Optional so test fakes can
   * omit it; screens then fall back to the history rows.
   */
  developmentSummary?: (state: GameState, season: number) => readonly DevelopmentSummaryRow[];
  presetsForClass: typeof tactics.presetsForClass;
  describeRule: typeof tactics.describeRule;
  // ---- M1.1 (optional so test fakes can omit them; WP-D screens read them through store/match-day.ts) ----
  /** Continue: advanceWeek, or play on a live match to its next pause (core/game advance). */
  advance?: typeof game.advance;
  betweenRoundView?: typeof game.betweenRoundView;
  levelUpView?: typeof game.levelUpView;
  freshnessOf?: typeof fighters.freshnessOf;
  freshnessLabel?: typeof fighters.freshnessLabel;
  /** Freshness forecasts and the level ETA (WP-B; stubs until it merges, so screens fall back to the documented formula). */
  typicalRoundDrain10?: typeof fighters.typicalRoundDrain10;
  weeklyRest10?: typeof fighters.weeklyRest10;
  levelEtaMatches?: typeof fighters.levelEtaMatches;
  effectiveLevelUpMode?: typeof fighters.effectiveLevelUpMode;
  // ---- M2 (optional so test fakes can omit them; screens read them through store/arena.ts; 05-technical-m2 §A7) ----
  liveRoundPlayback?: typeof game.liveRoundPlayback;
  roundPlayback?: typeof game.roundPlayback;
  matchPlayback?: typeof game.matchPlayback;
  replayAvailability?: typeof game.replayAvailability;
  inspectPlayback?: typeof game.inspectPlayback;
  /** Warm the replay-availability hash at idle after a load, so the first Replay button never costs 55-130 ms in a click. */
  warmReplayHash?: typeof game.warmReplayHash;
  // saves (core/save)
  saveMetaFor: typeof save.saveMetaFor;
  createSave: typeof save.createSave;
  serializeSave: typeof save.serializeSave;
  parseSave: typeof save.parseSave;
}

export const coreEngine: GameEngine = {
  createWorld: game.createWorld,
  applyCommand: game.applyCommand,
  getBlockers: game.getBlockers,
  advanceWeek: game.advanceWeek,
  runSeasonEnd: game.runSeasonEnd,
  buildMatchReport: game.buildMatchReport,
  roster: game.roster,
  fighterView: game.fighterView,
  freeAgents: game.freeAgents,
  suggestLineup: game.suggestLineup,
  captaincyPreview: game.captaincyPreview,
  lineupChemistry: fighters.lineupChemistry,
  captaincy: fighters.captaincy,
  isFit: fighters.isFit,
  standings: league.standings,
  leagueCompetitionOf: league.leagueCompetitionOf,
  clubFixture: league.clubFixture,
  clubSchedule: league.clubSchedule,
  financeView: economy.financeView,
  wageBill: economy.wageBill,
  pendingWages: economy.pendingWages,
  ask: economy.ask,
  checkOffer: economy.checkOffer,
  marketWage: economy.marketWage,
  releasePayout: economy.releasePayout,
  developmentSummary: game.developmentSummary,
  presetsForClass: tactics.presetsForClass,
  describeRule: tactics.describeRule,
  advance: game.advance,
  betweenRoundView: game.betweenRoundView,
  levelUpView: game.levelUpView,
  freshnessOf: fighters.freshnessOf,
  freshnessLabel: fighters.freshnessLabel,
  typicalRoundDrain10: fighters.typicalRoundDrain10,
  weeklyRest10: fighters.weeklyRest10,
  levelEtaMatches: fighters.levelEtaMatches,
  effectiveLevelUpMode: fighters.effectiveLevelUpMode,
  liveRoundPlayback: game.liveRoundPlayback,
  roundPlayback: game.roundPlayback,
  matchPlayback: game.matchPlayback,
  replayAvailability: game.replayAvailability,
  inspectPlayback: game.inspectPlayback,
  warmReplayHash: game.warmReplayHash,
  saveMetaFor: save.saveMetaFor,
  createSave: save.createSave,
  serializeSave: save.serializeSave,
  parseSave: save.parseSave,
};

export const EngineContext = createContext<GameEngine>(coreEngine);

/** The engine the app (or a test) provides; defaults to the real core. */
export function useEngine(): GameEngine {
  return useContext(EngineContext);
}

/**
 * Call a view and turn a thrown error (a core stub, a broken invariant) into
 * `fallback`, so one unfinished view never blanks a whole screen.
 */
export function safeView<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
