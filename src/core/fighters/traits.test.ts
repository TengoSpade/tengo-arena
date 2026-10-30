import { describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent, makeFixtureFighter } from '../testkit';
import type { ClubId, Fighter, FighterId, FighterTrait, GameState, RaceId, TraitId, WeekId } from '../model';
import { applyMatchLifecycle, seasonEndDevelopment, weeklyLifecycle } from './index';
import { gainTrait } from './acquired';
import { addAcquiredTrait, removeTrait } from './traits';
import { makeResult } from './testing';

const content = fixtureContent();
const t = (id: string, source: FighterTrait['source'] = 'rolled'): FighterTrait => ({ id: id as TraitId, gainedSeason: 1, source });

function at(s: GameState, weekIndex: number, season = 1): void {
  if (weekIndex > 23) {
    s.calendar = { season, weekIndex, weekId: null, phase: 'season-end' };
    return;
  }
  const w = content.weekByIndex(weekIndex);
  s.calendar = { season, weekIndex, weekId: w.id as WeekId, phase: w.phase };
}

function twoClubs(seed?: string) {
  const s = buildFixtureWorld({ clubLimit: 2, ...(seed ? { rootSeed: seed } : {}) });
  at(s, 13);
  const [a, b] = Object.keys(s.clubs) as ClubId[];
  return { s, a: a!, b: b!, home: s.clubs[a!]!.lineup.fighters.map((e) => e.fighterId), away: s.clubs[b!]!.lineup.fighters.map((e) => e.fighterId) };
}

function play(w: ReturnType<typeof twoClubs>, stage: 'league' | 'final' = 'league', rounds: ('home' | 'away')[] = ['home', 'home']) {
  return applyMatchLifecycle(w.s, makeResult(w.s, content, { homeClubId: w.a, awayClubId: w.b, home: w.home, away: w.away, rounds: rounds.map((winner) => ({ winner })), stage }), content);
}

/** Every fighter of a world set to `race`/`age` with the given traits. */
function population(race: string, age: number, traits: FighterTrait[], seed: string): GameState {
  const s = buildFixtureWorld({ rootSeed: seed });
  for (const f of Object.values(s.fighters)) Object.assign(f, { raceId: race as RaceId, age, traits: traits.map((x) => ({ ...x })) });
  at(s, 24);
  return s;
}

describe('gain and loss', () => {
  it('trait-003: Green Nerves fades when career rounds go from 119 to 121 in one match', () => {
    const w = twoClubs();
    const f = w.s.fighters[w.home[0]!]!;
    f.traits = [t('green_nerves')];
    f.career.roundsStarted = 119;
    const out = play(w);
    expect(f.traits.some((x) => x.id === 'green_nerves')).toBe(false);
    expect(out.newsIds.some((id) => w.s.news.find((n) => n.id === id)?.key === 'fighter.trait_lost')).toBe(true);
  });
  it('trait-004: Hot Blood mellows 15% a season from human-age 30, never before', () => {
    const at30 = population('orc', 24, [t('hot_blood')], 'hb-30'); // human-age 30.0
    seasonEndDevelopment(at30, content);
    const lost = Object.values(at30.fighters).filter((f) => !f.traits.some((x) => x.id === 'hot_blood')).length;
    const n = Object.keys(at30.fighters).length;
    expect(lost / n).toBeGreaterThan(0.08);
    expect(lost / n).toBeLessThan(0.23);
    const at29 = population('orc', 23, [t('hot_blood')], 'hb-29'); // human-age 28.75
    seasonEndDevelopment(at29, content);
    expect(Object.values(at29.fighters).every((f) => f.traits.some((x) => x.id === 'hot_blood'))).toBe(true);
  });
  it('trait-005: Sand-Wise is gained at season end (not at the 300th round); Skittish then 50% cured', () => {
    const w = twoClubs();
    const f = w.s.fighters[w.home[0]!]!;
    f.traits = [t('skittish')];
    f.career.roundsStarted = 299;
    play(w);
    expect(f.career.roundsStarted).toBe(301);
    expect(f.traits.some((x) => x.id === 'sand_wise')).toBe(false);
    const s = population('human', 28, [t('skittish')], 'sw');
    for (const g of Object.values(s.fighters)) g.career.roundsStarted = 320;
    seasonEndDevelopment(s, content);
    const all = Object.values(s.fighters);
    expect(all.every((g) => g.traits.some((x) => x.id === 'sand_wise'))).toBe(true);
    const cured = all.filter((g) => !g.traits.some((x) => x.id === 'skittish')).length / all.length;
    expect(cured).toBeGreaterThan(0.4);
    expect(cured).toBeLessThan(0.6);
  });
  it('trait-006: physique traits are never added or removed after generation', () => {
    const f = makeFixtureFighter(1, content);
    expect(addAcquiredTrait(f, 'thick_hide', 'event', 1, content)).toBe(false);
    f.traits = [t('broad_frame')];
    expect(removeTrait(f, 'broad_frame', content)).toBe(false);
    expect(f.traits).toHaveLength(1);
  });
  it('trait-007: a scar beyond 8 traits is skipped (and reported); the injury itself is unaffected', () => {
    const f: Fighter = makeFixtureFighter(1, content);
    f.traits = ['still_water', 'good_company', 'needle_sight', 'quick_study', 'sand_wise', 'long_road', 'title_tested', 'back_from_brink'].map((id) => t(id, 'event'));
    expect(gainTrait(f, 'rebuilt_knee', 'scar', 1, content, 'root')).toEqual([{ traitId: 'rebuilt_knee', change: 'skipped' }]);
    expect(f.traits).toHaveLength(8);
  });
  it('Long Road at season end: human-age ≥ 33 and ≥ 12 pro seasons', () => {
    const s = population('human', 33, [], 'lr');
    for (const g of Object.values(s.fighters)) g.career.proSeasons = 11; // +1 this season
    seasonEndDevelopment(s, content);
    // rostered fighters complete a pro season; unsigned free agents do not
    const all = Object.values(s.fighters);
    expect(all.filter((g) => g.clubId !== null).every((g) => g.traits.some((x) => x.id === 'long_road'))).toBe(true);
    expect(all.filter((g) => g.clubId === null).some((g) => g.traits.some((x) => x.id === 'long_road'))).toBe(false);
  });
  it('Wore the Armband after 32 matchweeks as club captain (week processing)', () => {
    const w = twoClubs();
    const cap = w.s.fighters[w.s.clubs[w.a]!.captainId!]!;
    cap.career.matchweeksAsClubCaptain = 31;
    weeklyLifecycle(w.s, content);
    expect(cap.career.matchweeksAsClubCaptain).toBe(32);
    expect(cap.traits.some((x) => x.id === 'wore_the_armband')).toBe(true);
    expect(cap.season.captainWeeksByClub[w.a]).toBe(1);
  });
  it('Back from the Brink on the first match after a serious injury; Still tender lasts 2 matches started', () => {
    const w = twoClubs();
    const f = w.s.fighters[w.home[0]!]!;
    f.injury = { severity: 'serious', weeksOut: 0, fixtureId: null, round: 1, causeFighterId: null, damageBp: 0, since: { season: 1, weekIndex: 5 } };
    f.statuses = [{ id: 'still_tender', remainingWeeks: null, remainingMatches: 2, since: { season: 1, weekIndex: 5 } }];
    play(w);
    expect(f.traits.some((x) => x.id === 'back_from_brink')).toBe(true);
    expect(f.injury).toBeNull();
    expect(f.statuses.find((x) => x.id === 'still_tender')?.remainingMatches).toBe(1);
    play(w);
    expect(f.statuses.some((x) => x.id === 'still_tender')).toBe(false);
  });
  it('Title-Tested for every starter of a won Reckoning final; Glory-Hungry 50% satisfied', () => {
    let satisfied = 0;
    let holders = 0;
    for (let i = 0; i < 40; i++) {
      const w = twoClubs(`tt-${i}`);
      for (const id of w.home) w.s.fighters[id]!.traits = [t('glory_hungry')];
      play(w, 'final', ['home', 'away', 'home']);
      for (const id of w.home) {
        const f = w.s.fighters[id]!;
        expect(f.traits.some((x) => x.id === 'title_tested')).toBe(true);
        holders++;
        if (!f.traits.some((x) => x.id === 'glory_hungry')) satisfied++;
      }
      for (const id of w.away) expect(w.s.fighters[id as FighterId]!.traits.some((x) => x.id === 'title_tested')).toBe(false);
    }
    expect(satisfied / holders).toBeGreaterThan(0.38);
    expect(satisfied / holders).toBeLessThan(0.62);
  });
});
