/**
 * The season engine over a set of module ports. core/game's public functions
 * are this engine bound to the real modules (realGamePorts); tests and the
 * pre-integration soak bind it to stand-ins or spies.
 */
import type { ContentDB } from '../content';
import { withDerivedMemo } from '../fighters';
import { beginTransition, type Blocker, type ClubId, type Command, type Fighter, type FighterId, type FixtureId, type GameState, type MatchInput, type SeasonEndReport, type WeekReport } from '../model';
import { NotImplementedError, ok, type EngineError, type Result } from '../util';
import { applyToDraft } from './commands';
import { buildMatchReport, prepareMatchInput, type DetailedMatchReport } from './match';
import type { GamePorts } from './ports';
import { processSeasonEnd, type SeasonEndOutcome } from './season-end';
import { newsSince } from './shared';
import { captaincyPreview, fighterView, freeAgents, getBlockers, releasePreview, roster, suggestLineup, type CaptaincyPreview, type FighterView, type ReleasePreview } from './views';
import { processWeek, type LiveWeekOutcome, type WeekOutcome } from './week';
import { advanceLoggedWith, advanceWith, betweenRoundViewWith, levelUpViewWith, type AdvanceOutcome, type LevelUpView } from './live';
import type { BetweenRoundView } from './orchestrator';
import type { RoundProbe } from '../sim';
import {
  inspectPlaybackWith,
  liveRoundPlaybackWith,
  matchPlaybackWith,
  replayAvailabilityWith,
  roundPlaybackWith,
  type AdvanceOptions,
  type MatchPlayback,
  type ReplayAvailability,
  type RoundPlayback,
} from './playback';
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
  buildMatchReport(state: GameState, fixtureId: FixtureId, content: ContentDB): Result<DetailedMatchReport, EngineError>;
  roster(state: GameState, clubId: ClubId, content?: ContentDB): Fighter[];
  fighterView(state: GameState, fighterId: FighterId, content: ContentDB): FighterView;
  freeAgents(state: GameState, content?: ContentDB): Fighter[];
  suggestLineup(state: GameState, clubId: ClubId, content: ContentDB): Command;
  releasePreview(state: GameState, clubId: ClubId, fighterId: FighterId, content: ContentDB): ReleasePreview | null;
  captaincyPreview(state: GameState, clubId: ClubId, captainId: FighterId | null, viceCaptainId: FighterId | null, content: ContentDB): CaptaincyPreview | null;
  // ---- M1.1 ----
  /** Continue: the week, or the next pause of the player's match (05 M1.1 addendum). M2: `options` (05-technical-m2 §A3). */
  advance(state: GameState, content: ContentDB, options?: AdvanceOptions): Result<AdvanceOutcome, EngineError>;
  advanceLogged(state: GameState, content: ContentDB): Result<LiveWeekOutcome, EngineError>;
  betweenRoundView(state: GameState, content: ContentDB): BetweenRoundView | null;
  levelUpView(state: GameState, fighterId: FighterId, content: ContentDB): LevelUpView | null;
  // ---- M2 contract (stubs until WP-M2B; 05-technical-m2 §A3) ----
  liveRoundPlayback(state: GameState, content: ContentDB): Result<RoundPlayback, EngineError>;
  roundPlayback(state: GameState, fixtureId: FixtureId, round: number, content: ContentDB): Result<RoundPlayback, EngineError>;
  matchPlayback(state: GameState, fixtureId: FixtureId, content: ContentDB): Result<MatchPlayback, EngineError>;
  replayAvailability(state: GameState, fixtureId: FixtureId, content: ContentDB): ReplayAvailability;
  inspectPlayback(state: GameState, fixtureId: FixtureId, round: number, tick: number, content: ContentDB): Result<RoundProbe, EngineError>;
}

export function createGameEngine(ports: GamePorts): GameEngine {
  return {
    ports,
    createWorld: (content, params) => {
      try {
        return withDerivedMemo(() => createWorld(ports, content, params));
      } catch (e) {
        if (e instanceof NotImplementedError) throw e; // a stubbed module: callers (UI dev fallback, soak) handle it
        return { ok: false, error: { code: 'engine.failure', message: `World generation failed: ${e instanceof Error ? e.message : String(e)}` } };
      }
    },
    applyCommand: (state, command, content) => withDerivedMemo(() => {
      const draft = beginTransition(state);
      const from = draft.ids.news;
      let r: Result<OfferResponse | null, EngineError>;
      try {
        r = applyToDraft(ports, draft, command, content);
      } catch (e) {
        if (e instanceof NotImplementedError) throw e; // a stubbed module: callers (UI dev fallback, soak) handle it
        return { ok: false, error: { code: 'engine.failure', message: `Command ${command.type} failed: ${e instanceof Error ? e.message : String(e)}` } };
      }
      if (!r.ok) return r;
      return ok({ state: draft, newsIds: newsSince(draft, from), response: r.value });
    }),
    getBlockers: (state, content) => getBlockers(ports, state, content),
    advanceWeek: (state, content) => {
      const r = withDerivedMemo(() => processWeek(ports, state, content));
      return r.ok ? ok({ state: r.value.state, report: r.value.report }) : r;
    },
    advanceWeekLogged: (state, content) => withDerivedMemo(() => processWeek(ports, state, content)),
    runSeasonEnd: (state, content) => {
      const r = withDerivedMemo(() => processSeasonEnd(ports, state, content));
      return r.ok ? ok({ state: r.value.state, report: r.value.report }) : r;
    },
    runSeasonEndLogged: (state, content) => withDerivedMemo(() => processSeasonEnd(ports, state, content)),
    prepareMatchInput: (state, fixtureId, content) => prepareMatchInput(ports, state, fixtureId, content),
    buildMatchReport: (state, fixtureId, content) => buildMatchReport(ports, state, fixtureId, content),
    roster: (state, clubId, content) => roster(ports, state, clubId, content),
    fighterView: (state, fighterId, content) => fighterView(ports, state, fighterId, content),
    freeAgents: (state, content) => freeAgents(ports, state, content),
    suggestLineup: (state, clubId, content) => suggestLineup(ports, state, clubId, content),
    releasePreview: (state, clubId, fighterId, content) => releasePreview(ports, state, clubId, fighterId, content),
    captaincyPreview: (state, clubId, captainId, viceCaptainId, content) => captaincyPreview(ports, state, clubId, captainId, viceCaptainId, content),
    advance: (state, content, options) => withDerivedMemo(() => advanceWith(ports, state, content, options)),
    advanceLogged: (state, content) => withDerivedMemo(() => advanceLoggedWith(ports, state, content)),
    betweenRoundView: (state, content) => betweenRoundViewWith(ports, state, content),
    levelUpView: (state, fighterId, content) => levelUpViewWith(ports, state, fighterId, content),
    liveRoundPlayback: (state, content) => liveRoundPlaybackWith(ports, state, content),
    roundPlayback: (state, fixtureId, round, content) => roundPlaybackWith(ports, state, fixtureId, round, content),
    matchPlayback: (state, fixtureId, content) => matchPlaybackWith(ports, state, fixtureId, content),
    replayAvailability: (state, fixtureId, content) => replayAvailabilityWith(ports, state, fixtureId, content),
    inspectPlayback: (state, fixtureId, round, tick, content) => inspectPlaybackWith(ports, state, fixtureId, round, tick, content),
  };
}
