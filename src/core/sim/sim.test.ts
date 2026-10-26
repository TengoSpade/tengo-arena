/**
 * Contract tests on the frozen fixture content: determinism (T4, vis-009),
 * record-level invariance, the golden hash, match assembly and stats,
 * cmb-012, and a coarse speed check (the real bench is `npm run balance -- --bench`).
 */
import { describe, expect, it, vi } from 'vitest';
import { combatRating } from '../content';
import { SUMMARY_EVENT_TYPES, asId, hashEventStream, type MatchInput, type PerkId, type RoundInput } from '../model';
import { deriveSeed } from '../rng';
import { fixtureContent } from '../testkit';
import { ENGINE_VERSION, combatProfile, fighterInput, sideInput, simulateFight, simulateMatch, simulateRound } from './index';

const content = fixtureContent();
const HOME = ['oathguard', 'gutterknife', 'longeye', 'rimebinder', 'chirurgeon'];
const AWAY = ['siegebreaker', 'oathguard', 'longeye', 'chirurgeon', 'rimebinder'];

function match(seed = 'a1b2c3d4e5f60718', bestOf = 3): MatchInput {
  return { seed, bestOf, home: sideInput(content, 'home', HOME, 0, 1), away: sideInput(content, 'away', AWAY, 1, 0) };
}

/** M1.1 round input: ability ranks, perks, Freshness and a fresh entry on the home side. */
function m11Round(): RoundInput {
  const home = sideInput(content, 'home', HOME, 0, 1);
  const kit: [number, 1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3, string[], boolean][] = [
    [100, 2, 3, 1, ['g_banner_voice', 't_thick_plating'], false],
    [45, 3, 1, 2, ['m_keen_edge', 'g_second_breath'], false],
    [70, 1, 2, 1, ['r_steady_aim'], false],
    [30, 2, 2, 3, ['c_ready_mind', 'c_overload'], false],
    [90, 3, 3, 3, ['h_gentle_hands'], true],
  ];
  home.fighters = home.fighters.map((f, i) => {
    const [freshness, a1, a2, passive, perkIds, entered] = kit[i]!;
    return { ...f, freshness, abilityRanks: { a1, a2, passive }, perkIds: perkIds.map((id) => asId<PerkId>(id)), enteredThisRound: entered };
  });
  return { round: 2, home, away: sideInput(content, 'away', AWAY, 1, 0) };
}

describe('determinism (acc-det-01, acc-det-02)', () => {
  it('three runs give identical results, event hashes and checksums', () => {
    const runs = [0, 1, 2].map(() => simulateMatch(match(), content, { record: 'full' }));
    for (const r of runs.slice(1)) {
      expect(r.rounds).toEqual(runs[0]!.rounds);
      expect(r.logs!.map((l) => l.hash)).toEqual(runs[0]!.logs!.map((l) => l.hash));
      expect(r.fighterStats).toEqual(runs[0]!.fighterStats);
    }
    expect(runs[0]!.rounds.every((r) => r.eventHash !== null)).toBe(true);
    // The incremental hash equals hashEventStream over the finished log (the M2 viewer recomputes it).
    for (const level of ['summary', 'full'] as const) {
      for (const log of simulateMatch(match(), content, { record: level }).logs!) expect(log.hash).toBe(hashEventStream(log.header, log.events));
    }
  });

  it('checksums and results are identical at every record level', () => {
    const none = simulateMatch(match(), content, { record: 'none' });
    const summary = simulateMatch(match(), content, { record: 'summary' });
    const full = simulateMatch(match(), content, { record: 'full' });
    const strip = (rs: typeof none.rounds) => rs.map((r) => ({ ...r, eventHash: null }));
    expect(strip(summary.rounds)).toEqual(strip(none.rounds));
    expect(strip(full.rounds)).toEqual(strip(none.rounds));
    expect(summary.fighterStats).toEqual(none.fighterStats);
    expect(full.fighterStats).toEqual(none.fighterStats);
    expect(none.logs).toBeNull();
    expect(none.rounds.every((r) => r.eventHash === null)).toBe(true);
  });

  it('different seeds give different fights', () => {
    const a = simulateMatch(match('seed-a'), content);
    const b = simulateMatch(match('seed-b'), content);
    expect(a.rounds.map((r) => r.checksum)).not.toEqual(b.rounds.map((r) => r.checksum));
  });

  // The round checksums pin the fight itself. The event hash also covers the fight header (content hash):
  // re-pinned 2026-10 when the fixture content gained the D-P/D-T keys; checksums unchanged, no engine change.
  it('golden: the pinned fixture match hash (change only with an ENGINE_VERSION bump and architect approval)', () => {
    const out = simulateMatch(match(), content, { record: 'full' });
    expect(ENGINE_VERSION).toBe(2);
    expect({ score: out.score, rounds: out.rounds.map((r) => [r.winner, r.durationTicks, r.checksum, r.eventHash]) }).toMatchInlineSnapshot(`
      {
        "rounds": [
          [
            "away",
            712,
            "b1e30c26523f4bb4e72c3be884d0ad1b",
            "1c5d8e2e6d9a5c953d9e0dbb1c33cec8",
          ],
          [
            "away",
            906,
            "63652b166c526ace2db11b1768ab8d08",
            "049e8c97cd5b96099304baff5d075420",
          ],
        ],
        "score": {
          "away": 2,
          "home": 0,
        },
      }
    `);
  });

  // M1.1 round API golden (approved with ENGINE_VERSION 2): ranks, perks and Freshness on the fixture.
  it('golden: the pinned M1.1 round (ranks, perks, Freshness)', () => {
    const runs = [0, 1].map(() => simulateRound(m11Round(), 'r-golden', content, { record: 'full' }));
    expect(runs[1]!.result).toEqual(runs[0]!.result);
    const out = runs[0]!;
    expect([out.result.winner, out.result.durationTicks, out.result.checksum, out.log!.hash]).toMatchInlineSnapshot(`
      [
        "home",
        897,
        "65ef43bb008aa542664f4684f86b3308",
        "d16a5a14f5091c805c13a7f50b82fba6",
      ]
    `);
  });
});

describe('match assembly (sys-match)', () => {
  it('plays rounds until a majority of bestOf, with round seeds derived from the match seed', () => {
    for (const bestOf of [1, 3, 5]) {
      const out = simulateMatch(match('m', bestOf), content);
      const need = (bestOf + 1) / 2;
      expect(Math.max(out.score.home, out.score.away)).toBe(need);
      expect(out.rounds.length).toBe(out.score.home + out.score.away);
      expect(out.winner).toBe(out.score.home > out.score.away ? 'home' : 'away');
      out.rounds.forEach((r, i) => {
        expect(r.round).toBe(i + 1);
        expect(r.seed).toBe(deriveSeed('m', 'round', i + 1));
      });
    }
    expect(() => simulateMatch(match('m', 2), content)).toThrow();
  });

  it('per-fighter stats sum over rounds, the MVP comes from the winning side', () => {
    const out = simulateMatch(match('stats'), content);
    const ids = Object.keys(out.fighterStats);
    expect(ids).toHaveLength(10);
    for (const id of ids) {
      const s = out.fighterStats[id as never]!;
      expect(s.roundsPlayed).toBe(out.rounds.length);
      expect(s.downsSuffered).toBe(s.downs.length);
      expect(s.ruleFires.length).toBe(s.ruleCommittedTicks.length);
      expect(s.opponentIds).toHaveLength(5);
    }
    const winners = (out.winner === 'home' ? match().home : match().away).fighters.map((f) => f.fighterId as string);
    expect(winners).toContain(out.mvpFighterId);
    const downsInflicted = Object.values(out.fighterStats).reduce((a, s) => a + s.downsInflicted, 0);
    const downs = out.rounds.reduce((a, r) => a + r.downs.home + r.downs.away, 0);
    expect(downsInflicted).toBeLessThanOrEqual(downs);
  });

  it('round results carry survivors, downs and final HP for all 10 units', () => {
    const out = simulateFight({ seed: 's1', round: 1, home: match().home, away: match().away }, content);
    const r = out.result;
    expect(r.finalHp).toHaveLength(10);
    expect(r.survivors.home + r.downs.home).toBe(5);
    expect(r.survivors.away + r.downs.away).toBe(5);
    expect(r.finalHp.slice(0, 5).filter((h) => h > 0)).toHaveLength(r.survivors.home);
    if (r.endReason === 'elimination' && r.tiebreakStep === null) expect(r.winner === 'home' ? r.survivors.away : r.survivors.home).toBe(0);
  });
});

describe('event stream (sys-match-report)', () => {
  it('summary records only summary-level events; seq strictly increases, ticks never go back', () => {
    const out = simulateFight({ seed: 'ev', round: 1, home: match().home, away: match().away }, content, { record: 'summary' });
    const allowed = new Set<string>([...SUMMARY_EVENT_TYPES, 'cast.release', 'status.apply']);
    const evs = out.log!.events;
    expect(evs.every((e) => allowed.has(e.type))).toBe(true);
    expect(evs[0]!.type).toBe('fight.start');
    expect(evs.at(-1)!.type).toBe('round.summary');
    evs.forEach((e, i) => {
      expect(e.seq).toBe(i);
      if (i > 0) expect(e.tick).toBeGreaterThanOrEqual(evs[i - 1]!.tick);
    });
    expect(out.log!.header).toMatchObject({ format: 'arena-league-fight', engineVersion: ENGINE_VERSION, contentHash: content.ref.hash, tickMs: 50, arena: { width: 3200, height: 1800 } });
  });

  it('cmb-012: every round ends by tick 1,500 and rule fires sum to committed rule decisions', () => {
    for (const seed of ['c1', 'c2', 'c3', 'c4']) {
      const out = simulateFight({ seed, round: 1, home: match().home, away: match().away }, content, { record: 'full' });
      expect(out.result.durationTicks).toBeLessThanOrEqual(1500);
      const decides = new Map<number, number>();
      for (const e of out.log!.events) if (e.type === 'unit.decide' && e.data!.rule >= 0) decides.set(e.unit!, (decides.get(e.unit!) ?? 0) + 1);
      out.log!.header.units.forEach((u) => {
        const s = out.fighterStats[u.fighterId]!;
        expect(s.ruleFires.reduce((a, b) => a + b, 0)).toBe(decides.get(u.index) ?? 0);
      });
      const summary = out.log!.events.find((e) => e.type === 'round.summary')!;
      expect((summary.data as { units: unknown[] }).units).toHaveLength(10);
    }
  });
});

describe('combatProfile', () => {
  it('is deterministic and clamps attributes to 1-20', () => {
    const a = combatProfile(fighterInput(content, { classId: 'oathguard', stats: { tgh: 30 } }, 0), content);
    const b = combatProfile(fighterInput(content, { classId: 'oathguard', stats: { tgh: 20 } }, 0), content);
    expect(a).toEqual(b);
    expect(() => combatProfile(fighterInput(content, { classId: 'oathguard' }, 0) && { ...fighterInput(content, { classId: 'oathguard' }, 0), classId: 'nope' as never }, content)).toThrow();
  });
});

describe('speed (coarse; budget numbers come from npm run balance -- --bench)', () => {
  it('a 5v5 round at record none takes well under the p99 budget on average', () => {
    const clock = vi.getRealSystemTime;
    const t0 = clock();
    const n = 40;
    for (let i = 0; i < n; i++) simulateFight({ seed: `bench-${i}`, round: 1, home: match().home, away: match().away }, content);
    const perRound = (clock() - t0) / n;
    expect(perRound).toBeLessThan(25);
  });
});

describe('combat OVR (D-Q)', () => {
  it('fight inputs carry the same rating formula as fighters (core/content combatRating)', () => {
    const content = fixtureContent();
    for (const k of content.classes.list) {
      const stats = { str: 14, agi: 9, pac: 12, tgh: 16, pre: 7, arc: 11, spi: 5, wil: 13, cmp: 10, ldr: 18, awr: 6, dis: 12 };
      const input = fighterInput(content, { classId: k.id, stats }, 0);
      expect(input.rating).toBe(combatRating(content, k.id, input.stats));
      expect(fighterInput(content, { classId: k.id }, 0).rating).toBe(combatRating(content, k.id, fighterInput(content, { classId: k.id }, 0).stats));
    }
  });
});
