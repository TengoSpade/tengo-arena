/**
 * M1.1 round-by-round matches (WP-C): combat-skills.md sw-001 … sw-009 (sw-007
 * lowest first, 05 M1.1 addendum §A4), progression.md ai-003 / ai-004, the
 * replay record, the week split and resume, determinism.
 */
import { describe, expect, it } from 'vitest';
import type { ContentDB } from '../content';
import { asId, type ClubId, type Fighter, type FighterId, type Fixture, type GameState, type MatchState, type RoundInput, type SwapDecision } from '../model';
import { buildFixtureWorld, fixtureContent, withFreshness } from '../testkit';
import { cloneJson, hashString, stableStringify } from '../util';
import {
  applyBetweenRound,
  autoSwapDecisions,
  betweenRounds,
  checkSwaps,
  createGameEngine,
  createStandInPorts,
  finishMatch,
  playMatchAuto,
  playRound,
  realGamePorts,
  roundInputOf,
  startMatch,
  type GameEngine,
  type GamePorts,
} from './index';
import { squadOf } from './week';

const content: ContentDB = fixtureContent();
const checksum = (x: unknown): string => hashString(stableStringify(x));

interface Script {
  /** Forced round winners by round (index 0 = round 1). */
  winners?: ('home' | 'away')[];
  /** Fighters injured (minor, 2 weeks) after a round, by round. */
  injure?: Record<number, FighterId[]>;
  /** Every RoundInput the sim received. */
  inputs?: RoundInput[];
  sim?: GamePorts['sim'];
}

/** Stand-in ports with scripted round winners and injuries (no random injuries); the stand-in drain stays. */
function scripted(script: Script = {}): GamePorts {
  const base = createStandInPorts();
  const inner = script.sim ?? base.sim;
  const sim: GamePorts['sim'] = {
    ...inner,
    simulateRound: (input, seed, c, o) => {
      script.inputs?.push(cloneJson(input));
      const out = inner.simulateRound(input, seed, c, o);
      const w = script.winners?.[input.round - 1];
      return w && w !== out.result.winner ? { ...out, result: { ...out.result, winner: w } } : out;
    },
  };
  const fighters: GamePorts['fighters'] = {
    ...base.fighters,
    injuriesAfterRound: (draft, _ms, outcome) => {
      const ids = script.injure?.[outcome.result.round] ?? [];
      for (const id of ids) {
        draft.fighters[id]!.injury = { severity: 'minor', weeksOut: 2, fixtureId: _ms.fixtureId, round: outcome.result.round, causeFighterId: null, damageBp: 0, since: { season: 1, weekIndex: 1 } };
      }
      return ids;
    },
  };
  return createStandInPorts({ sim, fighters });
}

function setup(opts: { bestOf?: number; perClub?: number; reserves?: number } = {}): { s: GameState; fx: Fixture; home: ClubId; away: ClubId } {
  const s = buildFixtureWorld({ clubLimit: 2, fightersPerClub: opts.perClub ?? 8, squadReserves: opts.reserves ?? 2 });
  const [home, away] = Object.keys(s.clubs) as ClubId[];
  const fx: Fixture = {
    id: asId('lg:1:t:1'),
    competitionId: asId('lg:1:t'),
    season: 1,
    tierId: s.clubs[home!]!.tierId,
    weekIndex: s.calendar.weekIndex,
    weekId: s.calendar.weekId!,
    stage: 'league',
    matchweek: 1,
    wing: null,
    homeClubId: home!,
    awayClubId: away!,
    bestOf: opts.bestOf ?? 3,
    venueId: null,
    status: 'scheduled',
  };
  s.fixtures[fx.id] = fx;
  return { s, fx, home: home!, away: away! };
}

function start(ports: GamePorts, s: GameState, fx: Fixture): MatchState {
  return startMatch(ports, s, fx, { home: squadOf(s, s.clubs[fx.homeClubId]!, content), away: squadOf(s, s.clubs[fx.awayClubId]!, content) }, content);
}

function setFresh(s: GameState, id: FighterId, value: number): void {
  s.fighters[id] = withFreshness(s.fighters[id]!, value) as Fighter;
}

const none = { home: [] as SwapDecision[], away: [] as SwapDecision[] };

describe('startMatch and the squads (sw-001)', () => {
  it('locks 5 starters + 0-2 reserves with their fight inputs; round 1 is the lock five', () => {
    const { s, fx } = setup();
    const ms = start(scripted(), s, fx);
    expect(ms.home.active).toEqual(s.clubs[fx.homeClubId]!.lineup.fighters.map((e) => e.fighterId));
    expect(ms.home.unusedReserves).toEqual(s.clubs[fx.homeClubId]!.lineup.reserves);
    expect(ms.home.unusedReserves).toHaveLength(2);
    for (const id of [...ms.home.active, ...ms.home.unusedReserves]) expect(ms.inputsById[id]).toBeDefined();
    expect(ms.seed).toBe(ms.input.seed);
    expect(ms.phase).toBe('round_pending');
  });

  it('0 or 1 reserve is legal; a duplicate is refused', () => {
    const ports = scripted();
    for (const n of [0, 1]) {
      const { s, fx } = setup({ reserves: n });
      const ms = start(ports, s, fx);
      expect(ms.home.unusedReserves).toHaveLength(n);
      playRound(ports, s, ms, content);
      expect(ms.rounds).toHaveLength(1);
    }
    const { s, fx } = setup();
    const sq = squadOf(s, s.clubs[fx.homeClubId]!, content);
    expect(() => startMatch(ports, s, fx, { home: { ...sq, reserves: [sq.starters[0]!] }, away: squadOf(s, s.clubs[fx.awayClubId]!, content) }, content)).toThrow(/twice/);
  });
});

describe('between-round swaps (sw-002 … sw-006)', () => {
  it('sw-002: the reserve takes the slot and row with its own preset; the withdrawn fighter cannot return', () => {
    const script: Script = { winners: ['away', 'home', 'home'], inputs: [] };
    const ports = scripted(script);
    const { s, fx } = setup();
    const ms = start(ports, s, fx);
    playRound(ports, s, ms, content);
    const a = ms.home.active[2]!;
    const r1 = ms.home.unusedReserves[0]!;
    const rowA = ms.home.rows[2]!;
    applyBetweenRound(ports, s, ms, { home: [{ out: a, in: r1 }], away: [] }, content);
    expect(ms.home.swapsUsed).toBe(1);
    expect(ms.home.withdrawn).toEqual([a]);
    expect(ms.betweenRounds[0]!.home).toEqual([{ out: a, in: r1, row: rowA, reason: 'auto', costsSwap: true }]);
    playRound(ports, s, ms, content);
    const r2 = script.inputs![1]!.home.fighters[2]!;
    expect(r2.fighterId).toBe(r1);
    expect(r2.row).toBe(rowA);
    expect(r2.enteredThisRound).toBe(true);
    expect(r2.tactics).toEqual(ms.inputsById[r1]!.tactics);
    expect(ms.roundLineups[1]!.home.entered[2]).toBe(true);
    expect(ms.phase).toBe('between_rounds');
    const back = checkSwaps(ms, 'home', [{ out: r1, in: a }], 2);
    expect(back.rejected.map((x) => x.reason)).toEqual(['not_a_reserve']);
    // The player may pick the other row for the entering fighter.
    const other = rowA === 'front' ? 'back' : 'front';
    applyBetweenRound(ports, s, ms, { home: [{ out: ms.home.active[0]!, in: ms.home.unusedReserves[0]!, row: other }], away: [] }, content);
    expect(ms.home.rows[0]).toBe(other);
    expect(script.inputs![1]!.home.fighters[3]!.enteredThisRound).toBe(false);
  });

  it('sw-003: both swaps used, an injury brings an emergency entrant (no swap); with nobody left, a hired blade', () => {
    for (const perClub of [8, 7]) {
      const { s, fx, home } = setup({ bestOf: 5, perClub });
      const ids = Object.values(s.fighters).filter((f) => f.clubId === home).map((f) => f.id);
      const injured = s.clubs[home]!.lineup.fighters[3]!.fighterId;
      const ports = scripted({ winners: ['away', 'home', 'away', 'home', 'home'], injure: { 3: [injured] } });
      const ms = start(ports, s, fx);
      playRound(ports, s, ms, content);
      applyBetweenRound(ports, s, ms, { home: [{ out: ms.home.active[0]!, in: ms.home.unusedReserves[0]! }], away: [] }, content);
      playRound(ports, s, ms, content);
      applyBetweenRound(ports, s, ms, { home: [{ out: ms.home.active[1]!, in: ms.home.unusedReserves[0]! }], away: [] }, content);
      playRound(ports, s, ms, content);
      expect(ms.home.injured).toEqual([injured]);
      applyBetweenRound(ports, s, ms, none, content);
      const rec = ms.betweenRounds[2]!.home;
      expect(rec).toHaveLength(1);
      expect(rec[0]).toMatchObject({ out: injured, reason: 'emergency', costsSwap: false });
      expect(ms.home.swapsUsed).toBe(2);
      expect(ms.home.active).toContain(rec[0]!.in);
      expect(ms.home.active).not.toContain(injured);
      expect(ms.betweenRounds[2]!.injured).toEqual([injured]);
      const entrant = s.fighters[rec[0]!.in]!;
      if (perClub === 8) {
        // The only fit roster fighter outside the squad.
        expect(ids.slice(7)).toEqual([entrant.id]);
        expect(ms.hiredBladeIds).toEqual([]);
      } else {
        expect(entrant.status).toBe('hired-blade');
        expect(entrant.classId).toBe(s.fighters[injured]!.classId);
        expect(ms.hiredBladeIds).toEqual([entrant.id]);
      }
      expect(ms.home.emergencyEntrants).toEqual([entrant.id]);
      playRound(ports, s, ms, content);
      while (ms.phase !== 'done') {
        applyBetweenRound(ports, s, ms, none, content);
        playRound(ports, s, ms, content);
      }
      const result = finishMatch(ports, s, ms, content);
      expect(result.emergencyEntrants).toEqual([entrant.id]);
      expect(result.reserveInputs!.home.map((f) => f.fighterId)).toContain(entrant.id);
      expect(result.fighterStats[entrant.id]!.roundsPlayed).toBe(result.rounds.length - 3);
    }
  });

  it('sw-004: an injury with one unused reserve: the reserve enters (forced) and uses the last swap', () => {
    const { s, fx, home } = setup({ bestOf: 5 });
    const c = s.clubs[home]!.lineup.fighters[4]!.fighterId;
    const ports = scripted({ winners: ['away', 'home', 'home', 'home'], injure: { 2: [c] } });
    const ms = start(ports, s, fx);
    playRound(ports, s, ms, content);
    applyBetweenRound(ports, s, ms, { home: [{ out: ms.home.active[0]!, in: ms.home.unusedReserves[0]! }], away: [] }, content);
    playRound(ports, s, ms, content);
    const last = ms.home.unusedReserves[0]!;
    const view = betweenRounds(ports, s, ms, content);
    expect(view.home.forced).toEqual([c]);
    expect(view.home.suggestions).toEqual([{ out: c, in: last }]);
    applyBetweenRound(ports, s, ms, none, content);
    expect(ms.betweenRounds[1]!.home).toEqual([{ out: c, in: last, row: ms.home.rows[4]!, reason: 'injury', costsSwap: true }]);
    expect(ms.home.swapsUsed).toBe(2);
    expect(ms.home.unusedReserves).toEqual([]);
    expect(autoSwapDecisions(ports, s, (playRound(ports, s, ms, content), ms), 'home', content)).toEqual([]);
  });

  it('sw-005: blind decisions from the same post-round state, applied home then away, recorded side by side', () => {
    const ports = scripted({ winners: ['away', 'home', 'home'] });
    const { s, fx } = setup();
    const ms = start(ports, s, fx);
    playRound(ports, s, ms, content);
    for (const id of ms.away.active) setFresh(s, id, 30);
    for (const id of ms.home.active) setFresh(s, id, 30);
    const awayAuto = autoSwapDecisions(ports, s, ms, 'away', content);
    expect(awayAuto.length).toBeGreaterThan(0);
    const runs = [[], [{ out: ms.home.active[0]!, in: ms.home.unusedReserves[0]! }]].map((home) => {
      const s2 = cloneJson(s);
      const m2 = cloneJson(ms);
      applyBetweenRound(ports, s2, m2, { home, away: autoSwapDecisions(ports, s2, m2, 'away', content) }, content);
      return m2;
    });
    expect(runs[0]!.betweenRounds[0]!.away).toEqual(runs[1]!.betweenRounds[0]!.away);
    expect(runs[1]!.betweenRounds[0]!.away.map((r) => ({ out: r.out, in: r.in }))).toEqual(awayAuto);
    expect(runs[1]!.betweenRounds[0]!.home).toHaveLength(1);
  });

  it('sw-006: the vice leads at CQ − 10 when the captain is swapped out; else the highest CQ (ties lower slot); a reserve captain takes over on entering', () => {
    const penalty = content.development.captaincy.actingCaptainCqPenalty;
    const ports = scripted({ winners: ['away', 'home', 'home'] });
    const { s, fx, home } = setup();
    const club = s.clubs[home]!;
    const ms = start(ports, s, fx);
    expect(ms.home.actingCaptainId).toBe(club.captainId);
    playRound(ports, s, ms, content);
    applyBetweenRound(ports, s, ms, { home: [{ out: club.captainId!, in: ms.home.unusedReserves[0]! }], away: [] }, content);
    expect(ms.home.actingCaptainId).toBe(club.viceCaptainId);
    playRound(ports, s, ms, content);
    const l2 = ms.roundLineups[1]!.home;
    expect(l2.fighterIds[l2.captainIndex]).toBe(club.viceCaptainId);
    expect(l2.captainQuality).toBe(Math.max(0, ms.inputsById[club.viceCaptainId!]!.captainQuality - penalty));
    expect(l2.viceCaptainIndex).toBeNull();

    // Captain and vice both out after round 1: the highest lock CQ among the active five.
    const t = setup();
    const ms2 = start(ports, t.s, t.fx);
    const c2 = t.s.clubs[t.home]!;
    playRound(ports, t.s, ms2, content);
    applyBetweenRound(ports, t.s, ms2, { home: [{ out: c2.captainId!, in: ms2.home.unusedReserves[0]! }, { out: c2.viceCaptainId!, in: ms2.home.unusedReserves[1]! }], away: [] }, content);
    const best = [...ms2.home.active].map((id, slot) => ({ id, slot, cq: ms2.inputsById[id]!.captainQuality })).sort((a, b) => b.cq - a.cq || a.slot - b.slot)[0]!;
    expect(ms2.home.actingCaptainId).toBe(best.id);

    // The club captain named as a reserve takes the job when he enters.
    const u = setup();
    const c3 = u.s.clubs[u.home]!;
    const reserveCaptain = c3.lineup.reserves[0]!;
    c3.captainId = reserveCaptain;
    const ms3 = start(ports, u.s, u.fx);
    expect(ms3.home.actingCaptainId).toBe(c3.viceCaptainId);
    playRound(ports, u.s, ms3, content);
    applyBetweenRound(ports, u.s, ms3, { home: [{ out: ms3.home.active[4]!, in: reserveCaptain }], away: [] }, content);
    expect(ms3.home.actingCaptainId).toBe(reserveCaptain);
    playRound(ports, u.s, ms3, content);
    expect(ms3.roundLineups[1]!.home.captainQuality).toBe(ms3.inputsById[reserveCaptain]!.captainQuality);
  });
});

describe('auto-swap (sw-007, ai-003, ai-004)', () => {
  function prepared(winner: 'home' | 'away', rules: Partial<GameState['clubs'][ClubId]['autoSwap']> = {}) {
    const ports = scripted({ winners: [winner, winner === 'home' ? 'away' : 'home', 'home'] });
    const { s, fx, home } = setup();
    s.clubs[home]!.autoSwap = { ...s.clubs[home]!.autoSwap, mode: 'threshold', freshnessBelow: 40, keepOneForInjury: true, sameRoleFamilyFirst: false, lostRoundBonus: 0, ...rules };
    const ms = start(ports, s, fx);
    for (const id of [...ms.home.active, ...ms.home.unusedReserves]) ms.inputsById[id] = { ...ms.inputsById[id]!, rating: 50 };
    playRound(ports, s, ms, content);
    for (const id of ms.home.active) setFresh(s, id, 80);
    return { ports, s, ms };
  }

  it('sw-007: lowest first; the last swap is kept for injury until the last possible step', () => {
    const { ports, s, ms } = prepared('home');
    const [a, b] = ms.home.active as [FighterId, FighterId];
    const [r90, r70] = ms.home.unusedReserves as [FighterId, FighterId];
    setFresh(s, a, 38);
    setFresh(s, b, 35);
    setFresh(s, r90, 90);
    setFresh(s, r70, 70);
    // The F 35 starter goes first and takes the best reserve; F 38 waits (one swap kept for injury).
    expect(autoSwapDecisions(ports, s, ms, 'home', content)).toEqual([{ out: b, in: r90 }]);
    applyBetweenRound(ports, s, ms, { home: autoSwapDecisions(ports, s, ms, 'home', content), away: [] }, content);
    playRound(ports, s, ms, content);
    expect(ms.score).toEqual({ home: 1, away: 1 });
    setFresh(s, a, 38);
    setFresh(s, r70, 70);
    // After round 2 of a best-of-3 (the last possible step) the last swap may go on Freshness.
    expect(autoSwapDecisions(ports, s, ms, 'home', content)).toEqual([{ out: a, in: r70 }]);
  });

  it('the reserve needs Freshness + margin and rating − gap; mode injured_only and off swap only for injuries', () => {
    const { ports, s, ms } = prepared('home');
    const a = ms.home.active[0]!;
    const [r1, r2] = ms.home.unusedReserves as [FighterId, FighterId];
    setFresh(s, a, 30);
    setFresh(s, r1, 44);
    setFresh(s, r2, 95);
    ms.inputsById[r2] = { ...ms.inputsById[r2]!, rating: 43 };
    expect(autoSwapDecisions(ports, s, ms, 'home', content)).toEqual([]);
    ms.inputsById[r2] = { ...ms.inputsById[r2]!, rating: 44 };
    expect(autoSwapDecisions(ports, s, ms, 'home', content)).toEqual([{ out: a, in: r2 }]);
    s.clubs[ms.home.clubId]!.autoSwap.mode = 'injured_only';
    expect(autoSwapDecisions(ports, s, ms, 'home', content)).toEqual([]);
    ms.home.injured.push(ms.home.active[3]!);
    expect(autoSwapDecisions(ports, s, ms, 'home', content)).toHaveLength(1);
    s.clubs[ms.home.clubId]!.autoSwap.mode = 'off';
    // Forced replacements whatever the mode: the best-fit reserve (family, then rating 50 over 44).
    expect(autoSwapDecisions(ports, s, ms, 'home', content).map((d) => d.out)).toEqual([ms.home.active[3]!]);
  });

  it('ai-003: youth_focused (50) lost round 1: threshold 60, the F 53 starter is swapped for the F 90 reserve', () => {
    const { ports, s, ms } = prepared('away', { freshnessBelow: 50, lostRoundBonus: 10 });
    const a = ms.home.active[2]!;
    const [r1, r2] = ms.home.unusedReserves as [FighterId, FighterId];
    setFresh(s, a, 53);
    setFresh(s, r1, 90);
    setFresh(s, r2, 60);
    expect(autoSwapDecisions(ports, s, ms, 'home', content)).toEqual([{ out: a, in: r1 }]);
  });

  it('ai-004: balanced (40) won round 1: the F 45 starter stays', () => {
    const { ports, s, ms } = prepared('home', { freshnessBelow: 40, lostRoundBonus: 10 });
    setFresh(s, ms.home.active[2]!, 45);
    for (const r of ms.home.unusedReserves) setFresh(s, r, 95);
    expect(autoSwapDecisions(ports, s, ms, 'home', content)).toEqual([]);
  });
});

describe('records and replay (sw-008)', () => {
  it('roundInputOf rebuilds every RoundInput the sim played (real sim): identical checksums and event hashes; no policy runs', () => {
    const script: Script = { winners: [], inputs: [], sim: realGamePorts.sim };
    const ports = scripted(script);
    const { s, fx, home } = setup({ bestOf: 5 });
    const injured = s.clubs[home]!.lineup.fighters[1]!.fighterId;
    script.injure = { 2: [injured] };
    const ms = start(ports, s, fx);
    playRound(ports, s, ms, content);
    for (const id of ms.home.active) setFresh(s, id, 35);
    applyBetweenRound(ports, s, ms, { home: [{ out: ms.home.active[4]!, in: ms.home.unusedReserves[0]! }], away: [] }, content);
    while (ms.phase !== 'done') {
      playRound(ports, s, ms, content);
      if (ms.phase === 'between_rounds') applyBetweenRound(ports, s, ms, { home: autoSwapDecisions(ports, s, ms, 'home', content), away: autoSwapDecisions(ports, s, ms, 'away', content) }, content);
    }
    const result = finishMatch(ports, s, ms, content);
    expect(result.betweenRounds!.length).toBeGreaterThan(0);
    expect(result.rounds.length).toBe(script.inputs!.length);
    const stored = cloneJson(result);
    for (const r of stored.rounds) {
      const input = roundInputOf(stored, r.round);
      expect(input).toEqual(script.inputs![r.round - 1]);
      const a = realGamePorts.sim.simulateRound(input, r.seed, content, { record: 'full' });
      const b = realGamePorts.sim.simulateRound(roundInputOf(stored, r.round), r.seed, content, { record: 'full' });
      expect(a.result.checksum).toBe(r.checksum);
      expect(a.result.eventHash).not.toBeNull();
      expect(a.result.eventHash).toBe(b.result.eventHash);
    }
  });

  it('finishMatch: merged stats of everyone who played, MVP from the winners, squads and lineups recorded', () => {
    const ports = scripted({ winners: ['away', 'home', 'home'] });
    const { s, fx } = setup();
    const result = playMatchAuto(ports, s, fx, { home: squadOf(s, s.clubs[fx.homeClubId]!, content), away: squadOf(s, s.clubs[fx.awayClubId]!, content) }, content);
    expect(result.score).toEqual({ home: 2, away: 1 });
    expect(result.winnerClubId).toBe(fx.homeClubId);
    expect(result.roundLineups).toHaveLength(3);
    expect(result.squads!.home.reserves).toHaveLength(2);
    const winners = new Set([...result.squads!.home.starters, ...result.squads!.home.reserves]);
    expect(winners.has(result.mvpFighterId!)).toBe(true);
    for (const st of Object.values(result.fighterStats)) expect(st.roundsPlayed).toBeGreaterThan(0);
    const played = result.roundLineups!.length * 10;
    expect(Object.values(result.fighterStats).reduce((n, st) => n + st.roundsPlayed, 0)).toBe(played);
  });
});

// ---- the week split, pause and resume (sw-009) --------------------------------------------------------------

function careerAt(engine: GameEngine, seed: string, weekId: string): GameState {
  const w = engine.createWorld(content, { rootSeed: seed });
  if (!w.ok) throw new Error(w.error.message);
  const club = Object.keys(w.value.clubs).sort()[0] as ClubId;
  const c = engine.applyCommand(w.value, { type: 'club.choose', clubId: club }, content);
  if (!c.ok) throw new Error(c.error.message);
  let s = c.value.state;
  for (let guard = 0; guard < 40 && s.calendar.weekId !== weekId; guard++) {
    if (engine.getBlockers(s, content).length > 0) {
      const fixed = engine.applyCommand(s, engine.suggestLineup(s, s.playerClubId!, content), content);
      if (!fixed.ok) throw new Error(fixed.error.message);
      s = fixed.value.state;
    }
    const r = engine.advanceWeek(s, content);
    if (!r.ok) throw new Error(r.error.message);
    s = r.value.state;
  }
  return s;
}

/** Continue until the week report arrives (accepting every suggestion); returns the states seen. */
function continueWeek(engine: GameEngine, state: GameState, reload = false): { final: GameState; pauses: number } {
  let s = state;
  for (let pauses = 0; pauses < 10; pauses++) {
    const r = engine.advance(s, content);
    if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
    if (r.value.week) return { final: r.value.state, pauses };
    expect(r.value.pause).not.toBeNull();
    expect(r.value.state.liveMatch).not.toBeNull();
    s = reload ? cloneJson(r.value.state) : r.value.state;
  }
  throw new Error('the week never finished');
}

describe('week processing round by round (sw-009)', () => {
  const engine = createGameEngine(createStandInPorts());
  const mw1 = careerAt(engine, 'live-1', 'MW1');

  it('advance pauses after round 1 of the player\'s match with the screen; the state is committed; getBlockers is empty', () => {
    const r = engine.advance(mw1, content);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { state, pause, week } = r.value;
    expect(week).toBeNull();
    expect(pause!.afterRound).toBe(1);
    expect(state.liveMatch!.phase).toBe('between_rounds');
    expect(state.liveMatch!.rounds).toHaveLength(1);
    expect(engine.betweenRoundView(state, content)).toEqual(pause);
    expect(engine.getBlockers(state, content)).toEqual([]);
    expect(state.calendar.weekId).toBe('MW1');
    // Nothing of the rest of the week has happened yet.
    expect(Object.keys(state.results)).toHaveLength(Object.keys(mw1.results).length);
    // Squad, roster and money commands wait; settings and the swap do not.
    const club = state.playerClubId!;
    const f = state.clubs[club]!.lineup.fighters[0]!.fighterId;
    const refuse = engine.applyCommand(state, { type: 'roster.release', clubId: club, fighterId: f }, content);
    expect(refuse.ok ? null : refuse.error.code).toBe('match.in-progress');
    expect(engine.applyCommand(state, { type: 'pacing.set', clubId: club, levelUpPacing: 'fast', pauseBetweenRounds: 'always' }, content).ok).toBe(true);
  });

  it('resuming after a reload equals playing on in memory, and equals the unpaused week (auto suggestions accepted)', () => {
    const inMemory = continueWeek(engine, mw1, false);
    const reloaded = continueWeek(engine, mw1, true);
    const unpaused = engine.advanceWeek(mw1, content);
    expect(unpaused.ok).toBe(true);
    if (!unpaused.ok) return;
    expect(inMemory.pauses).toBeGreaterThanOrEqual(1);
    expect(checksum(reloaded.final)).toBe(checksum(inMemory.final));
    expect(checksum(inMemory.final)).toBe(checksum(unpaused.value.state));
    expect(inMemory.final.liveMatch).toBeNull();
    expect(inMemory.final.calendar.weekId).not.toBe('MW1');
  });

  it('the player\'s match.swap decisions are applied at the step and recorded as player swaps', () => {
    const r = engine.advance(mw1, content);
    if (!r.ok) throw new Error(r.error.message);
    const s = r.value.state;
    const ms = s.liveMatch!;
    const side = ms.home.clubId === s.playerClubId ? 'home' : 'away';
    const swap = { out: ms[side].active[0]!, in: ms[side].unusedReserves[0]! };
    const bad = engine.applyCommand(s, { type: 'match.swap', clubId: s.playerClubId!, fixtureId: ms.fixtureId, afterRound: 1, swaps: [{ out: swap.in, in: swap.out }] }, content);
    expect(bad.ok ? null : bad.error.code).toBe('swap.not_active');
    const cmd = engine.applyCommand(s, { type: 'match.swap', clubId: s.playerClubId!, fixtureId: ms.fixtureId, afterRound: 1, swaps: [swap] }, content);
    if (!cmd.ok) throw new Error(cmd.error.message);
    const next = engine.advance(cmd.value.state, content);
    if (!next.ok) throw new Error(next.error.message);
    const after = next.value.state.liveMatch ?? null;
    const result = after ? null : next.value.state.results[ms.fixtureId]!;
    const steps = after ? after.betweenRounds : result!.betweenRounds!;
    expect(steps[0]![side]).toEqual([{ ...swap, row: ms[side].rows[0]!, reason: 'player', costsSwap: true }]);
  });

  it('pauseBetweenRounds never plays the week through; when_urgent pauses only on urgent steps', () => {
    const club = mw1.playerClubId!;
    const never = engine.applyCommand(mw1, { type: 'pacing.set', clubId: club, levelUpPacing: 'detailed', pauseBetweenRounds: 'never' }, content);
    if (!never.ok) throw new Error(never.error.message);
    const r = engine.advance(never.value.state, content);
    expect(r.ok && r.value.week !== null && r.value.pause === null).toBe(true);
    const urgent = engine.applyCommand(mw1, { type: 'pacing.set', clubId: club, levelUpPacing: 'detailed', pauseBetweenRounds: 'when_urgent' }, content);
    if (!urgent.ok) throw new Error(urgent.error.message);
    const u = engine.advance(urgent.value.state, content);
    if (!u.ok) throw new Error(u.error.message);
    if (u.value.pause) expect(u.value.pause.urgent).toBe(true);
  });

  it('a whole season through advance (pausing, accepting suggestions) is deterministic and matches advanceWeek', { timeout: 120_000 }, () => {
    const run = (paused: boolean): GameState => {
      let s = mw1;
      for (let guard = 0; guard < 30 && s.calendar.phase !== 'season-end'; guard++) {
        if (engine.getBlockers(s, content).length > 0) {
          const fixed = engine.applyCommand(s, engine.suggestLineup(s, s.playerClubId!, content), content);
          if (!fixed.ok) throw new Error(fixed.error.message);
          s = fixed.value.state;
        }
        if (paused) s = continueWeek(engine, s, true).final;
        else {
          const r = engine.advanceWeek(s, content);
          if (!r.ok) throw new Error(r.error.message);
          s = r.value.state;
        }
      }
      return s;
    };
    const a = run(true);
    expect(a.calendar.phase).toBe('season-end');
    expect(checksum(run(true))).toBe(checksum(a));
    expect(checksum(run(false))).toBe(checksum(a));
    const withSquads = Object.values(a.results).filter((r) => r.squads !== undefined);
    expect(withSquads.length).toBeGreaterThan(0);
    const swaps = withSquads.reduce((n, r) => n + (r.betweenRounds ?? []).reduce((m, b) => m + b.home.length + b.away.length, 0), 0);
    expect(swaps).toBeGreaterThan(0);
  });
});
