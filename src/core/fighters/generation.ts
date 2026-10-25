/**
 * sys-fighters generation (03 §3.2 "Generation procedure"). One procedure for
 * world generation, rookies, free agents, journeymen and hired blades.
 *
 * Every draw is keyed by (root, stream, season, fighter id, purpose), so the
 * order in which callers create fighters never shifts another fighter's
 * values (only the allocated id depends on order). Streams: `rookies`
 * (race, age, class, potential, pace, caps), `development` (bloom,
 * pre-career usage U, sampled debut), `traits` (roll), `injury` (history
 * scars), `names`.
 */
import type { ContentDB, RaceDef } from '../content';
import {
  putFighter,
  allocateId,
  emptyCareerStats,
  emptySeasonCounters,
  type ClassId,
  type Fighter,
  type FighterId,
  type FighterTrait,
  type GameState,
  type PaceId,
  type RaceId,
  type RegionId,
  type StatId,
} from '../model';
import { Rng, STREAM } from '../rng';
import { checkThresholds, gainTrait, pickScar } from './acquired';
import { BP, bp, roundN, stepLookup, truncN } from './fixed';
import { generateNameWith, livingNames } from './names';
import { humanAge100Of, potentialOf, ratingOf } from './stats';
import { tables } from './tables';
import { rollTraits } from './traits';

export type GenerationKind = 'worldgen' | 'rookie' | 'free-agent' | 'journeyman' | 'hired-blade';

export interface GenerationSpec {
  kind: GenerationKind;
  potentialShift: number;
  regionId: RegionId;
  raceId?: RaceId;
  classId?: ClassId;
  humanAge?: { min: number; max: number };
  ratingTarget?: number;
}

/**
 * PROVISIONAL (OPEN, content request): journeymen are generated at
 * human-age 26-33 (03 sys-fighters "Other generated kinds"), but
 * development.json has no `generation.journeyman` block. Callers may pass
 * spec.humanAge instead.
 */
export const PROVISIONAL_JOURNEYMAN_HUMAN_AGE = { min: 26, max: 33 } as const;

export function debutRange(race: RaceDef, content: ContentDB): { min: number; max: number } {
  const floor = content.development.time.debutAgeFloor;
  const min = Math.max(floor, race.debutAge.min);
  return { min, max: Math.max(min, race.debutAge.max) };
}

function ageFromHumanAge(h: number, race: RaceDef, content: ContentDB): number {
  const baseline = content.development.time.humanBaselineLifespan;
  const { min } = debutRange(race, content);
  const max = Math.max(min, Math.floor((40 * race.lifespan) / baseline));
  const age = roundN((h * race.lifespan) / baseline);
  return age < min ? min : age > max ? max : age;
}

function humanAgeBand(spec: GenerationSpec, content: ContentDB, rng: Rng): { min: number; max: number } {
  if (spec.humanAge) return spec.humanAge;
  const gen = content.development.generation;
  if (spec.kind === 'hired-blade') return { min: gen.hiredBlade.humanAgeMin, max: gen.hiredBlade.humanAgeMax };
  if (spec.kind === 'journeyman') return PROVISIONAL_JOURNEYMAN_HUMAN_AGE;
  const band = rng.weighted(gen.worldGen.humanAgeBands, (b) => bp(b.weight));
  return { min: band.min, max: band.max };
}

export function createFighterOn(draft: GameState, spec: GenerationSpec, content: ContentDB): FighterId {
  const dev = content.development;
  const t = tables(content);
  const id = allocateId(draft.ids, 'fighter');
  const season = draft.calendar.season;
  const root = draft.rng.root;
  const gen = (purpose: string): Rng => Rng.create(root, STREAM.rookies, season, id, purpose);
  const devRng = (purpose: string): Rng => Rng.create(root, STREAM.development, season, id, purpose);
  const baseline = dev.time.humanBaselineLifespan;

  // 1. race and age
  const race = spec.raceId ? content.races.require(spec.raceId) : gen('race').weighted(content.races.list, (r) => bp(r.intakeWeight));
  const debut = debutRange(race, content);
  let age: number;
  if (spec.kind === 'rookie' && !spec.humanAge) {
    age = gen('age').int(debut.min, debut.max);
  } else {
    const ageRng = gen('age');
    const band = humanAgeBand(spec, content, ageRng);
    age = ageFromHumanAge(ageRng.int(band.min, band.max), race, content);
  }
  const ha100 = humanAge100Of(age, race.lifespan, baseline);

  // 2. class (soft race affinity)
  const klass = spec.classId
    ? content.classes.require(spec.classId)
    : gen('class').weighted(content.classes.list, (k) => bp(race.classAffinity[k.affinityGroup] ?? 1));

  // 3. potential P
  const pRng = gen('potential');
  const pBand = pRng.weighted(dev.potential.bands, (b) => bp(b.weight));
  const clampP = (p: number): number => (p < dev.potential.clamp.min ? dev.potential.clamp.min : p > dev.potential.clamp.max ? dev.potential.clamp.max : p);
  let potentialRoll = clampP(pRng.int(pBand.min, pBand.max) + spec.potentialShift);

  // 4. pace
  const pace = gen('pace').weighted(dev.pace.levels, (l) => bp(l.weight));

  // 5. caps: P × 20 + class offset + race tendency + jitter, clamped
  const jitterMax = roundN(dev.potential.capJitterPoints * 100);
  const jRng = gen('caps');
  const jitter: Record<string, number> = {};
  for (const sid of t.statIds) jitter[sid] = jRng.int(-jitterMax, jitterMax);
  const tendencyCap = dev.scale.raceTendencyCapPerStat;
  const offsets = t.classOffset100.get(klass.id) ?? {};
  const capsFor = (p: number): Record<StatId, number> => {
    const caps = {} as Record<StatId, number>;
    for (const sid of t.statIds) {
      const tendency = (race.statTendencies as Record<string, number>)[sid] ?? 0;
      const tend100 = roundN((tendency > tendencyCap ? tendencyCap : tendency < -tendencyCap ? -tendencyCap : tendency) * 100);
      const raw = roundN(p * 20 + (offsets[sid] ?? 0) + tend100 + (jitter[sid] ?? 0));
      const lo = dev.scale.capMin * 100;
      const hi = dev.scale.capMax * 100;
      caps[sid] = raw < lo ? lo : raw > hi ? hi : raw;
    }
    return caps;
  };

  // 6. bloom (whole human-years, stored in hundredths)
  const bRng = devRng('bloom');
  const bloom = {} as Record<StatId, number>;
  const bloomRange = dev.developmentClock.bloomRangeHumanYears;
  for (const sid of t.statIds) bloom[sid] = bRng.int(-bloomRange, bloomRange) * 100;

  // 7. development clocks: D_g = min(ha + 4, 16 + max(0, ha − 16) × U × pace × growth_g)
  const clock = dev.developmentClock;
  const uBp = devRng('usage').int(bp(clock.preCareerUsage.min), bp(clock.preCareerUsage.max));
  const start100 = roundN(clock.startHumanAge * 100);
  const ahead100 = roundN(clock.maxAheadOfHumanAge * 100);
  const paceBp = bp(pace.mult);
  const dFor = (growth: number): number => {
    const grown = start100 + truncN((Math.max(0, ha100 - start100) * uBp * paceBp * bp(growth)) / (BP * BP * BP));
    return Math.min(ha100 + ahead100, grown);
  };
  const dev100 = { physical: dFor(race.growthMult.physical), mental: dFor(race.growthMult.mental) };

  // 8. wear history: decline table summed over every human-year already lived, × race.declineMult
  const wear100 = {} as Record<StatId, number>;
  const lived = Math.floor(ha100 / 100);
  const mentalScales = dev.decline.mentalDeclineScalesWithLifespan;
  const wearSum = (group: 'physical' | 'mental'): number => {
    let sum = 0;
    // Unscaled mental decline reads absolute years (decline.mentalDeclineScalesWithLifespan = false).
    const years = group === 'mental' && !mentalScales ? age : lived;
    for (let y = 0; y < years; y++) sum += stepLookup(t.decline[group], y);
    return truncN((sum * bp(race.declineMult[group])) / BP);
  };
  const physWear = wearSum('physical');
  const mentWear = wearSum('mental');
  for (const sid of t.statIds) wear100[sid] = t.groupOf[sid] === 'physical' ? physWear : mentWear;

  // 9. traits (rolled; 'worldgen' source at world generation)
  const source: FighterTrait['source'] = spec.kind === 'worldgen' ? 'worldgen' : 'rolled';
  const traits: FighterTrait[] = rollTraits(Rng.create(root, STREAM.traits, season, id, 'roll'), race.id, ha100, content).map((tid) => ({
    id: tid,
    gainedSeason: season,
    source,
  }));

  const fighter: Fighter = {
    id,
    name: { given: '', family: null, epithet: null, full: '' },
    raceId: race.id as RaceId,
    classId: klass.id as ClassId,
    originRegionId: spec.regionId,
    age,
    debutSeason: draft.calendar.phase === 'season-end' ? season + 1 : season,
    clubId: null,
    status: spec.kind === 'hired-blade' ? 'hired-blade' : 'free-agent',
    contract: null,
    contractProfile: { greedBp: 0 },
    freeAgency:
      spec.kind === 'hired-blade'
        ? null
        : { unsignedSeasonEnds: 0, formerClubId: null, releasedByClubId: null, releasedSeason: null, enteredAt: { season: draft.calendar.season, weekIndex: draft.calendar.weekIndex } },
    potentialRoll,
    paceId: pace.id as PaceId,
    cap100: capsFor(potentialRoll),
    bloom,
    dev100,
    wear100,
    traits,
    statuses: [],
    injury: null,
    trainingEmphasis: dev.training.default,
    finalSeason: false,
    career: emptyCareerStats(),
    season: emptySeasonCounters(),
    history: [],
    learnedAbilityIds: [],
    academy: null,
  };

  // 10. veteran history: pro seasons, career rounds, history scars, acquired thresholds once
  const sampledDebut = devRng('debut').int(debut.min, debut.max);
  const proSeasons = spec.kind === 'rookie' ? 0 : Math.max(0, age - sampledDebut);
  if (proSeasons > 0) {
    const vh = dev.generation.veteranHistory;
    fighter.career.proSeasons = proSeasons;
    fighter.career.roundsStarted = roundN((proSeasons * vh.roundsPerSeasonPlayed * uBp) / BP);
    const sRng = Rng.create(root, STREAM.injury, season, id, 'history');
    const scarBp = bp(vh.scarChancePerSeasonPlayed);
    for (let s = 0; s < proSeasons; s++) {
      if (!sRng.chanceBp(scarBp)) continue;
      const scar = pickScar(sRng, fighter, content);
      if (scar) gainTrait(fighter, scar, 'scar', season, content, root);
    }
    checkThresholds(fighter, null, season, content, root);
  }

  // Hired blades: shift potential so the rating lands on the requested band minimum.
  if (spec.ratingTarget !== undefined) {
    for (let i = 0; i < 6; i++) {
      const diff = spec.ratingTarget - ratingOf(fighter, content);
      if (diff === 0) break;
      const next = clampP(potentialRoll + diff);
      if (next === potentialRoll) break;
      potentialRoll = next;
      fighter.potentialRoll = potentialRoll;
      fighter.cap100 = capsFor(potentialRoll);
    }
  }

  fighter.career.peakRating = ratingOf(fighter, content);
  fighter.name = generateNameWith(Rng.create(root, STREAM.names, season, id), fighter.raceId, content, livingNames(draft));
  putFighter(draft, fighter);
  return id;
}

/** Potential before any trait (gen-003 check helper). */
export function potentialWithoutTraits(fighter: Fighter, content: ContentDB): number {
  return potentialOf({ ...fighter, traits: [] }, content);
}
