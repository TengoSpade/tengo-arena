/**
 * Derived values (sys-fighters "Effective stats", sys-combat-stats "Rating").
 *
 *   developed100_i = cap100_i × M_g(D_g + bloom_i)          (interpolated curve, truncated)
 *   base100_i      = max(100, developed100_i − wear100_i)
 *   eff100_i       = base100_i + 100 × (trait adds + status adds + context + chemistry on cmp)
 *   stat_i         = clamp(floor(eff100_i / 100), 1, 20)    (what combat receives)
 *   rating         = clamp(round(5 × Σ ratingWeight_i × stat_i), 1, 100)   (the combat formula)
 */
import type { ContentDB } from '../content';
import type { Fighter, StatId } from '../model';
import { effectSources, hasEffect, statAdds } from './effects';
import { BP, roundN, truncN } from './fixed';
import { tables, type StatGroup } from './tables';

/** humanAge in hundredths of a year: floor(age × 80 × 100 / lifespan). */
export function humanAge100Of(age: number, lifespan: number, baseline = 80): number {
  return Math.floor((age * baseline * 100) / lifespan);
}

export function fighterHumanAge100(fighter: Fighter, content: ContentDB): number {
  const race = content.races.require(fighter.raceId);
  return humanAge100Of(fighter.age, race.lifespan, content.development.time.humanBaselineLifespan);
}

/** Maturity fraction (bp) at development clock d100, linear interpolation, clamped at both ends. */
export function maturityBp(content: ContentDB, group: StatGroup, d100: number): number {
  const curve = tables(content).maturity[group];
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (!first || !last) return BP;
  if (d100 <= first[0]) return first[1];
  if (d100 >= last[0]) return last[1];
  for (let i = 1; i < curve.length; i++) {
    const b = curve[i]!;
    if (d100 <= b[0]) {
      const a = curve[i - 1]!;
      return a[1] + Math.trunc(((b[1] - a[1]) * (d100 - a[0])) / (b[0] - a[0]));
    }
  }
  return last[1];
}

export function developed100(fighter: Fighter, stat: StatId, content: ContentDB): number {
  const group = tables(content).groupOf[stat] ?? 'mental';
  const cap = fighter.cap100[stat] ?? 0;
  const d = (group === 'physical' ? fighter.dev100.physical : fighter.dev100.mental) + (fighter.bloom[stat] ?? 0);
  return truncN((cap * maturityBp(content, group, d)) / BP);
}

export function base100(fighter: Fighter, stat: StatId, content: ContentDB): number {
  const v = developed100(fighter, stat, content) - (fighter.wear100[stat] ?? 0);
  return v < 100 ? 100 : v;
}

export interface StatsContext {
  matchType?: 'league' | 'tournament';
  chemistry?: number;
}

/** Composure points a fighter gets from lineup chemistry (sys-chemistry): chemistry ÷ divisor toward zero; 0 if chemistry-immune or disabled. */
export function chemistryComposure(fighter: Fighter, content: ContentDB, chemistry: number): number {
  const divisor = content.development.chemistry.composureDivisor;
  if (!divisor || chemistry === 0) return 0;
  if (hasEffect(effectSources(fighter, content), 'chemistryImmune')) return 0;
  return Math.trunc(chemistry / divisor);
}

/** Effective centipoints per stat. */
export function eff100(fighter: Fighter, content: ContentDB, context: StatsContext = {}): Record<StatId, number> {
  const t = tables(content);
  const adds = statAdds(fighter, content, { tournament: context.matchType === 'tournament' });
  const chem = context.chemistry ? chemistryComposure(fighter, content, context.chemistry) : 0;
  const out = {} as Record<StatId, number>;
  for (const id of t.statIds) {
    const extra = (adds[id] ?? 0) + (id === 'cmp' ? chem : 0);
    out[id] = base100(fighter, id, content) + 100 * extra;
  }
  return out;
}

export function displayStat(eff: number, content: ContentDB): number {
  const { statMin, statMax } = content.development.scale;
  const v = Math.floor(eff / 100);
  return v < statMin ? statMin : v > statMax ? statMax : v;
}

export function effectiveStatsOf(fighter: Fighter, content: ContentDB, context: StatsContext = {}): Record<StatId, number> {
  const e = eff100(fighter, content, context);
  const out = {} as Record<StatId, number>;
  for (const id of tables(content).statIds) out[id] = displayStat(e[id] ?? 0, content);
  return out;
}

/** The combat rating formula on integer stats: round(5 × Σ w_i × s_i), clamped 1-100. */
export function ratingFromStats(classId: string, stats: Readonly<Record<string, number>>, content: ContentDB): number {
  const weights = tables(content).ratingWeightsBp.get(classId);
  if (!weights) throw new RangeError(`Unknown class ${classId}`);
  let sum = 0;
  for (const [id, w] of Object.entries(weights)) sum += w * (stats[id] ?? 0);
  const { ratingMin, ratingMax } = content.development.scale;
  const r = roundN((5 * sum) / BP);
  return r < ratingMin ? ratingMin : r > ratingMax ? ratingMax : r;
}

export function ratingOf(fighter: Fighter, content: ContentDB): number {
  return ratingFromStats(fighter.classId, effectiveStatsOf(fighter, content), content);
}

/** Stats at full maturity: every stat at its cap, no wear, only permanent modifiers (physique and scar traits). */
export function potentialStats(fighter: Fighter, content: ContentDB): Record<StatId, number> {
  const t = tables(content);
  const adds = statAdds(fighter, content, { permanentOnly: true });
  const out = {} as Record<StatId, number>;
  for (const id of t.statIds) out[id] = displayStat((fighter.cap100[id] ?? 0) + 100 * (adds[id] ?? 0), content);
  return out;
}

export function potentialOf(fighter: Fighter, content: ContentDB): number {
  return ratingFromStats(fighter.classId, potentialStats(fighter, content), content);
}
