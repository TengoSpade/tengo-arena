/**
 * Seeded 20-season population runs (05 §9.2 WP2 acceptance) against
 * development.json soakTargets. Bands are read from content, never typed here.
 */
import { describe, expect, it } from 'vitest';
import { PHYSICAL_STAT_IDS } from '../content';
import type { Fighter } from '../model';
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

/** Physical share of the class rating weight above one half (D-T: such fighters decline fast after 30). */
function physicallyWeighted(f: Fighter): boolean {
  let phys = 0;
  let all = 0;
  for (const [stat, w] of Object.entries(content.classes.require(f.classId).ratingWeights as Record<string, number>)) {
    all += w;
    if ((PHYSICAL_STAT_IDS as readonly string[]).includes(stat)) phys += w;
  }
  return phys * 2 > all;
}

const humanAge = (f: Fighter, age = f.age) => Math.floor((age * 800) / content.races.require(f.raceId).lifespan) / 10;

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
  it('turns the league over: by season 20 world generation survives in elves and mentally weighted veterans (D-T)', () => {
    const survivors = Object.values(report.finalState.fighters).filter((f) => f.debutSeason <= 1 && f.status !== 'retired');
    const others = survivors.filter((f) => f.raceId !== 'elf');
    for (const f of survivors) expect(humanAge(f)).toBeLessThan(content.development.retirement.forcedHumanAge);
    // Mental stats hold until human-age 60, physical ones fall from 31: the non-elf survivors are mostly mental classes.
    expect(others.filter((f) => !physicallyWeighted(f)).length).toBeGreaterThanOrEqual(Math.ceil(others.length * 0.75));
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
  it('retirement ages follow the lifespan and effectiveness (D-T): race medians agree in human-age; mental classes retire later', () => {
    const byRace = Object.entries(report.retirementAges).map(([race, ages]) => {
      expect(ages.length, race).toBeGreaterThan(20);
      return Math.floor((median(ages) * 800) / content.races.require(race).lifespan) / 10;
    });
    const all = median(byRace);
    for (const m of byRace) expect(Math.abs(m - all)).toBeLessThanOrEqual(3);
    expect(all).toBeGreaterThanOrEqual(36);
    expect(all).toBeLessThanOrEqual(44);
    // Retired from a club (leavers keep their freeAgency record; career-ending injuries are not age).
    const retired = Object.values(report.finalState.fighters).filter((f) => f.status === 'retired' && f.freeAgency === null && f.injury?.careerEnding !== true && f.history.length > 0);
    const at = (pick: (f: Fighter) => boolean) => median(retired.filter(pick).map((f) => humanAge(f, f.history[f.history.length - 1]!.age)));
    expect(at((f) => !physicallyWeighted(f)) - at(physicallyWeighted)).toBeGreaterThanOrEqual(4);
  });
  it('dev-007: training emphasis switched off equals everyone Balanced, bit for bit, over 20 seasons', () => {
    const off = runPopulation({ seed: 'population-2', seasons: SEASONS, content, matches: true, trainingEmphasis: false });
    const strip = (r: PopulationReport) => JSON.stringify({ ...r.finalState, options: null });
    expect(strip(off)).toBe(strip(report));
  }, 120_000);
});
