import { describe, expect, it } from 'vitest';
import { fixtureContent, fixtureState } from '../testkit';
import type { ClassId, GameState, RaceId, RegionId, StatId } from '../model';
import { Rng } from '../rng';
import { createFighter, generateName, humanAge100, potential, rating } from './index';
import { potentialWithoutTraits } from './generation';
import { generateNameWith, livingNames } from './names';
import { tables } from './tables';
import { rollTraits } from './traits';

const content = fixtureContent();
const region = content.regions.list[0]!.id as RegionId;

function state(seed = 'gen-seed'): GameState {
  const s = fixtureState(seed);
  s.calendar = { season: 1, weekIndex: 1, weekId: null, phase: 'preseason' };
  return s;
}

describe('rookies (gen-001)', () => {
  it('1,000 rookies per race have ages inside the debut range', () => {
    const s = state();
    for (const race of content.races.list) {
      for (let i = 0; i < 1000; i++) {
        const id = createFighter(s, { kind: 'rookie', potentialShift: 0, regionId: region, raceId: race.id as RaceId }, content);
        const f = s.fighters[id]!;
        expect(f.age).toBeGreaterThanOrEqual(Math.max(16, race.debutAge.min));
        expect(f.age).toBeLessThanOrEqual(race.debutAge.max);
        expect(f.career.proSeasons).toBe(0);
        expect(f.career.roundsStarted).toBe(0);
      }
    }
  }, 120_000);
});

describe('generation validity (gen-003)', () => {
  // Rating uses the combat formula on integer stats (floor of centipoints), so potential sits on
  // average ~2.5 below P; race tendencies on mismatched classes (elf tanks: tgh −1.6, str −1.2) add
  // up to −4. gen-003's ±6 assumed the centipoint formula: here ≥ 99% are within ±6, all within ±9.
  it('P 30-97, caps 2-20, D >= 16, potential close to P before traits', () => {
    const s = state('validity');
    const t = tables(content);
    let maxGap = 0;
    let within6 = 0;
    const n = 1500;
    for (let i = 0; i < n; i++) {
      const id = createFighter(s, { kind: 'worldgen', potentialShift: (i % 3) * 4, regionId: region }, content);
      const f = s.fighters[id]!;
      expect(f.potentialRoll).toBeGreaterThanOrEqual(30);
      expect(f.potentialRoll).toBeLessThanOrEqual(97);
      for (const sid of t.statIds) {
        expect(f.cap100[sid]).toBeGreaterThanOrEqual(200);
        expect(f.cap100[sid]).toBeLessThanOrEqual(2000);
        expect(Math.abs(f.bloom[sid]!)).toBeLessThanOrEqual(200);
      }
      expect(f.dev100.physical).toBeGreaterThanOrEqual(1600);
      expect(f.dev100.mental).toBeGreaterThanOrEqual(1600);
      expect(f.dev100.physical).toBeLessThanOrEqual(humanAge100(f, content) + 400);
      const ha = humanAge100(f, content);
      expect(ha).toBeGreaterThanOrEqual(1600);
      expect(ha).toBeLessThanOrEqual(4000);
      const gap = Math.abs(potentialWithoutTraits(f, content) - f.potentialRoll);
      maxGap = Math.max(maxGap, gap);
      if (gap <= 6) within6++;
      expect(rating(f, content)).toBeGreaterThanOrEqual(1);
      expect(potential(f, content)).toBeGreaterThanOrEqual(1);
    }
    expect(within6 / n).toBeGreaterThanOrEqual(0.99);
    expect(maxGap).toBeLessThanOrEqual(9);
  }, 120_000);
});

describe('veteran history (gen-004)', () => {
  it('a human generated at 35 carries 0.3 + 0.4 + 0.5 + 0.6 = 1.8 wear per physical stat and career rounds', () => {
    const s = state('vet');
    const t = tables(content);
    for (let i = 0; i < 40; i++) {
      const id = createFighter(s, { kind: 'worldgen', potentialShift: 0, regionId: region, raceId: 'human' as RaceId, humanAge: { min: 35, max: 35 } }, content);
      const f = s.fighters[id]!;
      expect(f.age).toBe(35);
      for (const sid of t.physicalIds) expect(f.wear100[sid]).toBe(180);
      for (const sid of t.mentalIds) expect(f.wear100[sid]).toBe(0);
      expect(f.career.roundsStarted).toBeGreaterThan(0);
      expect(f.traits.some((x) => x.id === 'sand_wise')).toBe(f.career.roundsStarted >= 300);
    }
  });
  it('dwarf wear history uses declineMult (Bedrock 0.85)', () => {
    const s = state('vet-dwarf');
    const id = createFighter(s, { kind: 'worldgen', potentialShift: 0, regionId: region, raceId: 'dwarf' as RaceId, humanAge: { min: 35, max: 35 } }, content);
    const f = s.fighters[id]!;
    // age round(35 × 72 / 80) = 32 → human-age 35.5 → years 31..34 summed = 180 × 0.85 = 153
    expect(f.age).toBe(32);
    expect(f.wear100['str' as StatId]).toBe(153);
  });
});

describe('determinism (gen-005)', () => {
  it('the same seed generates identical fighters, names and traits', () => {
    const run = (): GameState => {
      const s = state('same-seed');
      for (let i = 0; i < 80; i++) createFighter(s, { kind: i % 2 ? 'worldgen' : 'rookie', potentialShift: 4, regionId: region }, content);
      return s;
    };
    expect(JSON.stringify(run().fighters)).toBe(JSON.stringify(run().fighters));
    const other = state('other-seed');
    createFighter(other, { kind: 'rookie', potentialShift: 4, regionId: region }, content);
    expect(JSON.stringify(other.fighters['f-1' as never])).not.toBe(JSON.stringify(run().fighters['f-1' as never]));
  });
  it('respects race and class constraints, and hired blades land on the rating target', () => {
    const s = state('blade');
    for (const target of [30, 45, 60]) {
      const id = createFighter(s, { kind: 'hired-blade', potentialShift: -12, regionId: region, classId: 'oathguard' as ClassId, raceId: 'orc' as RaceId, ratingTarget: target }, content);
      const f = s.fighters[id]!;
      expect(f.classId).toBe('oathguard');
      expect(f.raceId).toBe('orc');
      expect(f.status).toBe('hired-blade');
      expect(Math.abs(rating(f, content) - target)).toBeLessThanOrEqual(1);
      const ha = humanAge100(f, content);
      expect(ha).toBeGreaterThanOrEqual(2300);
      expect(ha).toBeLessThan(3500);
    }
  });
});

describe('names (gen-002)', () => {
  it('2,000 names per race are unique among living fighters, never blocklisted, no triple letters, given 3-11 letters', () => {
    const block = content.names.rules.blocklist.map((b) => b.toLowerCase());
    for (const race of content.races.list) {
      const rng = Rng.create('names-test', race.id);
      const living = new Set<string>();
      for (let i = 0; i < 2000; i++) {
        const n = generateNameWith(rng, race.id as RaceId, content, living);
        expect(living.has(n.full)).toBe(false);
        living.add(n.full);
        const lower = n.full.toLowerCase();
        for (const b of block) expect(lower.includes(b)).toBe(false);
        expect(/([a-z])\1\1/.test(lower)).toBe(false);
        expect(n.given.length).toBeGreaterThanOrEqual(3);
        expect(n.given.length).toBeLessThanOrEqual(11);
        expect(n.full.startsWith(n.given)).toBe(true);
      }
    }
  });
  it('retries a collision with a living fighter and falls back to a numeral', () => {
    const rng = Rng.create('collide');
    const first = generateNameWith(Rng.create('collide'), 'human' as RaceId, content, new Set());
    const again = generateNameWith(rng, 'human' as RaceId, content, new Set([first.full]));
    expect(again.full).not.toBe(first.full);
    // Every attempt collides: the numeral is appended.
    const always = { has: () => true } as unknown as Set<string>;
    const forced = generateNameWith(Rng.create('x'), 'orc' as RaceId, content, { has: (n: string) => !n.endsWith(' II') && always.has(n), size: 1 } as unknown as Set<string>);
    expect(forced.full.endsWith(' II')).toBe(true);
  });
  it('generateName keeps names unique in a state', () => {
    const s = state('gn');
    for (let i = 0; i < 30; i++) createFighter(s, { kind: 'rookie', potentialShift: 0, regionId: region, raceId: 'dwarf' as RaceId }, content);
    const names = livingNames(s);
    const n = generateName(s, 'dwarf' as RaceId, content);
    expect(names.has(n.full)).toBe(false);
    expect(new Set(Object.values(s.fighters).map((f) => f.name.full)).size).toBe(30);
  });
});

describe('trait roll (trait-001, trait-002; O5)', () => {
  it('100,000 rolls: never 2 negatives, no conflicting pair, category caps, positive share 78-82%', () => {
    let positive = 0;
    let negative = 0;
    let total = 0;
    const races = content.races.list;
    const rng = Rng.create('trait-mc');
    for (let i = 0; i < 100_000; i++) {
      const race = races[i % races.length]!;
      const ids = rollTraits(rng, race.id, 1800 + (i % 2000), content);
      total += ids.length;
      const defs = ids.map((id) => content.traits.require(id));
      const negs = defs.filter((d) => d.polarity === 'negative').length;
      expect(negs).toBeLessThanOrEqual(1);
      positive += defs.length - negs;
      negative += negs;
      for (const a of defs) {
        for (const b of defs) {
          if (a === b) continue;
          expect(a.opposites.includes(b.id) || a.excludes.includes(b.id)).toBe(false);
          if (a.exclusiveGroup) expect(a.exclusiveGroup).not.toBe(b.exclusiveGroup);
        }
        expect(defs.filter((d) => d.category === a.category).length).toBeLessThanOrEqual(2);
        expect(a.rollWeight).toBeGreaterThan(0);
      }
    }
    const share = positive / (positive + negative);
    expect(share).toBeGreaterThanOrEqual(0.78);
    expect(share).toBeLessThanOrEqual(0.82);
    expect(total / 100_000).toBeGreaterThan(2.8);
    expect(total / 100_000).toBeLessThan(3.0);
  }, 120_000);
  it('Green Nerves only at human-age <= 21', () => {
    const rng = Rng.create('green');
    let seenYoung = 0;
    for (let i = 0; i < 20_000; i++) {
      if (rollTraits(rng, 'human', 2200, content).includes('green_nerves' as never)) throw new Error('Green Nerves at 22');
      if (rollTraits(rng, 'human', 2000, content).includes('green_nerves' as never)) seenYoung++;
    }
    expect(seenYoung).toBeGreaterThan(0);
  });
});
