/**
 * Seeded 20-season population runs (05 §9.2 WP2 acceptance) against
 * development.json soakTargets. Bands are read from content, never typed here.
 */
import { describe, expect, it } from 'vitest';
import { fixtureContent } from '../testkit';
import { runPopulation, type PopulationReport } from './population';

const content = fixtureContent();
const targets = content.development.soakTargets;
const SEASONS = 20;
const FROM = 3; // soakTargets._doc: measured from season 3

function inBand(value: number, [lo, hi]: readonly [number, number]): boolean {
  return value >= lo && value <= hi;
}

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function checkAgeAndPopulation(report: PopulationReport): void {
  const samples = report.samples.filter((s) => s.season >= FROM);
  expect(samples).toHaveLength(SEASONS - FROM + 1);
  for (const s of samples) {
    expect(inBand(s.medianHumanAge, targets.medianHumanAge), `median human-age ${s.medianHumanAge} in season ${s.season}`).toBe(true);
    expect(inBand(s.shareAtMost22, targets.shareHumanAgeAtMost22), `share <= 22 ${s.shareAtMost22} in season ${s.season}`).toBe(true);
    expect(inBand(s.shareAtLeast31, targets.shareHumanAgeAtLeast31), `share >= 31 ${s.shareAtLeast31} in season ${s.season}`).toBe(true);
  }
  const first = samples[0]!.population;
  const last = samples[samples.length - 1]!.population;
  expect((Math.abs(last - first) * 100) / first).toBeLessThanOrEqual(targets.populationDriftMaxPct);
  const share = report.rolled.positive / (report.rolled.positive + report.rolled.negative);
  expect(inBand(share, targets.rolledTraitPositiveShare), `rolled positive share ${share}`).toBe(true);
}

describe('20-season population without matches (usage at the floor)', () => {
  const report = runPopulation({ seed: 'population-1', seasons: SEASONS, content });

  it('stays inside the soakTargets age and population bands', () => {
    checkAgeAndPopulation(report);
  });
  it('turns the league over: by season 20 only elves remain from world generation', () => {
    const survivors = Object.values(report.finalState.fighters).filter((f) => f.debutSeason === 1 && f.status !== 'retired');
    for (const f of survivors) expect(f.raceId).toBe('elf');
  });
  it('without rounds started nobody develops (D-A): world-gen clocks never move', () => {
    for (const f of Object.values(report.finalState.fighters)) expect(f.career.xpTotal).toBe(0);
  });
  it('is deterministic for a seed', () => {
    const again = runPopulation({ seed: 'population-1', seasons: 4, content });
    const once = runPopulation({ seed: 'population-1', seasons: 4, content });
    expect(JSON.stringify(again.finalState)).toBe(JSON.stringify(once.finalState));
  });
});

describe('20-season population with synthetic matches', () => {
  const report = runPopulation({ seed: 'population-2', seasons: SEASONS, content, matches: true });

  it('stays inside the age and population bands', () => {
    checkAgeAndPopulation(report);
  }, 120_000);
  it('injuries per 40 rounds by race are inside the bands (O11: elves most, dwarves and orcs least)', () => {
    for (const [race, band] of Object.entries(targets.injuriesPer40RoundsByRace)) {
      const r = report.injuries[race]!;
      const per40 = (r.injuries * 40) / r.rounds;
      expect(inBand(per40, band), `${race} ${per40.toFixed(3)} per 40 rounds`).toBe(true);
    }
    const per40 = (race: string) => (report.injuries[race]!.injuries * 40) / report.injuries[race]!.rounds;
    expect(per40('elf')).toBeGreaterThan(per40('human'));
    expect(per40('dwarf')).toBeLessThan(per40('human'));
    expect(per40('orc')).toBeLessThan(per40('human'));
  });
  it('serious share and career-ending injuries per league-season are inside the bands', () => {
    const total = Object.values(report.severities).reduce((a, b) => a + b, 0);
    expect(inBand((report.severities['serious'] ?? 0) / total, targets.seriousShareOfInjuries)).toBe(true);
    expect(inBand(report.careerEndings / SEASONS, targets.careerEndingPerLeagueSeason)).toBe(true);
  });
  it('ratings stay below the ceiling; captains are rarely below grade D; starters peak near potential', () => {
    for (const s of report.samples) expect(s.maxRating).toBeLessThanOrEqual(targets.maxRatingInLeague);
    for (const s of report.samples.filter((x) => x.season >= FROM)) {
      expect(s.captainShareBelow40).toBeLessThanOrEqual(targets.aiCaptainsBelowGradeDMax);
      expect(inBand(s.captainMeanCq, targets.aiCaptainMeanCq), `captain mean CQ ${s.captainMeanCq}`).toBe(true);
    }
    expect(inBand(median(report.starterPeakOverPotential), targets.starterPeakOverPotential)).toBe(true);
  });
  it('retirement ages per race follow the lifespan (medians within 2 years of 03 sys-development)', () => {
    const expected: Record<string, number> = { human: 36, elf: 55, dwarf: 33, orc: 29, ashkin: 24 };
    for (const [race, m] of Object.entries(expected)) {
      const ages = report.retirementAges[race]!;
      expect(ages.length).toBeGreaterThan(20);
      expect(Math.abs(median(ages) - m), `${race} median ${median(ages)}`).toBeLessThanOrEqual(2);
    }
  });
  it('dev-007: training emphasis switched off equals everyone Balanced, bit for bit, over 20 seasons', () => {
    const off = runPopulation({ seed: 'population-2', seasons: SEASONS, content, matches: true, trainingEmphasis: false });
    const strip = (r: PopulationReport) => JSON.stringify({ ...r.finalState, options: null });
    expect(strip(off)).toBe(strip(report));
  }, 120_000);
});
