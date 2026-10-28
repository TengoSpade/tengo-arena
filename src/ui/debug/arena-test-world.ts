/**
 * Test support: worlds and a scripted core for the arena screen tests. The core is a FAKE of what WP-M2B delivers
 * (liveRoundPlayback, roundPlayback, matchPlayback, replayAvailability, inspectPlayback, and `advance` with the watch
 * flow), small enough to read: the test says what each step returns. The dev world supplies the club, fixture and
 * squads (core/testkit fixtureMatchState gives a real MatchState), so the between-round screen and the report run on
 * real state shapes.
 */
import type { ContentDB } from '../../core/content';
import type { MatchPlayback, ReplayAvailability, RoundPlayback } from '../../core/game';
import type { ClubId, GameState, MatchState, RoundLineups, RoundResult, WeekReport } from '../../core/model';
import type { RoundProbe, UnitProbe } from '../../core/sim';
import { fixtureMatchState } from '../../core/testkit';
import { engineError, err, ok, type EngineError, type Result } from '../../core/util';
import { createDevEngine } from './dev-engine';
import { buildDevWorld } from './dev-world';
import type { GameEngine } from '../store/engine';
import { buildFightLog, type LogSpec, type LogUnit } from '../screens/arena/testing/fixture-log';

export interface WatchWorld {
  /** The dev world at matchweek 7 with the player's club chosen; no live match yet (Play match is next). */
  state: GameState;
  content: ContentDB;
  home: ClubId;
  away: ClubId;
  fixtureId: string;
  /** The player's side is always home here. */
  prepared: MatchState;
}

export function watchWorld(content: ContentDB): WatchWorld {
  const club = content.clubs.list[0]!.id as ClubId;
  const state = buildDevWorld(content, { playerClubId: club, weekIndex: 11 });
  const player = state.clubs[club]!;
  player.pauseBetweenRounds = 'always';
  const engine = createDevEngine();
  const fx = engine.clubFixture(state, club, state.calendar.weekIndex);
  if (!fx) throw new Error('the dev world has no fixture this week');
  // The player is always the home side in these tests (the arena's left side).
  const home = club;
  const away = (fx.homeClubId === club ? fx.awayClubId : fx.homeClubId) as ClubId;
  const prepared = fixtureMatchState(state, home, away, content);
  prepared.fixtureId = fx.id;
  return { state, content, home, away, fixtureId: fx.id, prepared };
}

export function roundResult(n: number, winner: 'home' | 'away'): RoundResult {
  return {
    round: n,
    seed: `r${n}`,
    winner,
    endReason: 'elimination',
    tiebreakStep: null,
    durationTicks: 1000,
    survivors: { home: winner === 'home' ? 3 : 0, away: winner === 'away' ? 2 : 0 },
    downs: { home: 2, away: 5 },
    finalHp: [],
    checksum: `sum${n}`,
    eventHash: null,
  } as unknown as RoundResult;
}

/** The world with the player's match locked and waiting to be watched at `round` (rounds before it already played). */
export function liveWatchState(w: WatchWorld, opts: { round?: number; cursorTick?: number; wins?: ('home' | 'away')[] } = {}): GameState {
  const state = structuredClone(w.state);
  const ms = structuredClone(w.prepared);
  const round = opts.round ?? 1;
  const wins = opts.wins ?? Array.from({ length: round - 1 }, () => 'home' as const);
  ms.rounds = wins.map((win, i) => roundResult(i + 1, win));
  ms.score = { home: wins.filter((x) => x === 'home').length, away: wins.filter((x) => x === 'away').length };
  ms.roundLineups = wins.map((_, i) => lineupsOf(ms, i + 1));
  ms.phase = 'round_pending';
  ms.watch = { mode: 'watch', round, cursorTick: opts.cursorTick ?? 0, calls: [] };
  state.liveMatch = ms;
  return state;
}

export function lineupsOf(ms: MatchState, round: number): RoundLineups {
  const side = (s: 'home' | 'away') => ({
    fighterIds: [...ms[s].active],
    rows: [...ms[s].rows],
    captainIndex: 0,
    viceCaptainIndex: 1,
    captainQuality: 50,
    freshness: ms[s].active.map(() => 100),
    entered: ms[s].active.map(() => false),
  });
  return { round, home: side('home'), away: side('away') };
}

export function logSpecOf(state: GameState, ms: MatchState, content: ContentDB, round: number): LogSpec {
  const unit = (side: 'home' | 'away', i: number): LogUnit => {
    const id = ms[side].active[i]!;
    return { fighterId: id, classId: state.fighters[id]!.classId, clubId: ms[side].clubId, slot: i, row: ms[side].rows[i]!, isCaptain: i === 0 };
  };
  const a1 = content.classAbility(state.fighters[ms.home.active[0]!]!.classId, 'a1').id;
  return { home: [0, 1, 2, 3, 4].map((i) => unit('home', i)), away: [0, 1, 2, 3, 4].map((i) => unit('away', i)), abilityId: a1, round };
}

export function roundPlaybackOf(state: GameState, content: ContentDB, kind: 'live' | 'replay', round: number): RoundPlayback {
  const ms = state.liveMatch!;
  const log = buildFightLog(logSpecOf(state, ms, content, round));
  const done = ms.rounds[round - 1];
  return {
    fixtureId: ms.fixtureId,
    round,
    kind,
    log,
    startTick: kind === 'live' ? (ms.watch?.cursorTick ?? 0) : 0,
    scoreBefore: kind === 'live' ? { ...ms.score } : { home: ms.rounds.slice(0, round - 1).filter((r) => r.winner === 'home').length, away: ms.rounds.slice(0, round - 1).filter((r) => r.winner === 'away').length },
    lineups: lineupsOf(ms, round),
    calls: null,
    result: kind === 'live' ? null : (done ?? null),
  };
}

export function probeOf(tick: number): RoundProbe {
  const unit = (i: number): UnitProbe => ({
    unit: i,
    standing: !(i === 3 && tick >= 400),
    hp: 100,
    maxHp: 100,
    shield: 0,
    focus: 50,
    cooldownTicks: { a1: i === 0 ? 40 : 0, a2: 0 },
    statuses: i === 0 ? [{ status: 'stun', ticksLeft: 20, stacks: 1, source: 5 }] : [],
    committed: { rule: 1, action: 'ability:a1', target: 5 },
    pending: null,
    evaluation: i === 3 && tick >= 400 ? null : { rule: 0, action: 'attack', target: 6, trace: [{ rule: 0, fired: true, skip: null, reason: null }] },
    blockedBy: i === 3 && tick >= 400 ? 'downed' : null,
  });
  return { tick, units: Array.from({ length: 10 }, (_, i) => unit(i)) };
}

export interface ScriptedCore {
  engine: GameEngine;
  /** Every call to advance, in order. */
  advances: { options: unknown; liveRound: number | null }[];
  /** Every call to inspectPlayback: [round, tick]. */
  inspects: [number, number][];
  /** Every match.watch command applied: the cursor saves and the mode switch. */
  watchCommands: { tick: number; mode?: 'watch' | 'simulate' }[];
  /** Replace what replayAvailability answers. */
  availability: ReplayAvailability;
  /** The log hash the scripted core expects for a committed round (the hash the fake log has). */
  hashOf(state: GameState, round: number): string;
  /** Make the next `advance` that would start or open a watched round fail (a stand-in for nothing: errors pass through). */
  failNext: EngineError | null;
}

const REPORT = (playerFixtureId: string | null): WeekReport => ({ season: 1, weekIndex: 11, playerFixtureId, levelUps: [] }) as unknown as WeekReport;

/**
 * The scripted core. `winners` says who wins each round (home = the player). The watch flow:
 *  - Play match (watch): a state with the locked match waiting at round 1, `watch` set.
 *  - advance({ watched }) with the right hash: commits the round, then the between-round step (club pause 'always'),
 *    or the next watched round, or the finished week.
 *  - advance() between rounds in a watched match: the next round locked and waiting.
 *  - advance() with a round waiting and no `watched`: refused with watch.not-shown.
 */
export function createScriptedCore(w: WatchWorld, opts: { winners?: ('home' | 'away')[]; base?: GameEngine } = {}): ScriptedCore {
  const base = opts.base ?? createDevEngine();
  const winners = opts.winners ?? ['home', 'home'];
  const advances: ScriptedCore['advances'] = [];
  const inspects: [number, number][] = [];
  const watchCommands: ScriptedCore['watchCommands'] = [];
  const self: ScriptedCore = {
    engine: base,
    advances,
    inspects,
    watchCommands,
    availability: { available: true, rounds: 2 },
    failNext: null,
    hashOf: (state, round) => buildFightLog(logSpecOf(state, state.liveMatch!, w.content, round)).hash,
  };
  const commit = (state: GameState, round: number): Result<{ state: GameState; week: WeekReport | null; pause: null; watch?: { fixtureId: string; round: number; cursorTick: number } | null }, EngineError> => {
    const next = structuredClone(state);
    const ms = next.liveMatch!;
    const win = winners[round - 1] ?? 'home';
    ms.rounds.push(roundResult(round, win));
    ms.roundLineups.push(lineupsOf(ms, round));
    ms.score = { home: ms.score.home + (win === 'home' ? 1 : 0), away: ms.score.away + (win === 'away' ? 1 : 0) };
    const decided = ms.score.home * 2 > ms.bestOf || ms.score.away * 2 > ms.bestOf;
    if (decided) {
      next.liveMatch = null;
      next.calendar = { ...next.calendar, weekIndex: next.calendar.weekIndex + 1 };
      return ok({ state: next, week: REPORT(ms.fixtureId), pause: null });
    }
    ms.phase = 'between_rounds';
    ms.watch = { mode: 'watch', round: null, cursorTick: 0, calls: [] };
    return ok({ state: next, week: null, pause: null });
  };
  const advance = ((state: GameState, _content: ContentDB, options?: { playerMatch?: 'watch' | 'simulate'; watched?: { round: number; logHash: string } }) => {
    advances.push({ options, liveRound: state.liveMatch?.watch?.round ?? null });
    if (self.failNext) {
      const e = self.failNext;
      self.failNext = null;
      return err(e);
    }
    const ms = state.liveMatch;
    if (!ms) {
      const next = structuredClone(state);
      next.liveMatch = structuredClone(w.prepared);
      if (options?.playerMatch === 'watch') {
        next.liveMatch.watch = { mode: 'watch', round: 1, cursorTick: 0, calls: [] };
        return ok({ state: next, week: null, pause: null, watch: { fixtureId: w.fixtureId, round: 1, cursorTick: 0 } });
      }
      return ok({ state: { ...next, liveMatch: null }, week: REPORT(w.fixtureId), pause: null });
    }
    const watch = ms.watch;
    if (watch?.mode === 'watch' && watch.round !== null) {
      if (!options?.watched) return err(engineError('watch.not-shown', 'The round has to be watched first', { fixtureId: ms.fixtureId, round: watch.round }));
      if (options.watched.round !== watch.round || options.watched.logHash !== self.hashOf(state, watch.round)) return err(engineError('watch.mismatch', 'The shown log differs'));
      return commit(state, watch.round);
    }
    if (watch?.mode === 'watch' && ms.phase === 'between_rounds') {
      const next = structuredClone(state);
      next.liveMatch!.phase = 'round_pending';
      next.liveMatch!.playerDecisions = null;
      next.liveMatch!.watch = { mode: 'watch', round: ms.rounds.length + 1, cursorTick: 0, calls: [] };
      return ok({ state: next, week: null, pause: null, watch: { fixtureId: ms.fixtureId, round: ms.rounds.length + 1, cursorTick: 0 } });
    }
    // Simulated rest: every remaining round commits at once.
    const next = structuredClone(state);
    return ok({ state: { ...next, liveMatch: null }, week: REPORT(ms.fixtureId), pause: null });
  }) as unknown as GameEngine['advance'];

  self.engine = {
    ...base,
    clubFixture: ((state: GameState, clubId: string, weekIndex: number) => base.clubFixture(state, clubId as ClubId, weekIndex)) as GameEngine['clubFixture'],
    advance,
    applyCommand: ((state: GameState, command: { type: string; tick?: number; mode?: 'watch' | 'simulate'; round?: number }, content: ContentDB) => {
      if (command.type !== 'match.watch') return base.applyCommand(state, command as never, content);
      const ms = state.liveMatch;
      if (!ms?.watch || ms.watch.round === null) return err(engineError('match.not-watching', 'No round is being watched'));
      watchCommands.push({ tick: command.tick ?? 0, mode: command.mode });
      const next = structuredClone(state);
      next.liveMatch!.watch = { ...ms.watch, cursorTick: Math.max(ms.watch.cursorTick, command.tick ?? 0), mode: command.mode ?? ms.watch.mode };
      return ok({ state: next, newsIds: [], response: null });
    }) as GameEngine['applyCommand'],
    liveRoundPlayback: ((state: GameState, content: ContentDB) => {
      const watch = state.liveMatch?.watch;
      if (!state.liveMatch) return err(engineError('match.not-live', 'No live match'));
      if (!watch || watch.mode !== 'watch' || watch.round === null) return err(engineError('match.not-watching', 'No round is being watched'));
      return ok(roundPlaybackOf(state, content, 'live', watch.round));
    }) as GameEngine['liveRoundPlayback'],
    roundPlayback: ((state: GameState, _fixtureId: string, round: number, content: ContentDB) => {
      const ms = state.liveMatch;
      if (!ms || !ms.rounds[round - 1]) return err(engineError('replay.no-round', 'No such round'));
      return ok(roundPlaybackOf(state, content, 'replay', round));
    }) as GameEngine['roundPlayback'],
    matchPlayback: ((state: GameState, fixtureId: string): Result<MatchPlayback, EngineError> => {
      const ms = state.liveMatch;
      if (!ms) return err(engineError('replay.unavailable', 'nope', { reason: 'not-played' }));
      const rounds = ms.rounds.map((r) => ({ round: r.round, winner: r.winner as 'home' | 'away' | null, durationTicks: r.durationTicks as number | null }));
      if (ms.watch?.round) rounds.push({ round: ms.watch.round, winner: null, durationTicks: null });
      return ok({ fixtureId: fixtureId as MatchPlayback['fixtureId'], bestOf: ms.bestOf, homeClubId: ms.home.clubId, awayClubId: ms.away.clubId, playerSide: 'home', kind: 'live', rounds, betweenRounds: [] });
    }) as GameEngine['matchPlayback'],
    replayAvailability: (() => self.availability) as GameEngine['replayAvailability'],
    inspectPlayback: ((_state: GameState, _fixtureId: string, round: number, tick: number) => {
      inspects.push([round, tick]);
      return ok(probeOf(tick));
    }) as GameEngine['inspectPlayback'],
  };
  return self;
}
