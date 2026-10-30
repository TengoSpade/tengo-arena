/**
 * WP-M2B: the watch flow (docs/design/_drafts/05-technical-m2.md §A3, §A11; owner answer to Q60, option A).
 *
 * Test-first item 1: a season played with Watch gives the same round checksums and the same final state as the same
 * season played with Simulate, with player swaps, injuries, emergency entrants and captain handovers. The watched
 * season also reloads its save at every round waiting to be watched (the required autosave), moves the cursor and
 * reloads again (a resume), and simulates the rest of one match. Every committed round of the player's matches then
 * replays to its stored checksum with the same log hash the viewer was given while watching (replay = original).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { asId, type ClubId, type FixtureId, type GameState, type MatchResult, type MatchState, type RoundInput, type SwapDecision } from '../model';
import { loadContent } from '../content';
import { simContentHash } from '../sim';
import { FIXTURE_CONTENT_RAW, fixtureContent } from '../testkit';
import { cloneJson, hashString, stableStringify } from '../util';
import { createGameEngine, createStandInPorts, prepareRound, realGamePorts, roundInputOf as roundInputOfResult, type BetweenRoundView, type GameEngine, type GamePorts } from './index';

const content = fixtureContent();

const sideOf = (s: GameState, ms: MatchState): 'home' | 'away' | null => (ms.home.clubId === s.playerClubId ? 'home' : ms.away.clubId === s.playerClubId ? 'away' : null);

/**
 * Real modules, plus scripted injuries in the player's matches of odd matchweeks: his acting captain after round 1
 * (a forced swap and a captain handover) and another fighter after round 2 (with both swaps used, an emergency entrant).
 * Deterministic in the state, so both seasons get exactly the same injuries.
 */
function scriptedPorts(): GamePorts {
  const real = realGamePorts.fighters;
  return {
    ...realGamePorts,
    fighters: {
      ...real,
      injuriesAfterRound: (draft, ms, outcome, c) => {
        const hurt = real.injuriesAfterRound(draft, ms, outcome, c);
        const side = sideOf(draft, ms);
        const fx = draft.fixtures[ms.fixtureId];
        if (side === null || !fx || fx.matchweek === null || fx.matchweek % 2 === 0) return hurt;
        const s = ms[side];
        const round = outcome.result.round;
        const pick = round === 1 ? s.actingCaptainId : round === 2 ? (s.active.find((id) => id !== s.actingCaptainId && !s.injured.includes(id)) ?? null) : null;
        if (pick === null || hurt.includes(pick) || s.injured.includes(pick)) return hurt;
        const f = draft.fighters[pick]!;
        if (f.injury) return hurt;
        f.injury = { severity: 'minor', weeksOut: 1, fixtureId: ms.fixtureId, round, causeFighterId: null, damageBp: 0, since: { season: draft.calendar.season, weekIndex: draft.calendar.weekIndex } };
        return [...hurt, pick];
      },
    },
  };
}

/** The player's swap at the first step: his most tired healthy fighter for a fit reserve, keeping one for each forced swap. */
function decide(view: BetweenRoundView): SwapDecision[] {
  const side = view.playerSide!;
  const v = view[side];
  const fit = v.reserves.filter((r) => r.fit);
  const forced = v.forced.length;
  if (view.afterRound !== 1 || v.swapsLeft <= forced || fit.length <= forced) return [];
  const tired = v.active.filter((a) => !a.injured).sort((a, b) => a.freshness - b.freshness || a.slot - b.slot)[0];
  return tired ? [{ out: tired.fighterId, in: fit[0]!.fighterId }] : [];
}

function must<T>(r: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value;
}

const checksumState = (s: GameState): string => hashString(stableStringify(s));

/**
 * The required autosave and a reload: the state as JSON and back, which is what a save holds (core/game tests may not
 * import core/save; the real save and load of a watched round are tested in core/harness soak.test.ts).
 */
function reload(_engine: GameEngine, s: GameState): GameState {
  const loaded = cloneJson(s);
  expect(checksumState(loaded)).toBe(checksumState(s));
  return loaded;
}

function careerAtMw1(engine: GameEngine, seed: string): GameState {
  const w = must(engine.createWorld(content, { rootSeed: seed }));
  const club = Object.keys(w.clubs).sort()[2] as ClubId;
  let s = must(engine.applyCommand(w, { type: 'club.choose', clubId: club }, content)).state;
  s = must(engine.applyCommand(s, { type: 'pacing.set', clubId: club, levelUpPacing: 'fast', pauseBetweenRounds: 'always' }, content)).state;
  for (let guard = 0; guard < 10 && s.calendar.weekId !== 'MW1'; guard++) s = must(engine.advanceWeek(s, content)).state;
  return s;
}

function unblock(engine: GameEngine, s: GameState): GameState {
  if (engine.getBlockers(s, content).length === 0) return s;
  return must(engine.applyCommand(s, engine.suggestLineup(s, s.playerClubId!, content), content)).state;
}

function swapAtPause(engine: GameEngine, s: GameState, view: BetweenRoundView): GameState {
  const swaps = decide(view);
  if (swaps.length === 0) return s;
  return must(engine.applyCommand(s, { type: 'match.swap', clubId: s.playerClubId!, fixtureId: view.fixtureId, afterRound: view.afterRound, swaps }, content)).state;
}

interface Season {
  final: GameState;
  /** The hash of every log the viewer was given, by "fixtureId#round" (Watch only). */
  shown: Map<string, string>;
  watchedRounds: number;
  simulatedRest: number;
}

function simulateSeason(engine: GameEngine, start: GameState): Season {
  let s = start;
  for (let guard = 0; guard < 40 && s.calendar.phase !== 'season-end'; guard++) {
    s = unblock(engine, s);
    let r = must(engine.advance(s, content));
    for (let steps = 0; r.week === null; steps++) {
      if (steps > 12) throw new Error('the week never finished');
      expect(r.watch ?? null).toBeNull();
      s = swapAtPause(engine, r.state, r.pause!);
      r = must(engine.advance(s, content));
    }
    s = r.state;
  }
  return { final: s, shown: new Map(), watchedRounds: 0, simulatedRest: 0 };
}

function watchSeason(engine: GameEngine, start: GameState, simulateRestInMatchweek: number): Season {
  let s = start;
  const shown = new Map<string, string>();
  let watchedRounds = 0;
  let simulatedRest = 0;
  for (let guard = 0; guard < 40 && s.calendar.phase !== 'season-end'; guard++) {
    s = unblock(engine, s);
    let r = must(engine.advance(s, content, { playerMatch: 'watch' }));
    for (let steps = 0; r.week === null; steps++) {
      if (steps > 20) throw new Error('the week never finished');
      if (r.pause) {
        s = swapAtPause(engine, r.state, r.pause);
        r = must(engine.advance(s, content));
        continue;
      }
      // A round waits to be watched: nothing of it is in the state; the autosave and a reload come first.
      const w = r.watch!;
      expect(r.state.liveMatch!.rounds).toHaveLength(w.round - 1);
      expect(w.cursorTick).toBe(0);
      s = reload(engine, r.state);
      const live = must(engine.liveRoundPlayback(s, content));
      expect(live).toMatchObject({ fixtureId: w.fixtureId, round: w.round, kind: 'live', startTick: 0, result: null, calls: null });
      expect(live.log.events.some((e) => e.type === 'fight.end')).toBe(true);
      const fx = s.fixtures[w.fixtureId]!;
      if (fx.matchweek === simulateRestInMatchweek && w.round === 1) {
        // "Simulate the rest": the mode changes first, then the round commits from its locked inputs without a hash.
        s = must(engine.applyCommand(s, { type: 'match.watch', clubId: s.playerClubId!, fixtureId: w.fixtureId, round: w.round, tick: 120, mode: 'simulate' }, content)).state;
        simulatedRest++;
        r = must(engine.advance(s, content));
        continue;
      }
      // Playback stops a third of the way in: the cursor is saved, the game reloaded, and the viewer resumes there.
      const tick = Math.max(1, Math.trunc(live.log.events[live.log.events.length - 1]!.tick / 3));
      s = reload(engine, must(engine.applyCommand(s, { type: 'match.watch', clubId: s.playerClubId!, fixtureId: w.fixtureId, round: w.round, tick }, content)).state);
      const resumed = must(engine.liveRoundPlayback(s, content));
      expect(resumed.startTick).toBe(tick);
      expect(resumed.log.hash).toBe(live.log.hash);
      shown.set(`${w.fixtureId}#${w.round}`, live.log.hash);
      watchedRounds++;
      r = must(engine.advance(s, content, { watched: { round: w.round, logHash: resumed.log.hash } }));
    }
    s = r.state;
  }
  return { final: s, shown, watchedRounds, simulatedRest };
}

const roundChecksums = (s: GameState): Record<string, string[]> =>
  Object.fromEntries(
    Object.values(s.results)
      .sort((a, b) => (a.fixtureId < b.fixtureId ? -1 : 1))
      .map((r) => [r.fixtureId, r.rounds.map((x) => x.checksum)]),
  );

describe('Watch season = Simulate season (test-first item 1; vis-009, P-05)', () => {
  const engine = createGameEngine(scriptedPorts());
  let start: GameState;
  let watched: Season;
  let simulated: Season;
  beforeAll(() => {
    start = careerAtMw1(engine, 'watch-season-1');
    simulated = simulateSeason(engine, start);
    watched = watchSeason(engine, start, 5);
  }, 600_000);

  it('identical round checksums and final state, with player swaps, injuries, emergency entrants and captain handovers', () => {
    expect(watched.final.calendar.phase).toBe('season-end');
    expect(watched.watchedRounds).toBeGreaterThan(20);
    expect(watched.simulatedRest).toBe(1);
    expect(roundChecksums(watched.final)).toEqual(roundChecksums(simulated.final));
    expect(checksumState(watched.final)).toBe(checksumState(simulated.final));
    // Committed rounds never store an event hash, watched ones included; no round was played with a call plan (core/sim
    // refuses any but none until the calls package, and prepareRound never builds one: 'match.call' is refused).
    for (const r of Object.values(watched.final.results)) {
      for (const x of r.rounds) expect(x.eventHash).toBeNull();
      for (const l of r.roundLineups ?? []) expect(l.calls).toBeUndefined();
    }
    // What the season exercised (the player's matches).
    const club = watched.final.playerClubId!;
    const mine = Object.values(watched.final.results).filter((r) => r.homeClubId === club || r.awayClubId === club);
    const sideKey = (r: MatchResult): 'home' | 'away' => (r.homeClubId === club ? 'home' : 'away');
    const steps = mine.flatMap((r) => (r.betweenRounds ?? []).map((b) => ({ r, b, side: sideKey(r) })));
    expect(steps.flatMap(({ b, side }) => b[side]).filter((x) => x.reason === 'player').length).toBeGreaterThan(0);
    expect(steps.flatMap(({ b, side }) => b[side]).filter((x) => x.reason === 'injury').length).toBeGreaterThan(0);
    expect(steps.flatMap(({ b, side }) => b[side]).filter((x) => x.reason === 'emergency').length).toBeGreaterThan(0);
    expect(mine.some((r) => (r.emergencyEntrants ?? []).length > 0)).toBe(true);
    // Captain handover between rounds: the acting captain is not the club's captain after the captain was injured.
    expect(steps.some(({ r, b, side }) => b.actingCaptain[side] !== null && b.actingCaptain[side] !== r.squads![side].captainId)).toBe(true);
  });

  it('replay = original: every committed round of the player\'s matches re-simulates to its checksum, with the log hash shown while watching', () => {
    const s = watched.final;
    let checked = 0;
    let handovers = 0;
    for (const [key, hash] of watched.shown) {
      const [fixtureId, round] = key.split('#') as [FixtureId, string];
      const replay = must(engine.roundPlayback(s, fixtureId, Number(round), content));
      expect(replay.kind).toBe('replay');
      expect(replay.result!.checksum).toBe(s.results[fixtureId]!.rounds[Number(round) - 1]!.checksum);
      expect(replay.log.hash).toBe(hash);
      handovers += replay.log.events.filter((e) => e.type === 'captain.handover').length;
      checked++;
    }
    expect(checked).toBe(watched.shown.size);
    expect(handovers).toBeGreaterThan(0); // in-fight handovers (the captain downed) were shown and replay too
    // Simulated matches between other clubs replay the same way while they are kept in full.
    const other = Object.values(s.results).find((r) => replayable(engine, s, r.fixtureId) && r.homeClubId !== s.playerClubId && r.awayClubId !== s.playerClubId)!;
    for (const x of other.rounds) expect(must(engine.roundPlayback(s, other.fixtureId, x.round, content)).result!.checksum).toBe(x.checksum);
    const m = must(engine.matchPlayback(s, other.fixtureId, content));
    expect(m).toMatchObject({ kind: 'replay', playerSide: null, homeClubId: other.homeClubId, awayClubId: other.awayClubId });
    expect(m.rounds.map((x) => x.winner)).toEqual(other.rounds.map((x) => x.winner));
  });

  it('the Simulate season stored the same rounds the Watch season showed', () => {
    for (const [key, hash] of watched.shown) {
      const [fixtureId, round] = key.split('#') as [FixtureId, string];
      expect(must(engine.roundPlayback(simulated.final, fixtureId, Number(round), content)).log.hash).toBe(hash);
    }
  });
});

function replayable(engine: GameEngine, s: GameState, fixtureId: FixtureId): boolean {
  return engine.replayAvailability(s, fixtureId, content).available;
}

// ---- the commit point, step by step -------------------------------------------------------------------------------

describe('the commit of a watched round (§A11 commit check; every build)', () => {
  const engine = createGameEngine(realGamePorts);
  let mw1: GameState;
  beforeAll(() => {
    mw1 = careerAtMw1(engine, 'watch-commit-1');
  }, 120_000);

  function startWatching(): { s: GameState; round: number; hash: string; fixtureId: FixtureId } {
    const r = must(engine.advance(unblock(engine, mw1), content, { playerMatch: 'watch' }));
    expect(r.week).toBeNull();
    expect(r.pause).toBeNull();
    const w = r.watch!;
    const live = must(engine.liveRoundPlayback(r.state, content));
    return { s: r.state, round: w.round, hash: live.log.hash, fixtureId: w.fixtureId };
  }

  it('Play match (Watch) locks the squads and stops before round 1: nothing of the round, and nothing of the week, is in the state', () => {
    const { s, round, fixtureId } = startWatching();
    expect(round).toBe(1);
    const ms = s.liveMatch!;
    expect(ms).toMatchObject({ fixtureId, phase: 'round_pending', rounds: [], score: { home: 0, away: 0 }, watch: { mode: 'watch', round: 1, cursorTick: 0, calls: [] } });
    expect(ms.fighterStats).toEqual({});
    expect(Object.keys(s.results)).toEqual(Object.keys(mw1.results));
    expect(s.calendar).toEqual(mw1.calendar);
    // The squads are locked: club decisions wait; settings and the watch cursor do not.
    expect(engine.getBlockers(s, content)).toEqual([]);
    const club = s.playerClubId!;
    const starter = s.clubs[club]!.lineup.fighters[0]!.fighterId;
    const refused = engine.applyCommand(s, { type: 'roster.release', clubId: club, fighterId: starter }, content);
    expect(refused.ok ? null : refused.error.code).toBe('match.in-progress');
    // A live playback never carries the outcome.
    const live = must(engine.liveRoundPlayback(s, content));
    expect(live.result).toBeNull();
    expect(live.lineups!.round).toBe(1);
    expect(must(engine.matchPlayback(s, fixtureId, content)).rounds).toEqual([{ round: 1, winner: null, durationTicks: null }]);
    expect(engine.replayAvailability(s, fixtureId, content)).toEqual({ available: false, reason: 'live' });
  });

  it('refuses without a shown log (watch.not-shown) and with a log that is not the round\'s (watch.mismatch); no state either way', () => {
    const { s, round, hash, fixtureId } = startWatching();
    const before = checksumState(s);
    const noLog = engine.advance(s, content);
    expect(noLog.ok ? null : noLog.error).toMatchObject({ code: 'watch.not-shown', details: { fixtureId, round } });
    const wrong = engine.advance(s, content, { watched: { round, logHash: `${hash}x` } });
    expect(wrong.ok ? null : wrong.error).toMatchObject({ code: 'watch.mismatch', details: { fixtureId, round, reason: 'log' } });
    const otherRound = engine.advance(s, content, { watched: { round: round + 1, logHash: hash } });
    expect(otherRound.ok ? null : otherRound.error).toMatchObject({ code: 'watch.mismatch', details: { reason: 'round' } });
    // advanceWeek cannot stop at a round, so it would commit one unshown.
    const week = engine.advanceWeek(s, content);
    expect(week.ok ? null : week.error.code).toBe('watch.not-shown');
    // A playerMatch option on a match already locked changes nothing.
    const again = engine.advance(s, content, { playerMatch: 'watch' });
    expect(again.ok ? null : again.error.code).toBe('watch.not-shown');
    expect(checksumState(s)).toBe(before);
  });

  it('commits with the shown log, exactly what a simulated match commits; a repeated or stale commit is refused', () => {
    const { s, round, hash } = startWatching();
    const r = must(engine.advance(s, content, { watched: { round, logHash: hash } }));
    const ms = r.state.liveMatch;
    // Round 1 is committed (P-05): its result, the Freshness drain and XP are in the state.
    const committed = ms ? ms.rounds[0]! : null;
    expect(committed ?? null).not.toBeNull();
    // The same week with Simulate, decided the same way at the first step, commits the same round.
    const sim = must(engine.advance(unblock(engine, mw1), content));
    expect(sim.state.liveMatch!.rounds[0]).toEqual(committed);
    expect(sim.state.fighters).toEqual(r.state.fighters);
    expect(r.pause).toEqual(sim.pause);
    // The same commit again: no watched round is waiting any more.
    const repeat = engine.advance(r.state, content, { watched: { round, logHash: hash } });
    expect(repeat.ok ? null : repeat.error).toMatchObject({ code: 'watch.mismatch', details: { reason: 'round' } });
    // A stale finishRound with no match at all never starts a week.
    const stale = engine.advance(mw1, content, { watched: { round: 1, logHash: hash } });
    expect(stale.ok ? null : stale.error).toMatchObject({ code: 'watch.mismatch', details: { reason: 'round', round: null } });
  });

  it('after "Simulate the rest" the round commits without a hash, with the same result as watching it; Watch never comes back', () => {
    const { s, round, hash, fixtureId } = startWatching();
    const club = s.playerClubId!;
    const switched = must(engine.applyCommand(s, { type: 'match.watch', clubId: club, fixtureId, round, tick: 75, mode: 'simulate' }, content)).state;
    expect(switched.liveMatch!.watch).toEqual({ mode: 'simulate', round: null, cursorTick: 75, calls: [] });
    expect(engine.liveRoundPlayback(switched, content)).toMatchObject({ ok: false, error: { code: 'match.not-watching' } });
    const back = engine.applyCommand(switched, { type: 'match.watch', clubId: club, fixtureId, round, tick: 80, mode: 'watch' }, content);
    expect(back.ok ? null : back.error.code).toBe('match.not-watching');
    const rest = must(engine.advance(switched, content));
    const viaWatch = must(engine.advance(s, content, { watched: { round, logHash: hash } }));
    expect((rest.state.liveMatch ?? null)?.rounds[0] ?? rest.state.results[fixtureId]!.rounds[0]).toEqual(
      (viaWatch.state.liveMatch ?? null)?.rounds[0] ?? viaWatch.state.results[fixtureId]!.rounds[0],
    );
    expect(rest.state.fighters).toEqual(viaWatch.state.fighters);
    // From here on the match is simulated (the M1.1 flow): between rounds it pauses per pacing, never for the viewer.
    expect(rest.watch).toBeNull();
    if (rest.state.liveMatch) expect(rest.state.liveMatch.watch).toMatchObject({ mode: 'simulate', round: null });
  });

  it('a whole watched week equals the simulated week (auto suggestions accepted at each step)', () => {
    const play = (watch: boolean): GameState => {
      let r = must(engine.advance(unblock(engine, mw1), content, watch ? { playerMatch: 'watch' } : {}));
      for (let i = 0; i < 12 && r.week === null; i++) {
        if (r.watch) {
          const live = must(engine.liveRoundPlayback(r.state, content));
          r = must(engine.advance(r.state, content, { watched: { round: r.watch.round, logHash: live.log.hash } }));
        } else r = must(engine.advance(r.state, content));
      }
      expect(r.week).not.toBeNull();
      return r.state;
    };
    expect(checksumState(play(true))).toBe(checksumState(play(false)));
  });
});

describe('the watch cursor (match.watch) and the resume', () => {
  const engine = createGameEngine(realGamePorts);
  let s: GameState;
  let fixtureId: FixtureId;
  beforeAll(() => {
    const mw1 = careerAtMw1(engine, 'watch-cursor-1');
    const r = must(engine.advance(unblock(engine, mw1), content, { playerMatch: 'watch' }));
    s = r.state;
    fixtureId = r.watch!.fixtureId;
  }, 120_000);

  const watch = (state: GameState, extra: Partial<{ clubId: ClubId; fixtureId: FixtureId; round: number; tick: number; mode: 'watch' | 'simulate' }>) =>
    engine.applyCommand(state, { type: 'match.watch', clubId: state.playerClubId!, fixtureId, round: 1, tick: 0, ...extra }, content);

  it('moves the reveal frontier forward only (a stop after a rewind keeps it), within the round time cap; it changes nothing else', () => {
    const a = must(watch(s, { tick: 300 })).state;
    expect(a.liveMatch!.watch).toEqual({ mode: 'watch', round: 1, cursorTick: 300, calls: [] });
    expect({ ...a.liveMatch!, watch: undefined }).toEqual({ ...s.liveMatch!, watch: undefined });
    expect(must(watch(a, { tick: 300 })).state.liveMatch!.watch!.cursorTick).toBe(300);
    // The player rewound within the live round (§A3) and paused at 120: the stop is accepted, the frontier stays at 300.
    const rewound = must(watch(a, { tick: 120 })).state;
    expect(rewound.liveMatch!.watch).toEqual({ mode: 'watch', round: 1, cursorTick: 300, calls: [] });
    expect(must(engine.liveRoundPlayback(rewound, content)).startTick).toBe(300);
    expect(must(watch(rewound, { tick: 450 })).state.liveMatch!.watch!.cursorTick).toBe(450);
    const cap = Math.round(content.combat.overtime.hardCapS * content.combat.tick.ticksPerSecond);
    expect(watch(a, { tick: cap }).ok).toBe(true);
    for (const tick of [cap + 1, -1, 1.5]) {
      const r = watch(a, { tick });
      expect(r.ok ? null : r.error.code).toBe('watch.tick');
    }
    const round = watch(a, { round: 2, tick: 400 });
    expect(round.ok ? null : round.error.code).toBe('watch.round');
    const otherClub = Object.keys(s.clubs).find((c) => c !== s.playerClubId) as ClubId;
    const notPlayer = watch(a, { clubId: otherClub, tick: 400 });
    expect(notPlayer.ok ? null : notPlayer.error.code).toBe('match.not-player-club');
    const otherFixture = watch(a, { fixtureId: asId<FixtureId>('lg:1:x'), tick: 400 });
    expect(otherFixture.ok ? null : otherFixture.error.code).toBe('match.not-live');
    // The input of the round waiting to be watched is the same before and after the cursor moved.
    const pre = must(engine.liveRoundPlayback(s, content));
    const post = must(engine.liveRoundPlayback(a, content));
    expect(post.log.hash).toBe(pre.log.hash);
    expect(post.startTick).toBe(300);
  });

  it('resume: save at the cursor, load, liveRoundPlayback gives the same log at the cursor and the same committed result', () => {
    const at = must(watch(s, { tick: 340 })).state;
    const loaded = reload(engine, at);
    const a = must(engine.liveRoundPlayback(at, content));
    const b = must(engine.liveRoundPlayback(loaded, content));
    expect(b.log.hash).toBe(a.log.hash);
    expect(b.startTick).toBe(340);
    expect(b.scoreBefore).toEqual({ home: 0, away: 0 });
    const ca = must(engine.advance(at, content, { watched: { round: 1, logHash: a.log.hash } }));
    const cb = must(engine.advance(loaded, content, { watched: { round: 1, logHash: b.log.hash } }));
    expect(checksumState(cb.state)).toBe(checksumState(ca.state));
  });

  it('a match without Watch is never watched: no cursor, no live playback, advance needs no hash', () => {
    const mw1 = careerAtMw1(engine, 'watch-cursor-1');
    const r = must(engine.advance(unblock(engine, mw1), content));
    expect(r.watch).toBeNull();
    const live = r.state.liveMatch;
    if (!live) return;
    expect(live.watch).toBeUndefined();
    expect(engine.liveRoundPlayback(r.state, content)).toMatchObject({ ok: false, error: { code: 'match.not-watching' } });
    const cmd = engine.applyCommand(r.state, { type: 'match.watch', clubId: r.state.playerClubId!, fixtureId: live.fixtureId, round: 2, tick: 10 }, content);
    expect(cmd.ok ? null : cmd.error.code).toBe('match.not-watching');
  });

  it('between rounds of a watched match the next round is replayable from the live match; "Simulate the rest" works from there too', () => {
    const live = must(engine.liveRoundPlayback(s, content));
    const r = must(engine.advance(s, content, { watched: { round: 1, logHash: live.log.hash } }));
    if (r.week) return; // decided in one round? (best of 3: never) — keep the guard for other formats
    expect(r.pause).not.toBeNull();
    const between = r.state;
    expect(between.liveMatch!.watch).toEqual({ mode: 'watch', round: null, cursorTick: 0, calls: [] });
    expect(engine.liveRoundPlayback(between, content)).toMatchObject({ ok: false, error: { code: 'match.not-watching' } });
    const replay = must(engine.roundPlayback(between, fixtureId, 1, content));
    expect(replay.log.hash).toBe(live.log.hash);
    expect(replay.result).toEqual(between.liveMatch!.rounds[0]);
    const none = engine.roundPlayback(between, fixtureId, 2, content);
    expect(none.ok ? null : none.error.code).toBe('replay.no-round');
    expect(must(engine.matchPlayback(between, fixtureId, content)).rounds).toEqual([{ round: 1, winner: between.liveMatch!.rounds[0]!.winner, durationTicks: between.liveMatch!.rounds[0]!.durationTicks }]);
    // Advance from the between-round screen: the next round waits for the viewer (no hash needed for the step itself).
    const next = must(engine.advance(between, content));
    expect(next.watch).toEqual({ fixtureId, round: 2, cursorTick: 0 });
    // A cursor between rounds is refused; "Simulate the rest" there names the round about to start.
    const cursor = engine.applyCommand(between, { type: 'match.watch', clubId: between.playerClubId!, fixtureId, round: 2, tick: 5 }, content);
    expect(cursor.ok ? null : cursor.error.code).toBe('match.not-watching');
    const rest = must(engine.applyCommand(between, { type: 'match.watch', clubId: between.playerClubId!, fixtureId, round: 2, tick: 0, mode: 'simulate' }, content)).state;
    const simulated = must(engine.advance(rest, content));
    expect(simulated.watch).toBeNull();
  });
});

// ---- replay availability (§A4) ------------------------------------------------------------------------------------

describe('replayAvailability: one rule for replays and the report timeline', () => {
  /** Real modules whose sim names its content hash (as core/sim will once WP-M2A merges). */
  const withSimHash = (hash: string | null, engineVersion = realGamePorts.sim.engineVersion): GamePorts => ({ ...realGamePorts, sim: { ...realGamePorts.sim, engineVersion, simContentHash: () => hash } });
  let state: GameState;
  let hashed: GameState;
  beforeAll(() => {
    const engine = createGameEngine(realGamePorts);
    state = careerAtMw1(engine, 'replay-avail-1');
    for (let i = 0; i < 5; i++) state = must(engine.advanceWeek(unblock(engine, state), content)).state;
    const sim = createGameEngine(withSimHash('sim-A'));
    hashed = must(sim.advanceWeek(unblock(sim, state), content)).state;
  }, 300_000);

  it('not played, compacted (3 weeks, and dropped with its season), live, available', () => {
    const engine = createGameEngine(realGamePorts);
    const future = Object.values(state.fixtures).find((f) => f.status === 'scheduled')!;
    expect(engine.replayAvailability(state, future.id, content)).toEqual({ available: false, reason: 'not-played' });
    expect(engine.replayAvailability(state, asId<FixtureId>('lg:1:nope'), content)).toEqual({ available: false, reason: 'not-played' });
    // Results are kept for the current and previous season: a fixture of an older season is gone with its result.
    const season3 = { ...state, calendar: { ...state.calendar, season: 3 } };
    expect(engine.replayAvailability(season3, asId<FixtureId>('lg:1:t:MW1:a:b'), content)).toEqual({ available: false, reason: 'compacted' });
    expect(engine.replayAvailability(season3, asId<FixtureId>('rk:1:t:final:0'), content)).toEqual({ available: false, reason: 'compacted' });
    expect(engine.replayAvailability(season3, asId<FixtureId>('lg:2:t:MW1:a:b'), content)).toEqual({ available: false, reason: 'not-played' });
    const compacted = Object.values(state.results).filter((r) => realGamePorts.league.isCompactedResult(r));
    expect(compacted.length).toBeGreaterThan(0); // matches between other clubs, 3 weeks after they were played (O24)
    for (const r of compacted) expect(engine.replayAvailability(state, r.fixtureId, content)).toEqual({ available: false, reason: 'compacted' });
    const full = Object.values(state.results).filter((r) => !realGamePorts.league.isCompactedResult(r));
    for (const r of full) expect(engine.replayAvailability(state, r.fixtureId, content)).toEqual({ available: true, rounds: r.rounds.length });
    const compactedReplay = engine.roundPlayback(state, compacted[0]!.fixtureId, 1, content);
    expect(compactedReplay.ok ? null : compactedReplay.error).toMatchObject({ code: 'replay.unavailable', details: { reason: 'compacted' } });
    const report = must(engine.buildMatchReport(state, compacted[0]!.fixtureId, content));
    expect(report.timelineAvailable).toBe(false);
    // The player's match in progress.
    const live = must(engine.advance(unblock(engine, state), content, { playerMatch: 'watch' }));
    expect(engine.replayAvailability(live.state, live.watch!.fixtureId, content)).toEqual({ available: false, reason: 'live' });
  });

  it('other build: the engine version; the sim content hash (simHash); the career content hash for results without a simHash', () => {
    const full = Object.values(state.results).find((r) => !realGamePorts.league.isCompactedResult(r))!;
    // Every result records the sim content hash of the content that played it (core/sim simContentHash, WP-M2A).
    for (const r of Object.values(state.results)) expect(r.simHash).toBe(simContentHash(content));
    // The same content under another career content hash (a non-sim edit, as far as replays can tell): same sim hash.
    const relabelled = loadContent('fixture', FIXTURE_CONTENT_RAW, { profile: 'fixture', hash: 'another-career-hash' });
    if (!relabelled.ok) throw new Error('fixture content');
    const real = createGameEngine(realGamePorts);
    expect(relabelled.value.ref.hash).not.toBe(content.ref.hash);
    expect(real.replayAvailability(state, full.fixtureId, relabelled.value)).toEqual({ available: true, rounds: full.rounds.length });
    expect(must(real.buildMatchReport(state, full.fixtureId, relabelled.value)).timelineAvailable).toBe(true);
    // Engine version.
    const newer = createGameEngine(withSimHash(null, realGamePorts.sim.engineVersion + 1));
    expect(newer.replayAvailability(state, full.fixtureId, content)).toEqual({ available: false, reason: 'other-build' });
    expect(must(newer.buildMatchReport(state, full.fixtureId, content)).timelineAvailable).toBe(false);
    // Content hash fallback (no simHash, as before save v5): a career content hash that differs ends the replay, even if the sim could name its own.
    const { simHash: _drop, ...older } = state.results[full.fixtureId]!;
    const otherHash = { ...older, contentHash: 'another-content' };
    const edited = { ...state, results: { ...state.results, [full.fixtureId]: otherHash } };
    const engine = createGameEngine(withSimHash('sim-A'));
    expect(engine.replayAvailability(edited, full.fixtureId, content)).toEqual({ available: false, reason: 'other-build' });
    expect(must(engine.buildMatchReport(edited, full.fixtureId, content)).timelineAvailable).toBe(false);
    // simHash: results written by a sim that names its content hash carry it; the replay follows it, not the content hash.
    const week = hashed.calendar.weekIndex - 1;
    const recent = Object.values(hashed.results).filter((r) => r.weekIndex === week);
    expect(recent.length).toBeGreaterThan(0);
    for (const r of recent) expect(r.simHash).toBe('sim-A');
    const r0 = recent[0]!;
    const sameSim = { ...r0, contentHash: 'renamed-a-club' };
    const renamed = { ...hashed, results: { ...hashed.results, [r0.fixtureId]: sameSim } };
    expect(engine.replayAvailability(renamed, r0.fixtureId, content)).toEqual({ available: true, rounds: r0.rounds.length });
    expect(must(engine.buildMatchReport(renamed, r0.fixtureId, content)).timelineAvailable).toBe(true);
    expect(must(engine.roundPlayback(renamed, r0.fixtureId, 1, content)).result!.checksum).toBe(r0.rounds[0]!.checksum);
    const balanced = createGameEngine(withSimHash('sim-B'));
    expect(balanced.replayAvailability(hashed, r0.fixtureId, content)).toEqual({ available: false, reason: 'other-build' });
    expect(must(balanced.buildMatchReport(hashed, r0.fixtureId, content)).timelineAvailable).toBe(false);
    const replay = balanced.roundPlayback(hashed, r0.fixtureId, 1, content);
    expect(replay.ok ? null : replay.error).toMatchObject({ code: 'replay.unavailable', details: { reason: 'other-build' } });
    // A build whose sim cannot name its hash falls back to the content hash for a result that has one.
    expect(createGameEngine(withSimHash(null)).replayAvailability(hashed, r0.fixtureId, content)).toEqual({ available: true, rounds: r0.rounds.length });
  });

  it('a replay whose checksum does not reproduce is reported (replay.mismatch), never shown', () => {
    const engine = createGameEngine(realGamePorts);
    const full = Object.values(state.results).find((r) => !realGamePorts.league.isCompactedResult(r))!;
    const tampered = { ...full, rounds: full.rounds.map((x, i) => (i === 0 ? { ...x, checksum: 'not-the-checksum' } : x)) };
    const s = { ...state, results: { ...state.results, [full.fixtureId]: tampered } };
    const r = engine.roundPlayback(s, full.fixtureId, 1, content);
    expect(r.ok ? null : r.error).toMatchObject({ code: 'replay.mismatch', details: { fixtureId: full.fixtureId, round: 1 } });
    const none = engine.roundPlayback(state, full.fixtureId, full.rounds.length + 1, content);
    expect(none.ok ? null : none.error.code).toBe('replay.no-round');
  });
});

describe('roundInputOf copies the round\'s calls (RESERVED for the calls package)', () => {
  it('a recorded call plan reaches RoundInput.calls; none recorded, none in the input', () => {
    const engine = createGameEngine(realGamePorts);
    let s = careerAtMw1(engine, 'calls-copy-1');
    s = must(engine.advanceWeek(unblock(engine, s), content)).state;
    const result = Object.values(s.results).find((r) => r.roundLineups !== undefined)!;
    const plain = result.roundLineups![0]!;
    expect(plain.calls).toBeUndefined();
    const withPlan: MatchResult = {
      ...result,
      roundLineups: [{ ...plain, calls: { home: { mode: 'explicit', calls: [{ tick: 41, kind: 'focus', target: 6 }] }, away: { mode: 'policy' } } }, ...result.roundLineups!.slice(1)],
    };
    const input = roundInputOfResult(withPlan, 1);
    expect(input.calls).toEqual({ home: { mode: 'explicit', calls: [{ tick: 41, kind: 'focus', target: 6 }] }, away: { mode: 'policy' } });
    expect(input.calls!.home).not.toBe(withPlan.roundLineups![0]!.calls!.home);
    expect(roundInputOfResult(result, 1).calls).toBeUndefined();
  });
});

describe('inspectPlayback (the pause inspector probe; core/sim inspectRoundAt from WP-M2A)', () => {
  it('hands the exact round input and seed to the probe; live, never past the cursor; replay, never past the round', () => {
    const calls: { input: RoundInput; seed: string; tick: number }[] = [];
    const probe: GamePorts = {
      ...realGamePorts,
      sim: { ...realGamePorts.sim, inspectRoundAt: (input, seed, _c, tick) => (calls.push({ input: cloneJson(input), seed, tick }), { tick, evaluatedTick: tick + 1, units: [] }) },
    };
    const engine = createGameEngine(probe);
    const mw1 = careerAtMw1(engine, 'inspect-1');
    const r = must(engine.advance(unblock(engine, mw1), content, { playerMatch: 'watch' }));
    const { fixtureId } = r.watch!;
    const at = must(engine.applyCommand(r.state, { type: 'match.watch', clubId: r.state.playerClubId!, fixtureId, round: 1, tick: 200 }, content)).state;
    expect(must(engine.inspectPlayback(at, fixtureId, 1, 200, content))).toEqual({ tick: 200, evaluatedTick: 201, units: [] });
    const prepared = prepareRound(probe, at, at.liveMatch!, content);
    expect(calls[0]).toEqual({ input: prepared.input, seed: prepared.seed, tick: 200 });
    for (const tick of [201, -1, 2.5]) {
      const ahead = engine.inspectPlayback(at, fixtureId, 1, tick, content);
      expect(ahead.ok ? null : ahead.error.code).toBe('inspect.tick');
    }
    // A committed round of a stored match: its replay input, up to its last tick.
    const s = must(engine.advanceWeek(unblock(engine, mw1), content)).state;
    const result = Object.values(s.results).find((x) => x.roundLineups !== undefined)!;
    const end = result.rounds[0]!.durationTicks - 1; // the round's last tick (its fight.end)
    expect(engine.inspectPlayback(s, result.fixtureId, 1, end, content).ok).toBe(true);
    expect(calls[1]).toEqual({ input: roundInputOfResult(result, 1), seed: result.rounds[0]!.seed, tick: end });
    const past = engine.inspectPlayback(s, result.fixtureId, 1, end + 1, content);
    expect(past.ok ? null : past.error.code).toBe('inspect.tick');
  });

  it('the real probe (core/sim inspectRoundAt): end-of-tick state, evaluations as of tick + 1, the survivors round_over at the end tick', () => {
    const engine = createGameEngine(realGamePorts);
    const mw1 = careerAtMw1(engine, 'inspect-1');
    const r = must(engine.advance(unblock(engine, mw1), content, { playerMatch: 'watch' }));
    const { fixtureId } = r.watch!;
    const live = must(engine.liveRoundPlayback(r.state, content));
    const at = must(engine.applyCommand(r.state, { type: 'match.watch', clubId: r.state.playerClubId!, fixtureId, round: 1, tick: 120 }, content)).state;
    const probe = must(engine.inspectPlayback(at, fixtureId, 1, 120, content));
    expect(probe.tick).toBe(120);
    expect(probe.evaluatedTick).toBe(121);
    expect(probe.units).toHaveLength(10);
    // The state is what the shown log's frame at that tick shows (format 2 frames: x, y, hp, state bits, shield, focus).
    const frame = live.log.events.find((e) => e.type === 'frame' && e.tick === 120) as unknown as { data: { u: number[][] } } | undefined;
    expect(frame).toBeDefined();
    probe.units.forEach((u, i) => expect(u.hp).toBe(frame!.data.u[i]![2]));
    for (const u of probe.units) expect(u.evaluation === null).toBe(u.blockedBy !== null);
    // Probing changes nothing: the commit after it is the commit without it.
    const after = must(engine.advance(at, content, { watched: { round: 1, logHash: live.log.hash } }));
    const plain = must(engine.advance(r.state, content, { watched: { round: 1, logHash: live.log.hash } }));
    expect(after.state.liveMatch?.rounds ?? null).toEqual(plain.state.liveMatch?.rounds ?? null);
    // A committed round at its last tick (durationTicks - 1): the survivors have nothing left to decide.
    const between = after.state;
    expect(between.liveMatch).not.toBeNull();
    const end = between.liveMatch!.rounds[0]!.durationTicks - 1;
    const last = must(engine.inspectPlayback(between, fixtureId, 1, end, content));
    expect(last.tick).toBe(end);
    for (const u of last.units) expect(u.blockedBy).toBe(u.standing ? 'round_over' : 'downed');
    const past = engine.inspectPlayback(between, fixtureId, 1, end + 1, content);
    expect(past.ok ? null : past.error.code).toBe('inspect.tick');
  });
});

describe('AI matches never watch', () => {
  it('with no player club (the soak) a Watch request plays the week as advanceWeek does; other clubs\' matches of a watched week are simulated', () => {
    const engine = createGameEngine(realGamePorts);
    let w = must(engine.createWorld(content, { rootSeed: 'headless-watch' }));
    for (let i = 0; i < 6 && w.calendar.weekId !== 'MW1'; i++) w = must(engine.advanceWeek(w, content)).state;
    const a = must(engine.advance(w, content, { playerMatch: 'watch' }));
    expect(a.watch).toBeNull();
    expect(a.week).not.toBeNull();
    expect(checksumState(a.state)).toBe(checksumState(must(engine.advanceWeek(w, content)).state));
  });
});

describe('pacing "never" with Watch: the round end runs the between-round step and stops at the next round', () => {
  it('one advance commits the round, applies the auto step and returns the next round to watch; the week equals advanceWeek', () => {
    const engine = createGameEngine(realGamePorts);
    let mw1 = careerAtMw1(engine, 'watch-never-1');
    mw1 = must(engine.applyCommand(mw1, { type: 'pacing.set', clubId: mw1.playerClubId!, levelUpPacing: 'fast', pauseBetweenRounds: 'never' }, content)).state;
    mw1 = unblock(engine, mw1);
    let r = must(engine.advance(mw1, content, { playerMatch: 'watch' }));
    let stoppedAtNext = 0;
    for (let i = 0; i < 8 && r.week === null; i++) {
      expect(r.pause).toBeNull();
      const w = r.watch!;
      const live = must(engine.liveRoundPlayback(r.state, content));
      r = must(engine.advance(r.state, content, { watched: { round: w.round, logHash: live.log.hash } }));
      if (r.watch) {
        // Round w committed, its between-round step applied, round w + 1 waiting: all in this one advance.
        expect(r.watch.round).toBe(w.round + 1);
        expect(r.state.liveMatch!.rounds).toHaveLength(w.round);
        expect(r.state.liveMatch!.betweenRounds).toHaveLength(w.round);
        stoppedAtNext++;
      }
    }
    expect(r.week).not.toBeNull();
    expect(stoppedAtNext).toBeGreaterThan(0);
    expect(checksumState(r.state)).toBe(checksumState(must(engine.advanceWeek(mw1, content)).state));
  });
});

describe('call plans never carry into a later round (RESERVED for the calls package)', () => {
  it('after "Simulate the rest" the pending round keeps its calls and the next rounds have none', () => {
    // Stand-in sim: it ignores call plans, so this pins core/game's bookkeeping whatever core/sim does with them.
    const engine = createGameEngine(createStandInPorts());
    let mw1 = careerAtMw1(engine, 'calls-carry-1');
    mw1 = must(engine.applyCommand(mw1, { type: 'pacing.set', clubId: mw1.playerClubId!, levelUpPacing: 'fast', pauseBetweenRounds: 'never' }, content)).state;
    const r = must(engine.advance(unblock(engine, mw1), content, { playerMatch: 'watch' }));
    const { fixtureId } = r.watch!;
    const withCall = cloneJson(r.state);
    const call = { tick: 41, kind: 'focus', target: 1 };
    withCall.liveMatch!.watch!.calls = [call]; // what 'match.call' will write; refused in M2
    const switched = must(engine.applyCommand(withCall, { type: 'match.watch', clubId: withCall.playerClubId!, fixtureId, round: 1, tick: 60, mode: 'simulate' }, content)).state;
    expect(switched.liveMatch!.watch!.calls).toEqual([call]);
    const side = switched.liveMatch!.home.clubId === switched.playerClubId ? 'home' : 'away';
    expect(prepareRound(engine.ports, switched, switched.liveMatch!, content).input.calls![side]).toEqual({ mode: 'explicit', calls: [call] });
    const done = must(engine.advance(switched, content));
    const lineups = done.state.results[fixtureId]?.roundLineups ?? done.state.liveMatch!.roundLineups;
    expect(lineups.length).toBeGreaterThan(1);
    expect(lineups[0]!.calls![side]).toEqual({ mode: 'explicit', calls: [call] });
    for (const l of lineups.slice(1)) expect(l.calls).toBeUndefined();
    if (done.state.liveMatch) expect(done.state.liveMatch.watch!.calls).toEqual([]);
    // Watching, the same: the committed round's calls are cleared with it.
    const watched = cloneJson(r.state);
    watched.liveMatch!.watch!.calls = [call];
    const live = must(engine.liveRoundPlayback(watched, content));
    const next = must(engine.advance(watched, content, { watched: { round: 1, logHash: live.log.hash } }));
    if (next.state.liveMatch) {
      expect(next.state.liveMatch.roundLineups[0]!.calls![side]).toEqual({ mode: 'explicit', calls: [call] });
      expect(next.state.liveMatch.watch!.calls).toEqual([]);
      expect(prepareRound(engine.ports, next.state, next.state.liveMatch, content).input.calls).toBeUndefined();
    }
  });
});
