/**
 * Integer lookup tables derived once per ContentDB (03-fighter-lifecycle
 * schema note 3, 6). Content stays in authoring units; this module converts
 * the lifecycle parts to engine integers and precomputes the retirement
 * hazard conversion 1 - (1 - h)^k per (race, human-year) so no power is ever
 * computed during play (03 §1).
 */
import type { ClassDef, ContentDB, RaceDef } from '../content';
import type { StatId } from '../model';
import { BP, bp, powDet, roundN } from './fixed';

export type StatGroup = 'physical' | 'mental';

export interface LifecycleTables {
  readonly statIds: readonly StatId[];
  readonly physicalIds: readonly StatId[];
  readonly mentalIds: readonly StatId[];
  readonly groupOf: Readonly<Record<string, StatGroup>>;
  /** [D in hundredths of a human-year, maturity in bp], ascending. */
  readonly maturity: Readonly<Record<StatGroup, readonly (readonly [number, number])[]>>;
  /** [human-year, wear in centipoints per human-year], ascending step tables. */
  readonly decline: Readonly<Record<StatGroup, readonly (readonly [number, number])[]>>;
  /** Per-season retirement hazard in bp after the lifespan conversion, indexed by floor(human-age). */
  readonly hazardBp: ReadonlyMap<string, readonly number[]>;
  /** Class rating weights in bp. */
  readonly ratingWeightsBp: ReadonlyMap<string, Readonly<Record<string, number>>>;
  /** Class cap offsets in centipoints (recentred; float, rounded inside the cap formula). */
  readonly classOffset100: ReadonlyMap<string, Readonly<Record<string, number>>>;
  /** Calendar weeks per season and the indexes of match weeks (regular + tournament). */
  readonly weeksPerSeason: number;
  readonly matchweekIndexes: readonly number[];
  readonly preseasonWeeks: number;
}

const cache = new WeakMap<ContentDB, LifecycleTables>();

export function tables(content: ContentDB): LifecycleTables {
  const hit = cache.get(content);
  if (hit) return hit;
  const built = build(content);
  cache.set(content, built);
  return built;
}

function build(content: ContentDB): LifecycleTables {
  const dev = content.development;
  const statIds = content.stats.list.map((s) => s.id as StatId);
  const groupOf: Record<string, StatGroup> = {};
  for (const s of content.stats.list) groupOf[s.id] = s.group === 'physical' ? 'physical' : 'mental';
  const physicalIds = statIds.filter((id) => groupOf[id] === 'physical');
  const mentalIds = statIds.filter((id) => groupOf[id] === 'mental');

  const curve = (pairs: readonly (readonly [number, number])[]): [number, number][] =>
    pairs.map(([d, m]) => [roundN(d * 100), bp(m)] as [number, number]).sort((a, b) => a[0] - b[0]);
  const declineTable = (pairs: readonly (readonly [number, number])[]): [number, number][] =>
    pairs.map(([age, v]) => [age, roundN(bp(v) / 100)] as [number, number]).sort((a, b) => a[0] - b[0]);

  const hazardBp = new Map<string, number[]>();
  for (const race of content.races.list) hazardBp.set(race.id, hazardTable(content, race));

  const ratingWeightsBp = new Map<string, Record<string, number>>();
  const classOffset100 = new Map<string, Record<string, number>>();
  for (const k of content.classes.list) {
    const w: Record<string, number> = {};
    for (const id of statIds) w[id] = bp((k.ratingWeights as Record<string, number>)[id] ?? 0);
    ratingWeightsBp.set(k.id, w);
    classOffset100.set(k.id, classOffsets(content, k, w, statIds));
  }

  const weeks = content.leagues.calendar.weeks;
  return {
    statIds,
    physicalIds,
    mentalIds,
    groupOf,
    maturity: { physical: curve(dev.maturityCurve.physical), mental: curve(dev.maturityCurve.mental) },
    decline: { physical: declineTable(dev.decline.physicalPerHumanYear), mental: declineTable(dev.decline.mentalPerHumanYear) },
    hazardBp,
    ratingWeightsBp,
    classOffset100,
    weeksPerSeason: weeks.length,
    matchweekIndexes: weeks.filter((w) => w.phase === 'regular' || w.phase === 'tournament').map((w) => w.index),
    preseasonWeeks: weeks.filter((w) => w.phase === 'preseason').length,
  };
}

/** Per-season retirement probability p = 1 - (1 - h)^k per floor(human-age), in bp. */
function hazardTable(content: ContentDB, race: RaceDef): number[] {
  const dev = content.development;
  const k = dev.time.humanBaselineLifespan / race.lifespan;
  const out: number[] = [];
  const top = dev.retirement.forcedHumanAge;
  for (let year = 0; year <= top; year++) {
    let h = 0;
    for (const [age, v] of dev.retirement.hazardPerHumanYear) if (age <= year) h = v;
    const hBp = bp(h);
    if (hBp <= 0) out.push(0);
    else if (hBp >= BP) out.push(BP);
    else out.push(roundN((1 - powDet((BP - hBp) / BP, k)) * BP));
  }
  return out;
}

/**
 * classOffset_i (centipoints) = clamp(perEmphasisPoint × (statEmphasis_i − 1), min, max) × 100,
 * recentred so that Σ ratingWeight_i × offset_i = 0 (development.json potential.classOffsetFromEmphasis).
 */
function classOffsets(content: ContentDB, k: ClassDef, weightsBp: Record<string, number>, statIds: readonly StatId[]): Record<string, number> {
  const cfg = content.development.potential.classOffsetFromEmphasis;
  const per100 = roundN(cfg.perEmphasisPoint * 100);
  const min100 = roundN(cfg.min * 100);
  const max100 = roundN(cfg.max * 100);
  const off: Record<string, number> = {};
  const emphasis = k.statEmphasis as Record<string, number> | undefined | null;
  if (emphasis) {
    for (const id of statIds) {
      const eBp = bp(emphasis[id] ?? 1);
      const raw = Math.trunc((per100 * (eBp - BP)) / BP);
      off[id] = raw < min100 ? min100 : raw > max100 ? max100 : raw;
    }
  } else {
    // Fallback by rating-weight rank: top 2, next 2, rest (ties by stat order).
    const ranked = statIds.slice().sort((a, b) => (weightsBp[b] ?? 0) - (weightsBp[a] ?? 0) || statIds.indexOf(a) - statIds.indexOf(b));
    const fb = cfg.fallbackByRatingWeightRank;
    ranked.forEach((id, i) => {
      off[id] = roundN((i < 2 ? fb.top2 : i < 4 ? fb.next2 : fb.rest) * 100);
    });
  }
  if (content.development.potential.recenterClassOffsets) {
    let wSum = 0;
    let mean = 0;
    for (const id of statIds) {
      wSum += weightsBp[id] ?? 0;
      mean += (weightsBp[id] ?? 0) * (off[id] ?? 0);
    }
    if (wSum > 0) {
      mean /= wSum;
      for (const id of statIds) off[id] = (off[id] ?? 0) - mean;
    }
  }
  return off;
}
