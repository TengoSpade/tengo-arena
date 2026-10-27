/**
 * M1.1 round-by-round matches (WP-C): combat-skills.md sw-001 … sw-009 (sw-007
 * lowest first, 05 M1.1 addendum §A4), progression.md ai-003 / ai-004, the
 * replay record, the week split and resume, determinism.
 */
import { describe, expect, it } from 'vitest';
import type { ContentDB } from '../content';
import { compactHistory, isCompactedResult } from '../league';
import { asId, putResult, type ClubId, type Fighter, type FighterId, type Fixture, type GameState, type MatchState, type RoundInput, type SwapDecision } from '../model';
import { buildFixtureWorld, fixtureContent, fixturePendingLevelUp, withFreshness } from '../testkit';
import { cloneJson, hashString, stableStringify } from '../util';
import {
  applyBetweenRound,
  autoSwapDecisions,
  betweenRounds,
  checkSwaps,
  createGameEngine,
  createStandInPorts,
  developmentSummary,
  finishMatch,
  playMatchAuto,
  playRound,
  realGamePorts,
  roundInputOf,
  startMatch,
  type GameEngine,
  type GamePorts,
} from './index';
import { buildMatchReport } from './match';
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

  it("blind view: the player's between-round view carries his own suggestions only; the opponent's pending auto-swap decision is blanked, never computed for him", () => {
    for (const playerSide of ['home', 'away', null] as const) {
      const ports = scripted({ winners: ['away', 'home', 'home'] });
      const { s, fx, home, away } = setup();
      s.playerClubId = playerSide === null ? null : playerSide === 'home' ? home : away;
      const ms = start(ports, s, fx);
      playRound(ports, s, ms, content);
      for (const id of [...ms.home.active, ...ms.away.active]) setFresh(s, id, 25);
      // Both sides would swap if they decided now (the AI's decision is real, and it still acts on it).
      const homeAuto = autoSwapDecisions(ports, s, ms, 'home', content);
      const awayAuto = autoSwapDecisions(ports, s, ms, 'away', content);
      expect(homeAuto.length).toBeGreaterThan(0);
      expect(awayAuto.length).toBeGreaterThan(0);
      const view = betweenRounds(ports, s, ms, content);
      expect(view.playerSide).toBe(playerSide);
      expect(view.home.suggestions).toEqual(playerSide === 'away' ? [] : homeAuto);
      expect(view.away.suggestions).toEqual(playerSide === 'home' ? [] : awayAuto);
      // Whatever the view says, the AI side decides by its rules when the step is applied.
      const before = cloneJson(ms);
      const applied = applyBetweenRound(ports, s, cloneJson(ms), { home: playerSide === 'home' ? [] : homeAuto, away: playerSide === 'away' ? [] : awayAuto }, content);
      expect(ms).toEqual(before);
      const aiSide = playerSide === 'home' ? 'away' : playerSide === 'away' ? 'home' : null;
      if (aiSide !== null) expect(applied.betweenRounds[0]![aiSide].map((r) => ({ out: r.out, in: r.in }))).toEqual(aiSide === 'home' ? homeAuto : awayAuto);
    }
  });

  it("blind view through the engine: advance() pauses with the opponent's suggestions blanked, and betweenRoundView(state) equals the pause", { timeout: 120_000 }, () => {
    const engine = createGameEngine(createStandInPorts());
    let state = careerAt(engine, 'blind-1', 'MW1');
    let pause: ReturnType<typeof engine.advance> | null = null;
    for (let guard = 0; guard < 8 && pause === null; guard++) {
      if (engine.getBlockers(state, content).length > 0) {
        const fixed = engine.applyCommand(state, engine.suggestLineup(state, state.playerClubId!, content), content);
        if (!fixed.ok) throw new Error(fixed.error.message);
        state = fixed.value.state;
      }
      const r = engine.advance(state, content);
      if (!r.ok) throw new Error(r.error.message);
      state = r.value.state;
      if (r.value.pause !== null) pause = r;
    }
    if (pause === null || !pause.ok || pause.value.pause === null) throw new Error('the match of the player never paused');
    const view = pause.value.pause;
    const other = view.playerSide === 'home' ? view.away : view.home;
    expect(view.playerSide).not.toBeNull();
    expect(other.suggestions).toEqual([]);
    expect(engine.betweenRoundView(state, content)).toEqual(view);
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

describe('levelUpView and levelup.choose', () => {
  it('lists pending offers oldest first with stat and rating after each stat pick, legality and the auto-pick; levelup.choose resolves one', () => {
    const engine = createGameEngine(createStandInPorts());
    const s = buildFixtureWorld({ clubLimit: 2, fightersPerClub: 8, squadReserves: 2 });
    const club = s.playerClubId!;
    const id = s.clubs[club]!.lineup.fighters[0]!.fighterId;
    const f = s.fighters[id]!;
    f.pendingLevelUps = [fixturePendingLevelUp(f, content, { level: f.level + 1 }), fixturePendingLevelUp(f, content, { level: f.level + 2 })];
    f.level += 2;
    expect(engine.levelUpView(s, s.clubs[club]!.lineup.fighters[1]!.fighterId, content)).toBeNull();
    const view = engine.levelUpView(s, id, content)!;
    expect(view.pending.map((p) => p.level)).toEqual([f.level - 1, f.level]);
    expect(view.mode).toBe('manual');
    const first = view.pending[0]!;
    expect(first.options).toHaveLength(3);
    for (const o of first.options) {
      expect(o.legal).toBe(true);
      if (o.option.kind === 'stat') expect(o.statAfter).toBe(engine.ports.fighters.effectiveStats({ ...f, train100: { ...f.train100, [o.option.stat]: f.train100[o.option.stat]! + o.option.gain100 } }, content)[o.option.stat]);
    }
    expect(first.autoPick.optionIndex).not.toBeNull();
    const r = engine.applyCommand(s, { type: 'levelup.choose', clubId: club, fighterId: id, level: first.level, optionIndex: 1, traitIndex: null }, content);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.state.fighters[id]!.pendingLevelUps.map((p) => p.level)).toEqual([f.level]);
    expect(r.value.state.fighters[id]!.season.levelLog.at(-1)).toMatchObject({ level: first.level, how: 'player', picked: first.options[1]!.option });
  });
});

describe('season summary picks and report perk procs (M1.1 integration)', () => {
  it('the development summary lists each fighter\'s level-up picks of the season (season-end resolutions included); the report carries perk procs', { timeout: 120_000 }, () => {
    const engine = createGameEngine(createStandInPorts());
    let s = careerAt(engine, 'picks-1', 'MW1');
    for (let guard = 0; guard < 30 && s.calendar.phase !== 'season-end'; guard++) {
      if (engine.getBlockers(s, content).length > 0) {
        const fixed = engine.applyCommand(s, engine.suggestLineup(s, s.playerClubId!, content), content);
        if (!fixed.ok) throw new Error(fixed.error.message);
        s = fixed.value.state;
      }
      const r = engine.advanceWeek(s, content);
      if (!r.ok) throw new Error(r.error.message);
      s = r.value.state;
    }
    const played = Object.values(s.results).find((r) => r.roundLineups !== undefined)!;
    const report = engine.buildMatchReport(s, played.fixtureId, content);
    if (!report.ok) throw new Error(report.error.message);
    if (report.value.timelineAvailable) for (const f of report.value.fighters) expect(f.perkProcs).toBeDefined();
    const pending = Object.values(s.fighters).filter((f) => f.pendingLevelUps.length > 0).map((f) => f.id);
    const season = s.calendar.season;
    const end = engine.runSeasonEnd(s, content);
    if (!end.ok) throw new Error(end.error.message);
    const rows = developmentSummary(end.value.state, season);
    const withPicks = rows.filter((r) => (r.picks ?? []).length > 0);
    expect(withPicks.length).toBeGreaterThan(0);
    for (const r of withPicks) for (const p of r.picks!) expect(p.season).toBe(season);
    for (const id of pending) {
      const row = rows.find((r) => r.fighterId === id);
      if (row) expect(row.picks!.some((p) => p.how === 'season_end')).toBe(true);
    }
  });
});

// ---- the match report covers everyone who started a round; compaction keeps the attribution -----------------

/** A match with a swap by the player, a forced reserve and an emergency entrant (the sw-003 script), played out with auto decisions. */
function playedWithEntrants(perClub = 8): { s: GameState; fx: Fixture; home: ClubId; away: ClubId; ports: GamePorts; result: ReturnType<typeof finishMatch>; entrant: FighterId; swappedIn: FighterId[] } {
  const { s, fx, home, away } = setup({ bestOf: 5, perClub });
  const injured = s.clubs[home]!.lineup.fighters[3]!.fighterId;
  // The real sim, so downs and damage are credited as in the game (the stand-in sim does not credit downs).
  const ports = scripted({ sim: realGamePorts.sim, winners: ['away', 'home', 'away', 'home', 'home'], injure: { 3: [injured] } });
  const ms = start(ports, s, fx);
  const swappedIn: FighterId[] = [];
  playRound(ports, s, ms, content);
  swappedIn.push(ms.home.unusedReserves[0]!);
  applyBetweenRound(ports, s, ms, { home: [{ out: ms.home.active[0]!, in: ms.home.unusedReserves[0]! }], away: [] }, content);
  playRound(ports, s, ms, content);
  swappedIn.push(ms.home.unusedReserves[0]!);
  applyBetweenRound(ports, s, ms, { home: [{ out: ms.home.active[1]!, in: ms.home.unusedReserves[0]! }], away: [] }, content);
  playRound(ports, s, ms, content);
  applyBetweenRound(ports, s, ms, none, content);
  const entrant = ms.home.emergencyEntrants[0]!;
  playRound(ports, s, ms, content);
  while (ms.phase !== 'done') {
    applyBetweenRound(ports, s, ms, none, content);
    playRound(ports, s, ms, content);
  }
  const result = finishMatch(ports, s, ms, content);
  putResult(s, result);
  fx.status = 'played';
  return { s, fx, home, away, ports, result, entrant, swappedIn };
}

describe('match report: every fighter who started a round (QA: "us 8 downs" against 10 inflicted)', () => {
  it('lists the round-1 five, both swapped-in reserves and the emergency entrant, with stats and a total that is their sum', () => {
    const { s, fx, home, away, ports, result, entrant, swappedIn } = playedWithEntrants();
    const r = buildMatchReport(ports, s, fx.id, content);
    if (!r.ok) throw new Error(r.error.message);
    const report = r.value;
    const five = result.input.home.fighters.map((f) => f.fighterId);
    // appearedIds: the five in slot order, then the entrants as they came on.
    expect(report.home.fighterIds).toEqual(five);
    expect(report.home.appearedIds).toEqual(expect.arrayContaining([...five, ...swappedIn, entrant]));
    expect(report.home.appearedIds!.slice(0, 5)).toEqual(five);
    expect(report.home.appearedIds).toHaveLength(five.length + swappedIn.length + 1);
    expect(report.home.unusedReserveIds).toEqual([]);
    expect(report.away.appearedIds).toEqual(report.away.fighterIds);
    // Every one of them has a line (stats, roles, rounds started), attributed to the right club.
    const line = (id: FighterId) => report.fighters.find((f) => f.fighterId === id)!;
    for (const id of report.home.appearedIds!) expect(line(id).clubId).toBe(home);
    for (const id of report.away.appearedIds!) expect(line(id).clubId).toBe(away);
    expect(report.fighters).toHaveLength(report.home.appearedIds!.length + report.away.appearedIds!.length);
    for (const id of swappedIn) {
      expect(line(id).role).toBe('reserve');
      expect(line(id).stats.roundsPlayed).toBe(line(id).roundsStarted!.length);
      expect(line(id).roundsStarted![0]).toBeGreaterThan(1);
    }
    expect(line(entrant).role).toBe('emergency');
    expect(line(entrant).roundsStarted).toEqual([4, 5].slice(0, result.rounds.length - 3));
    expect(line(five[0]!).role).toBe('starter');
    expect(line(five[0]!).roundsStarted).toEqual([1]); // swapped out after round 1
    // Team totals equal the sum of the fighters, and the two sides mirror each other.
    for (const side of ['home', 'away'] as const) {
      const mine = report.fighters.filter((f) => f.clubId === report[side].clubId);
      const sum = (k: 'downsInflicted' | 'downsSuffered' | 'damageDealt' | 'healingDone' | 'damageTaken' | 'shieldingDone') => mine.reduce((n, f) => n + f.stats[k], 0);
      expect(report.totals![side]).toMatchObject({
        downsInflicted: sum('downsInflicted'),
        downsSuffered: sum('downsSuffered'),
        damageDealt: sum('damageDealt'),
        healingDone: sum('healingDone'),
        damageTaken: sum('damageTaken'),
        shieldingDone: sum('shieldingDone'),
      });
      expect(report.totals![side].xp).toBe(mine.reduce((n, f) => n + (report.aftermath.xp[f.fighterId] ?? 0), 0));
    }
    expect(report.totals!.home.downsInflicted).toBe(report.totals!.away.downsSuffered);
    expect(report.totals!.away.downsInflicted).toBe(report.totals!.home.downsSuffered);
    // The five alone (what a screen that only reads the round-1 lineup sums) fall short of the team total when a reserve scored.
    const fiveOnly = report.fighters.filter((f) => five.includes(f.fighterId)).reduce((n, f) => n + f.stats.damageDealt, 0);
    expect(report.totals!.home.damageDealt).toBeGreaterThanOrEqual(fiveOnly);
    expect(report.totals!.home.damageDealt).toBe(report.fighters.filter((f) => f.clubId === home).reduce((n, f) => n + f.stats.damageDealt, 0));
  });

  it('unused reserves are listed apart; a whole-match (M1) result lists its five', () => {
    const { s, fx, home } = setup({ bestOf: 3 });
    const p = scripted();
    const ms = start(p, s, fx);
    while (ms.phase !== 'done') {
      if (ms.phase === 'between_rounds') applyBetweenRound(p, s, ms, none, content);
      playRound(p, s, ms, content);
    }
    const result = finishMatch(p, s, ms, content);
    putResult(s, result);
    const r = buildMatchReport(p, s, fx.id, content);
    if (!r.ok) throw new Error(r.error.message);
    const reserves = s.clubs[home]!.lineup.reserves;
    expect(r.value.home.appearedIds).toEqual(r.value.home.fighterIds);
    expect(r.value.home.unusedReserveIds).toEqual(reserves);
    expect(r.value.fighters.every((f) => f.role === 'starter')).toBe(true);
    // M1: no squads, no round lineups.
    const m1 = cloneJson(result);
    delete m1.squads;
    delete m1.reserveInputs;
    delete m1.roundLineups;
    delete m1.betweenRounds;
    delete m1.emergencyEntrants;
    const t = cloneJson(s);
    t.results[fx.id] = m1;
    const old = buildMatchReport(p, t, fx.id, content);
    if (!old.ok) throw new Error(old.error.message);
    expect(old.value.home.appearedIds).toEqual(old.value.home.fighterIds);
    expect(old.value.home.unusedReserveIds).toEqual([]);
    expect(old.value.fighters.every((f) => f.roundsStarted === undefined)).toBe(true);
    expect(old.value.totals!.home.downsInflicted).toBe(old.value.fighters.filter((f) => f.clubId === home).reduce((n, f) => n + f.stats.downsInflicted, 0));
  });

  it('bench XP: every non-starter of both clubs (unused reserves first) earns a third, stored with the match and listed in the report', { timeout: 120_000 }, () => {
    const engine = createGameEngine(createStandInPorts());
    let s = careerAt(engine, 'bench-xp-1', 'MW1');
    for (let guard = 0; guard < 6; guard++) {
      if (engine.getBlockers(s, content).length > 0) {
        const fixed = engine.applyCommand(s, engine.suggestLineup(s, s.playerClubId!, content), content);
        if (!fixed.ok) throw new Error(fixed.error.message);
        s = fixed.value.state;
      }
      const r = engine.advanceWeek(s, content);
      if (!r.ok) throw new Error(r.error.message);
      s = r.value.state;
    }
    const mine = Object.values(s.results).find((r) => r.roundLineups !== undefined && (r.homeClubId === s.playerClubId || r.awayClubId === s.playerClubId))!;
    const rep = engine.buildMatchReport(s, mine.fixtureId, content);
    if (!rep.ok) throw new Error(rep.error.message);
    const report = rep.value;
    expect(report.bench).toBeDefined();
    expect(report.aftermath.benchXp).toBeDefined();
    const appeared = new Set([...report.home.appearedIds!, ...report.away.appearedIds!]);
    for (const line of report.bench!) {
      expect(appeared.has(line.fighterId)).toBe(false); // started no round
      expect(report.aftermath.benchXp![line.fighterId]).toBe(line.xp);
      expect(s.fighters[line.fighterId]?.clubId).toBe(line.clubId);
      expect(line.xp).toBeGreaterThan(0);
    }
    // A squad reserve who never came on is on the list as a 'reserve', before the rest of his club's bench.
    for (const side of ['home', 'away'] as const) {
      const lines = report.bench!.filter((b) => b.clubId === report[side].clubId);
      expect(lines.map((b) => b.fighterId)).toEqual(expect.arrayContaining(report[side].unusedReserveIds!));
      expect(lines.filter((b) => b.role === 'reserve').map((b) => b.fighterId)).toEqual(report[side].unusedReserveIds);
      const roles = lines.map((b) => b.role);
      expect(roles).toEqual([...roles].sort((a, b) => (a === b ? 0 : a === 'reserve' ? -1 : 1)));
      expect(report.totals![side].benchXp).toBe(lines.reduce((n, b) => n + b.xp, 0));
    }
    // The bench is both clubs' fit non-starters: nobody who started appears, nobody twice.
    expect(new Set(report.bench!.map((b) => b.fighterId)).size).toBe(report.bench!.length);
    // And the same XP landed on the fighters (season counters), not just in the report.
    const sample = report.bench![0]!;
    expect(s.fighters[sample.fighterId]!.season.benchXp).toBeGreaterThanOrEqual(sample.xp);
  });
});

describe('match report box score (R2-T001): damage, healing, shielding, downs and Freshness, per match and per round', () => {
  const KEYS = ['damageDone', 'damageReceived', 'healingDone', 'healingReceived', 'shieldingDone', 'downsInflicted', 'downsSuffered'] as const;

  it('every fighter who started a round has a box: the stored match counters, a line per round started that adds up to them, and Freshness before and after', () => {
    const { s, fx, home, ports, result, entrant, swappedIn } = playedWithEntrants();
    const r = buildMatchReport(ports, s, fx.id, content);
    if (!r.ok) throw new Error(r.error.message);
    const report = r.value;
    expect(report.timelineAvailable).toBe(true);
    expect(report.fighters.length).toBeGreaterThan(10);
    for (const f of report.fighters) {
      const box = f.box!;
      expect(box, f.fighterId).toBeDefined();
      expect(box).toMatchObject({
        damageDone: f.stats.damageDealt,
        damageReceived: f.stats.damageTaken,
        healingDone: f.stats.healingDone,
        healingReceived: f.stats.healingReceived,
        shieldingDone: f.stats.shieldingDone,
        downsInflicted: f.stats.downsInflicted,
        downsSuffered: f.stats.downsSuffered,
        roundsStarted: f.roundsStarted!.length,
      });
      expect(box.healingReceived).toBeDefined();
      // One line per round he started, and the lines add up to the match.
      expect(box.rounds.map((x) => x.round)).toEqual(f.roundsStarted);
      for (const k of KEYS) expect(box.rounds.reduce((n, x) => n + (x[k] ?? 0), 0), `${f.fighterId} ${k}`).toBe(box[k]);
      // Freshness: what he took the field with, and where each round's drain left him.
      const side = f.clubId === home ? 'home' : 'away';
      box.rounds.forEach((x) => {
        const lineup = result.roundLineups![x.round - 1]![side];
        const slot = lineup.fighterIds.indexOf(f.fighterId);
        expect(x.freshnessBefore).toBe(lineup.freshness[slot]);
        expect(x.freshnessAfter).toBe(lineup.freshnessAfter![slot]);
        expect(x.freshnessAfter!).toBeLessThanOrEqual(x.freshnessBefore!);
      });
      expect(box.freshnessBefore).toBe(box.rounds[0]!.freshnessBefore);
      expect(box.freshnessAfter).toBe(box.rounds.at(-1)!.freshnessAfter);
    }
    // Swapped-in reserves and the emergency entrant are in, with the Freshness they entered on.
    for (const id of [...swappedIn, entrant]) expect(report.fighters.find((f) => f.fighterId === id)!.box!.roundsStarted).toBeGreaterThan(0);
    // Team totals are the sums of the lines; healing is only ever aimed at allies, so received never exceeds done (Deathward's heal above 1 HP aside).
    for (const side of ['home', 'away'] as const) {
      const t = report.totals![side];
      const sum = (k: (typeof KEYS)[number]) => report.fighters.filter((f) => f.clubId === report[side].clubId).reduce((n, f) => n + (f.box![k] ?? 0), 0);
      expect(t.healingReceived).toBe(sum('healingReceived'));
      expect(t.healingReceived!).toBeLessThanOrEqual(t.healingDone);
      expect(t.damageDealt).toBe(sum('damageDone'));
    }
    // Per-round team totals are the sum of the fighters' lines of that round, and the sides mirror each other.
    for (const rd of report.rounds) {
      for (const side of ['home', 'away'] as const) {
        const lines = report.fighters.filter((f) => f.clubId === report[side].clubId).flatMap((f) => f.box!.rounds.filter((x) => x.round === rd.round));
        expect(lines).toHaveLength(5);
        for (const k of KEYS) expect(rd.totals![side][k], `round ${rd.round} ${side} ${k}`).toBe(lines.reduce((n, x) => n + (x[k] ?? 0), 0));
      }
      expect(rd.totals!.home.downsInflicted).toBe(rd.totals!.away.downsSuffered);
      expect(rd.totals!.home.damageDone).toBe(rd.totals!.away.damageReceived);
    }
  });

  it('results played before the new counters: healing received is re-derived from the re-simulated rounds, Freshness after is null', () => {
    const { s, fx, ports } = playedWithEntrants();
    const fresh = buildMatchReport(ports, s, fx.id, content);
    if (!fresh.ok) throw new Error(fresh.error.message);
    const t = cloneJson(s);
    const res = t.results[fx.id]!;
    for (const st of Object.values(res.fighterStats)) delete st.healingReceived;
    for (const rl of res.roundLineups!) {
      delete rl.home.freshnessAfter;
      delete rl.away.freshnessAfter;
    }
    const old = buildMatchReport(ports, t, fx.id, content);
    if (!old.ok) throw new Error(old.error.message);
    expect(old.value.timelineAvailable).toBe(true);
    for (const f of old.value.fighters) {
      const before = fresh.value.fighters.find((x) => x.fighterId === f.fighterId)!.box!;
      expect(f.box!.healingReceived).toBe(before.healingReceived);
      expect(f.box!.freshnessAfter).toBeNull();
      expect(f.box!.freshnessBefore).toBe(before.freshnessBefore);
      expect(f.box!.rounds.every((x) => x.freshnessAfter === null)).toBe(true);
    }
    expect(old.value.totals!.home.healingReceived).toBe(fresh.value.totals!.home.healingReceived);
    // No timeline (another engine version): the totals keep what was stored, the per-round lines are empty, nothing is invented.
    const stale = cloneJson(t);
    stale.results[fx.id]!.engineVersion = -1;
    const noTimeline = buildMatchReport(ports, stale, fx.id, content);
    if (!noTimeline.ok) throw new Error(noTimeline.error.message);
    expect(noTimeline.value.timelineAvailable).toBe(false);
    for (const f of noTimeline.value.fighters) {
      expect(f.box!.rounds).toEqual([]);
      expect(f.box!.healingReceived).toBeUndefined();
      expect(f.box!.damageDone).toBe(f.stats.damageDealt);
      expect(f.box!.roundsStarted).toBe(f.roundsStarted!.length);
    }
    expect(noTimeline.value.rounds.every((rd) => rd.totals === undefined)).toBe(true);
    expect(noTimeline.value.totals!.home.healingReceived).toBeUndefined();
    // The same result with the stored counter still reports it without a timeline.
    const storedOnly = cloneJson(s);
    storedOnly.results[fx.id]!.engineVersion = -1;
    const kept = buildMatchReport(ports, storedOnly, fx.id, content);
    if (!kept.ok) throw new Error(kept.error.message);
    for (const f of kept.value.fighters) expect(f.box!.healingReceived).toBe(fresh.value.fighters.find((x) => x.fighterId === f.fighterId)!.box!.healingReceived);
  });

  it('a whole-match (M1) result has totals and no Freshness; a compacted report has no box (stats keeps the few totals it has)', () => {
    const { s, fx, ports } = playedWithEntrants();
    const m1 = cloneJson(s);
    const r1 = m1.results[fx.id]!;
    delete r1.squads;
    delete r1.reserveInputs;
    delete r1.roundLineups;
    delete r1.betweenRounds;
    delete r1.emergencyEntrants;
    const old = buildMatchReport(ports, m1, fx.id, content);
    if (!old.ok) throw new Error(old.error.message);
    for (const f of old.value.fighters) {
      expect(f.box).toMatchObject({ freshnessBefore: null, freshnessAfter: null, rounds: [], damageDone: f.stats.damageDealt, roundsStarted: f.stats.roundsPlayed });
    }
    s.playerClubId = null;
    s.calendar = { ...s.calendar, season: 2 };
    compactHistory(s, content);
    const compacted = buildMatchReport(ports, s, fx.id, content);
    if (!compacted.ok) throw new Error(compacted.error.message);
    expect(compacted.value.compacted).toBe(true);
    expect(compacted.value.fighters.every((f) => f.box === undefined)).toBe(true);
    expect(compacted.value.totals!.home.healingReceived).toBeUndefined();
  });
});

describe('compaction keeps the attribution of every fighter (QA: emergency entrants vanished from old reports)', () => {
  it('drops the per-round records and per-fighter stats, keeps score, squads summary and per-fighter totals with the club', () => {
    const { s, fx, home, away, ports, result, entrant, swappedIn } = playedWithEntrants();
    expect(result.reserveInputs!.home.length).toBeGreaterThan(0);
    const full = buildMatchReport(ports, s, fx.id, content);
    if (!full.ok) throw new Error(full.error.message);
    s.playerClubId = null; // no exempt club: everything of the previous season compacts
    s.calendar = { ...s.calendar, season: 2 };
    compactHistory(s, content);
    const c = s.results[fx.id]!;
    expect(isCompactedResult(c)).toBe(true);
    expect(c.reserveInputs).toBeUndefined();
    expect(c.roundLineups).toBeUndefined();
    expect(c.betweenRounds).toBeUndefined();
    expect(c.fighterStats).toEqual({});
    expect(c.score).toEqual(result.score);
    expect(c.emergencyEntrants).toEqual([entrant]);
    expect(c.squads!.home.starters).toEqual(result.squads!.home.starters);
    expect(c.squads!.home.reserves).toEqual(result.squads!.home.reserves);
    expect(c.squads!.home.rows).toEqual({});
    // One tuple per fighter who started a round, club by side.
    expect(Object.keys(c.fighterTotals!).sort()).toEqual(Object.keys(result.fighterStats).sort());
    expect(c.fighterTotals![entrant]).toEqual([0, result.fighterStats[entrant]!.roundsPlayed, result.fighterStats[entrant]!.downsInflicted, result.fighterStats[entrant]!.downsSuffered, result.fighterStats[entrant]!.damageDealt, result.fighterStats[entrant]!.healingDone]);
    // The report of the compacted match still attributes every fighter correctly and its totals match the full report's.
    const old = buildMatchReport(ports, s, fx.id, content);
    if (!old.ok) throw new Error(old.error.message);
    const report = old.value;
    expect(report.compacted).toBe(true);
    expect(report.timelineAvailable).toBe(false);
    expect(report.timeline).toBeNull();
    expect(report.score).toEqual(full.value.score);
    for (const side of ['home', 'away'] as const) expect([...report[side].appearedIds!].sort()).toEqual([...full.value[side].appearedIds!].sort());
    expect(report.home.appearedIds).toEqual(expect.arrayContaining([entrant, ...swappedIn]));
    for (const f of report.fighters) {
      expect(f.clubId).toBe(report.home.appearedIds!.includes(f.fighterId) ? home : away);
      const before = full.value.fighters.find((x) => x.fighterId === f.fighterId)!;
      expect(f.clubId).toBe(before.clubId);
      expect(f.role).toBe(before.role);
      expect(f.stats).toMatchObject({
        roundsPlayed: before.stats.roundsPlayed,
        downsInflicted: before.stats.downsInflicted,
        downsSuffered: before.stats.downsSuffered,
        damageDealt: before.stats.damageDealt,
        healingDone: before.stats.healingDone,
      });
    }
    expect(report.fighters.find((f) => f.fighterId === entrant)!.role).toBe('emergency');
    for (const side of ['home', 'away'] as const) {
      const { damageTaken, shieldingDone, ...kept } = full.value.totals![side];
      void damageTaken;
      void shieldingDone;
      expect(report.totals![side]).toMatchObject({ downsInflicted: kept.downsInflicted, downsSuffered: kept.downsSuffered, damageDealt: kept.damageDealt, healingDone: kept.healingDone });
      expect(report.totals![side].damageTaken).toBeUndefined();
    }
    // Compacting twice changes nothing.
    const once = cloneJson(s.results[fx.id]);
    compactHistory(s, content);
    expect(s.results[fx.id]).toEqual(once);
  });

  it('timelineOf attributes emergency entrants without per-fighter stats (results compacted by an earlier build kept the lineups but emptied fighterStats)', () => {
    const { s, fx, home, ports, result, entrant } = playedWithEntrants();
    const legacy = cloneJson(result);
    legacy.fighterStats = {};
    legacy.input.home.fighters = [];
    legacy.input.away.fighters = [];
    s.results[fx.id] = legacy;
    const r = buildMatchReport(ports, s, fx.id, content);
    if (!r.ok) throw new Error(r.error.message);
    const tl = r.value.timeline!;
    expect(tl).not.toBeNull();
    expect(tl.emergencyEntrants).toEqual([entrant]);
    expect(tl.fighters[entrant]).toMatchObject({ side: 'home', role: 'emergency', enteredHow: 'emergency' });
    expect(s.clubs[home]!.id).toBe(home);
    // The sides' appeared lists still come out right from the round lineups.
    expect(r.value.home.appearedIds).toContain(entrant);
    expect(r.value.away.appearedIds).not.toContain(entrant);
  });
});
