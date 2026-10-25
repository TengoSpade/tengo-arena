/**
 * The season engine over a set of module ports. core/game's public functions
 * are this engine bound to the real modules (realGamePorts); tests and the
 * pre-integration soak bind it to stand-ins or spies.
 */
import type { ContentDB } from '../content';
import type { Blocker, ClubId, Command, Fighter, FighterId, FixtureId, GameState, MatchInput, MatchReport, SeasonEndReport, WeekReport } from '../model';
import { cloneJson, ok, type EngineError, type Result } from '../util';
import { applyToDraft } from './commands';
import { buildMatchReport, prepareMatchInput } from './match';
import type { GamePorts } from './ports';
import { processSeasonEnd, type SeasonEndOutcome } from './season-end';
import { newsSince } from './shared';
import { fighterView, freeAgents, getBlockers, roster, suggestLineup, type FighterView } from './views';
import { processWeek, type WeekOutcome } from './week';
import { createWorld, type NewGameParams } from './world';
import type { OfferResponse, NewsId } from '../model';

export interface CommandOutcome {
  state: GameState;
  newsIds: NewsId[];
  /** Instant answers (renewals, trials signings) or 'pending' for free-agent offers. */
  response: OfferResponse | null;
}

export interface GameEngine {
  readonly ports: GamePorts;
  createWorld(content: ContentDB, params: NewGameParams): Result<GameState, EngineError>;
  applyCommand(state: GameState, command: Command, content: ContentDB): Result<CommandOutcome, EngineError>;
  getBlockers(state: GameState, content: ContentDB): Blocker[];
  advanceWeek(state: GameState, content: ContentDB): Result<{ state: GameState; report: WeekReport }, EngineError>;
  /** advanceWeek with the AI-phase diagnostics (refused AI commands). */
  advanceWeekLogged(state: GameState, content: ContentDB): Result<WeekOutcome, EngineError>;
  runSeasonEnd(state: GameState, content: ContentDB): Result<{ state: GameState; report: SeasonEndReport }, EngineError>;
  runSeasonEndLogged(state: GameState, content: ContentDB): Result<SeasonEndOutcome, EngineError>;
  prepareMatchInput(state: GameState, fixtureId: FixtureId, content: ContentDB): Result<MatchInput, EngineError>;
  buildMatchReport(state: GameState, fixtureId: FixtureId, content: ContentDB): Result<MatchReport, EngineError>;
  roster(state: GameState, clubId: ClubId, content?: ContentDB): Fighter[];
  fighterView(state: GameState, fighterId: FighterId, content: ContentDB): FighterView;
  freeAgents(state: GameState, content?: ContentDB): Fighter[];
  suggestLineup(state: GameState, clubId: ClubId, content: ContentDB): Command;
}

export function createGameEngine(ports: GamePorts): GameEngine {
  return {
    ports,
    createWorld: (content, params) => {
      try {
        return createWorld(ports, content, params);
      } catch (e) {
        return { ok: false, error: { code: 'engine.failure', message: `World generation failed: ${e instanceof Error ? e.message : String(e)}` } };
      }
    },
    applyCommand: (state, command, content) => {
      const draft = cloneJson(state);
      const from = draft.ids.news;
      let r: Result<OfferResponse | null, EngineError>;
      try {
        r = applyToDraft(ports, draft, command, content);
      } catch (e) {
        return { ok: false, error: { code: 'engine.failure', message: `Command ${command.type} failed: ${e instanceof Error ? e.message : String(e)}` } };
      }
      if (!r.ok) return r;
      return ok({ state: draft, newsIds: newsSince(draft, from), response: r.value });
    },
    getBlockers: (state, content) => getBlockers(ports, state, content),
    advanceWeek: (state, content) => {
      const r = processWeek(ports, state, content);
      return r.ok ? ok({ state: r.value.state, report: r.value.report }) : r;
    },
    advanceWeekLogged: (state, content) => processWeek(ports, state, content),
    runSeasonEnd: (state, content) => {
      const r = processSeasonEnd(ports, state, content);
      return r.ok ? ok({ state: r.value.state, report: r.value.report }) : r;
    },
    runSeasonEndLogged: (state, content) => processSeasonEnd(ports, state, content),
    prepareMatchInput: (state, fixtureId, content) => prepareMatchInput(ports, state, fixtureId, content),
    buildMatchReport: (state, fixtureId, content) => buildMatchReport(ports, state, fixtureId, content),
    roster: (state, clubId, content) => roster(ports, state, clubId, content),
    fighterView: (state, fighterId, content) => fighterView(ports, state, fighterId, content),
    freeAgents: (state, content) => freeAgents(ports, state, content),
    suggestLineup: (state, clubId, content) => suggestLineup(ports, state, clubId, content),
  };
}
