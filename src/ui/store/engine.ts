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
  presetsForClass: typeof tactics.presetsForClass;
  describeRule: typeof tactics.describeRule;
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
  presetsForClass: tactics.presetsForClass,
  describeRule: tactics.describeRule,
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
