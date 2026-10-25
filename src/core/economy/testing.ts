/**
 * TEST DOUBLES for core/fighters, used only by economy tests:
 *
 *   vi.mock('../fighters', async () => (await import('./testing')).fightersDouble);
 *
 * Economy tests pin exact ratings, potentials and human-ages (the 03 worked
 * examples) independently of WP2's lifecycle numbers. Not imported by any
 * production code. Pure (no platform APIs); module state is reset per test.
 */
import type { ContentDB } from '../content';
import type { FighterSpec } from '../fighters';
import type { ClassId, Fighter, FighterId, GameState, PaceId, RaceId, StatId } from '../model';
import { allocateId, asId, emptyCareerStats, emptySeasonCounters } from '../model';
import { Rng } from '../rng';

export interface DoubleValues {
  rating: number;
  potential: number;
  /** Hundredths of a human-year; default from age and race lifespan. */
  humanAge100?: number;
  fit?: boolean;
}

const values = new Map<string, DoubleValues>();
const created: { id: FighterId; spec: FighterSpec }[] = [];

export function setFighterValues(id: string, v: DoubleValues): void {
  values.set(id, v);
}

export function resetFighterDoubles(): void {
  values.clear();
  created.length = 0;
}

/** Specs passed to createFighter since the last reset (assertions on journeymen and hired blades). */
export function createdFighters(): readonly { id: FighterId; spec: FighterSpec }[] {
  return created;
}

function lifespan(f: Fighter, content: ContentDB): number {
  return content.races.get(f.raceId)?.lifespan ?? 80;
}

/** A plain fighter record (same shape as testkit makeFixtureFighter). */
export function plainFighter(id: FighterId, content: ContentDB, overrides: Partial<Fighter> = {}): Fighter {
  const statIds = content.stats.list.map((s) => s.id as StatId);
  const perStat = (v: number): Record<StatId, number> => Object.fromEntries(statIds.map((s) => [s, v])) as Record<StatId, number>;
  return {
    id,
    name: { given: `Given ${id}`, family: null, epithet: null, full: `Given ${id}` },
    raceId: asId<RaceId>(content.races.list[0]!.id),
    classId: asId<ClassId>(content.classes.list[0]!.id),
    originRegionId: asId(content.regions.list[0]!.id),
    age: 25,
    debutSeason: 1,
    clubId: null,
    status: 'free-agent',
    contract: null,
    contractProfile: { greedBp: 0 },
    freeAgency: null,
    potentialRoll: 50,
    paceId: asId<PaceId>(content.development.pace.levels[0]?.id ?? 'steady'),
    cap100: perStat(1200),
    bloom: perStat(0),
    dev100: { physical: 2400, mental: 2400 },
    wear100: perStat(0),
    traits: [],
    statuses: [],
    injury: null,
    trainingEmphasis: 'balanced',
    finalSeason: false,
    career: emptyCareerStats(),
    season: emptySeasonCounters(),
    history: [],
    learnedAbilityIds: [],
    academy: null,
    ...overrides,
  };
}

export const fightersDouble = {
  rating(f: Fighter, _content: ContentDB): number {
    return values.get(f.id)?.rating ?? Math.max(1, f.potentialRoll - 10);
  },
  potential(f: Fighter, _content: ContentDB): number {
    return values.get(f.id)?.potential ?? f.potentialRoll;
  },
  humanAge100(f: Fighter, content: ContentDB): number {
    return values.get(f.id)?.humanAge100 ?? Math.trunc((f.age * 8000) / lifespan(f, content));
  },
  isFit(f: Fighter): boolean {
    const v = values.get(f.id)?.fit;
    if (v !== undefined) return v;
    return f.status !== 'retired' && (f.injury === null || f.injury.weeksOut === 0);
  },
  createFighter(draft: GameState, spec: FighterSpec, content: ContentDB): FighterId {
    const id = allocateId(draft.ids, 'fighter');
    const rng = Rng.create(draft.rng.root, 'test-double', id);
    const klass = spec.classId ?? asId<ClassId>(rng.pick(content.classes.list).id);
    const race = spec.raceId ?? asId<RaceId>(content.races.list[0]!.id);
    const ha = spec.humanAge ? rng.int(spec.humanAge.min, spec.humanAge.max) : 25;
    const life = content.races.get(race)?.lifespan ?? 80;
    const age = Math.trunc((ha * life) / 80);
    const lowest = [...content.tiers.list].sort((a, b) => b.level - a.level)[0]!;
    const rating = spec.ratingTarget ?? rng.int(lowest.ratingBand.min, lowest.ratingBand.max);
    const f = plainFighter(id, content, { classId: klass, raceId: race, originRegionId: spec.regionId, age, potentialRoll: rating + 3 });
    draft.fighters[id] = f;
    values.set(id, { rating, potential: Math.max(rating, rating + 3 + spec.potentialShift), humanAge100: ha * 100 });
    created.push({ id, spec });
    return id;
  },
};
