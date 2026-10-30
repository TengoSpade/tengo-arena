/**
 * Log format 2 (05-technical-m2 §A2, tech-016; WP-M2A): frames carry shield and focus, the log closes with a frame at
 * the end tick, the header names its format. No outcome and no round checksum moves, summary events are untouched, and
 * the fast-path hash still equals the full hash. Run on the shipped content (content/default) and the fixture.
 */
import { describe, expect, it } from 'vitest';
import { loadContent, type ContentDB, type ContentFileName, type RawContentFiles } from '../content';
import { FIGHT_LOG_FORMAT_VERSION, asId, hashEventStream, type FightEvent, type FightLog, type PerkId, type RoundInput } from '../model';
import { fixtureContent } from '../testkit';
import { StreamHasher, stableStringify } from '../util';
import { corpusRound } from './corpus';
import { Fight } from './fight';
import { ENGINE_VERSION, simulateMatch, simulateRound, sideInput } from './index';

const rawFiles = import.meta.glob('../../../content/default/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

function loadDefault(): ContentDB {
  const raw: RawContentFiles = {};
  for (const [path, json] of Object.entries(rawFiles)) raw[path.split('/').pop()!.replace(/\.json$/, '') as ContentFileName] = json;
  const r = loadContent('default', raw);
  if (!r.ok) throw new Error(`content/default invalid: ${r.error.map((e) => e.message).join('; ')}`);
  return r.value;
}

const content = loadDefault();
const ROUNDS = 40;
const corpus = Array.from({ length: ROUNDS }, (_, i) => corpusRound(content, i));
const fullRuns = corpus.map(({ input, seed }) => simulateRound(input, seed, content, { record: 'full' }));

type Frame = Extract<FightEvent, { type: 'frame' }>;
const framesOf = (log: FightLog): Frame[] => log.events.filter((e): e is Frame => e.type === 'frame');

describe('log format 2: header and closing frame', () => {
  it('names format 2 in the header at summary and full, and the version is 2', () => {
    expect(FIGHT_LOG_FORMAT_VERSION).toBe(2);
    expect(ENGINE_VERSION).toBe(2);
    const { input, seed } = corpus[0]!;
    for (const level of ['summary', 'full'] as const) expect(simulateRound(input, seed, content, { record: level }).log!.header.logFormat).toBe(2);
    expect(simulateRound(input, seed, content, { record: 'none' }).log).toBeNull();
  });

  it('every frame carries [x, y, hp, stateBits, shield, focus] as integers', () => {
    for (const run of fullRuns) {
      for (const frame of framesOf(run.log!)) {
        expect(frame.data!.u).toHaveLength(10);
        for (const unit of frame.data!.u) {
          expect(unit).toHaveLength(6);
          expect(unit.every((n) => Number.isInteger(n))).toBe(true);
          const [, , hp, bits, shield, focus] = unit;
          expect(hp).toBeGreaterThanOrEqual(0);
          expect(shield!).toBeGreaterThanOrEqual(0);
          expect(focus!).toBeGreaterThanOrEqual(0);
          expect(focus!).toBeLessThanOrEqual(100);
          if ((bits & 16) !== 0) expect([hp, shield]).toEqual([0, 0]);
        }
      }
    }
  });

  it('closes with a frame at the end tick, after fight.end and before round.summary, showing the final state', () => {
    for (const run of fullRuns) {
      const events = run.log!.events;
      const end = events.find((e) => e.type === 'fight.end')!;
      const last = events[events.length - 1]!;
      expect(last.type).toBe('round.summary');
      const closing = events[events.length - 2]!;
      expect(closing.type).toBe('frame');
      expect(closing.tick).toBe(end.tick);
      expect(events.indexOf(closing)).toBeGreaterThan(events.indexOf(end));
      expect(end.tick).toBe(run.result.durationTicks - 1);
      // The closing frame is the final state: the same HP the result reports, the downed marked.
      const units = (closing as Frame).data!.u;
      expect(units.map((u) => u[2])).toEqual(run.result.finalHp);
      units.forEach((u) => expect((u[3] & 16) !== 0).toBe(u[2] === 0));
    }
  });

  it('frames come every 2 ticks from tick 0, plus the closing one when the round ends on an odd tick; seq and ticks never go backwards', () => {
    for (const run of fullRuns) {
      const frames = framesOf(run.log!);
      const endTick = run.result.durationTicks - 1;
      const expected = Array.from({ length: Math.floor(endTick / 2) + 1 }, (_, i) => i * 2);
      if (endTick % 2 === 1) expected.push(endTick);
      expect(frames.map((f) => f.tick)).toEqual(expected);
      run.log!.events.forEach((e, i) => {
        expect(e.seq).toBe(i);
        if (i > 0) expect(e.tick).toBeGreaterThanOrEqual(run.log!.events[i - 1]!.tick);
      });
    }
  });
});

describe('log format 2: frames match the sim state', () => {
  it('each frame is the state at the end of its tick (stepped white-box check: hp, shield, focus, bits)', () => {
    for (const idx of [0, 3, 7, 12, 21, 30]) {
      const { input, seed } = corpus[idx]!;
      const f = new Fight(content, { seed, round: input.round, home: input.home, away: input.away }, 'full');
      f.start();
      let seen = 0;
      let framesChecked = 0;
      while (!f.ended) {
        const t = f.tick;
        f.step();
        const events = f.rec!.events;
        const fresh = events.slice(seen);
        seen = events.length;
        for (const e of fresh) {
          if (e.type !== 'frame') continue;
          expect(e.tick).toBe(t);
          e.data!.u.forEach((unit, i) => {
            const u = f.units[i]!;
            // Independent of Fight.frameUnit: read the unit's own fields.
            let shield = 0;
            for (const s of u.shields) if (s.amount > 0 && s.end > t) shield += s.amount;
            expect(unit.slice(2)).toEqual([u.hp, unit[3], shield, Math.trunc(u.focus / 1000)]);
            expect((unit[3] & 16) !== 0).toBe(!u.standing);
          });
          framesChecked++;
        }
      }
      expect(framesChecked).toBeGreaterThan(20);
    }
  });

  // Shield dispels (an effect of the dispel type) remove shield points without an event of their own, so a frame may show
  // less than the events give, and only within a window after a dispel-capable ability was released.
  it('shield follows shield.gain, absorbed hits (hit.toShield), expiry and downs, reconstructed from events (dispels aside)', () => {
    let gains = 0;
    let checks = 0;
    let dispelled = 0;
    const dispelAbilities = new Set(content.abilities.list.filter((a) => JSON.stringify(a).includes('"type":"dispel"')).map((a) => a.id));
    for (const run of fullRuns) {
      const pools: { amount: number; end: number; order: number }[][] = Array.from({ length: 10 }, () => []);
      let order = 0;
      const dispelReleases: number[] = [];
      for (const e of run.log!.events) {
        if (e.type === 'cast.release' && dispelAbilities.has(e.data!.ability)) dispelReleases.push(e.tick);
        if (e.type === 'shield.gain') {
          pools[e.unit!]!.push({ amount: e.data!.amount, end: e.data!.expiresTick, order: order++ });
          gains++;
        } else if (e.type === 'hit' && e.data!.toShield > 0) {
          let rem = e.data!.toShield;
          const pool = pools[e.target!]!.filter((s) => s.end >= e.tick).sort((a, b) => a.end - b.end || a.order - b.order);
          for (const s of pool) {
            const take = Math.min(s.amount, rem);
            s.amount -= take;
            rem -= take;
          }
          expect(rem).toBe(0);
        } else if (e.type === 'unit.down') {
          pools[e.unit!]!.length = 0;
        } else if (e.type === 'frame') {
          e.data!.u.forEach((unit, i) => {
            const expected = pools[i]!.reduce((sum, s) => sum + (s.amount > 0 && s.end > e.tick ? s.amount : 0), 0);
            if (unit[4] !== expected) {
              // Only a dispel can take shield away silently, and only after one was released not long before.
              expect(unit[4], `unit ${i} at tick ${e.tick}`).toBeLessThan(expected);
              expect(dispelReleases.some((t) => t <= e.tick && t >= e.tick - 60), `a dispel before tick ${e.tick}`).toBe(true);
              pools[i] = unit[4]! > 0 ? [{ amount: unit[4]!, end: e.tick + 1, order: order++ }] : [];
              dispelled++;
            }
            checks++;
          });
        }
      }
    }
    // The corpus must actually exercise shields.
    expect(gains).toBeGreaterThan(30);
    expect(checks).toBeGreaterThan(10_000);
    expect(dispelled).toBeLessThan(gains / 4);
  });

  it('focus is lower in the first frame after a cast.release that spent it than in the last frame before', () => {
    let releases = 0;
    for (const run of fullRuns) {
      const events = run.log!.events;
      const frames = framesOf(run.log!);
      for (const e of events) {
        if (e.type !== 'cast.release' || e.data!.focusSpent < 15) continue;
        const before = [...frames].reverse().find((f) => f.tick < e.tick);
        const after = frames.find((f) => f.tick >= e.tick);
        if (!before || !after || after.tick - before.tick > 2) continue;
        // Regeneration over two ticks is about a point; the cost is at least 15.
        const u = e.unit!;
        expect(after.data!.u[u]![5]! + e.data!.focusSpent).toBeLessThanOrEqual(before.data!.u[u]![5]! + 3);
        releases++;
      }
    }
    expect(releases).toBeGreaterThan(20);
  });
});

describe('log format 2 changes no outcome and nothing but frames and the header', () => {
  it('results and round checksums are identical at none, summary and full', () => {
    for (const { input, seed } of corpus.slice(0, 20)) {
      const none = simulateRound(input, seed, content, { record: 'none' });
      for (const level of ['summary', 'full'] as const) {
        const other = simulateRound(input, seed, content, { record: level });
        expect({ ...other.result, eventHash: null }).toEqual(none.result);
        expect(other.aftermath).toEqual(none.aftermath);
        expect(other.fighterStats).toEqual(none.fighterStats);
      }
    }
  });

  it('the fast-path hash equals hashEventStream over the finished log, summary and full (six-element frames)', () => {
    for (const { input, seed } of corpus) {
      for (const level of ['summary', 'full'] as const) {
        const log = simulateRound(input, seed, content, { record: level }).log!;
        expect(log.hash).toBe(hashEventStream(log.header, log.events));
      }
    }
    // And through the match API at full.
    const match = simulateMatch({ seed: 'f2-match', bestOf: 3, home: corpus[1]!.input.home, away: corpus[1]!.input.away }, content, { record: 'full' });
    for (const log of match.logs!) expect(log.hash).toBe(hashEventStream(log.header, log.events));
  });

  // The fixture rounds' hashes on main before format 2 (header without `logFormat`; engine 2): the summary stream is
  // identical but for the header's new field, and the full stream is identical but for the frames (the closing frame
  // takes a seq, so `seq` is left out of the comparison there). Captured on 5eb87cd with the same fixtures and function.
  describe('equal to the format-1 stream apart from the header field (and, at full, the frames)', () => {
    const fx = fixtureContent();
    const HOME = ['oathguard', 'gutterknife', 'longeye', 'rimebinder', 'chirurgeon'];
    const AWAY = ['siegebreaker', 'oathguard', 'longeye', 'chirurgeon', 'rimebinder'];

    function legacyHash(log: FightLog, dropFrames: boolean): string {
      const h = new StreamHasher();
      const { logFormat, ...header } = log.header;
      expect(logFormat).toBe(2);
      h.update(stableStringify(header));
      for (const e of log.events) {
        if (dropFrames) {
          if (e.type === 'frame') continue;
          const { seq: _seq, ...rest } = e;
          h.update(stableStringify(rest));
        } else h.update(stableStringify(e));
      }
      return h.digest();
    }

    function m11Round(): RoundInput {
      const home = sideInput(fx, 'home', HOME, 0, 1);
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
      return { round: 2, home, away: sideInput(fx, 'away', AWAY, 1, 0) };
    }

    const matchInput = { seed: 'a1b2c3d4e5f60718', bestOf: 3, home: sideInput(fx, 'home', HOME, 0, 1), away: sideInput(fx, 'away', AWAY, 1, 0) };

    it('the fixture match', () => {
      expect(simulateMatch(matchInput, fx, { record: 'summary' }).logs!.map((l) => legacyHash(l, false))).toEqual(['7a602edfbf7debc77cdf3feff255f6b1', '723c9faa02ee8a65b42256c3861e47d3']);
      expect(simulateMatch(matchInput, fx, { record: 'full' }).logs!.map((l) => legacyHash(l, true))).toEqual(['2c8d5eb1201d3555b39bc70bd6734177', 'd33c02036a4600734997c62d9c7f84ba']);
    });

    it('the fixture M1.1 round (ranks, perks, Freshness)', () => {
      expect(legacyHash(simulateRound(m11Round(), 'r-golden', fx, { record: 'summary' }).log!, false)).toBe('4b6242ea586fcb680c58d20da0cfbbfe');
      expect(legacyHash(simulateRound(m11Round(), 'r-golden', fx, { record: 'full' }).log!, true)).toBe('d6efc3eb48dfd0d9dbfde0191fdf9eed');
    });
  });
});
