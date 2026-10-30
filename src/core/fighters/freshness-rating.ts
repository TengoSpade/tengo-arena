/**
 * Effective rating at a given Freshness (R2-T002): what a tired fighter's displayed rating is worth in the arena.
 *
 * The sim does not change a tired fighter's attributes; it applies the combat.json `freshness` penalty at the start of
 * every round (attack speed, move speed, Power, Support, reaction delay; the stepped tier of F, 0 / 5% / 10% / 15% and
 * +0 / 10 / 20 / 30% reaction at F 75 / 50 / 25, each x (1 - fatigueResist); KI-21, O36). The rating is a weighted sum of attributes (`rating = 5 x sum(w_i x attr_i)`,
 * classes.json `ratingWeights`), so the penalty is priced the same way: each penalised quantity is converted into
 * "attribute points the fighter would have to lose for the same combat loss", and those points are charged at the
 * fighter's own class weights.
 *
 *   attack speed  -p% (tier)  <->  AGI points      = p% / derived.attackSpeed.perAgi  (+2.5% attack speed per point)
 *   move speed    -p%        <->  PAC points      = p% / derived.moveSpeed.perPac  (+2% per point)
 *   Power         -p%        <->  Power weighted points = p% / derived.power.perWeightedPoint (+4% per weighted point);
 *                                every attribute in the class's powerAttrs loses that many points (their weights sum to 1)
 *   Support       -p%        <->  the same, over the class's supportAttrs (none for classes without Support)
 *   reaction      +p%        <->  AWR points      = p% x (his reaction time, s) / 0.01 (-0.01 s per Awareness point)
 *
 *   rating loss   = 5 x sum over the lost points of (class rating weight of that attribute x points)
 *   effectiveRating = clamp(round(rating - loss), ratingMin, ratingMax)
 *
 * It is an approximation, deliberately simple: the points are priced at the attribute's whole rating weight (an
 * attribute's weight also pays for effects the penalty does not touch, so the price is generous to the penalty);
 * Power and Support are not scaled by the fighter's own multiplier; attributes are not floored at 1; the reaction
 * penalty is charged to Awareness alone (Composure also feeds reaction time). Fighters whose weights sit on the
 * penalised attributes (fast strikers, casters) lose most; tanks, whose rating is mostly Toughness, lose least.
 * `fatigueResist` comes from the held perks (Long Wind +40%); no class passive or trait carries it today.
 *
 * Pure: (fighter, freshness, content) -> numbers. The same curve the sim applies (sim/profile.ts fatigueSeverityBp),
 * re-derived from content here because core/fighters may not import core/sim.
 */
import type { ContentDB } from '../content';
import type { Fighter } from '../model';
import { effectiveStatsOf, ratingOf } from './stats';

const BP = 10_000;

/** Rating points a Freshness penalty costs, by penalised quantity (each 0 or negative). */
export interface FreshnessRatingParts {
  attackSpeed: number;
  moveSpeed: number;
  power: number;
  support: number;
  reaction: number;
}

export interface FreshnessRating {
  /** The Freshness used (0-100, whole points, as the sim reads it). */
  freshness: number;
  /** Penalty severity after fatigueResist, 0-10,000 bp (the sim's `fatigueBp`): 0 at Freshness 60 and above, 10,000 at 10 and below with no resist. */
  severityBp: number;
  /** The fighter's rating with no penalty (what the tables show). */
  rating: number;
  /** Rating worth in the arena at this Freshness; equals `rating` at Freshness 60 and above. */
  effectiveRating: number;
  /** effectiveRating - rating: 0 or negative, whole points. */
  delta: number;
  /** The unrounded loss in rating points (0 or negative) and where it comes from. */
  deltaExact: number;
  parts: FreshnessRatingParts;
}

/** Freshness as the sim reads it: truncated to a whole point, clamped 0-100 (a missing value is the default 100). */
function wholeFreshness(freshness: number, content: ContentDB): number {
  if (!Number.isFinite(freshness)) return content.combat.freshness.default;
  return Math.min(100, Math.max(0, Math.trunc(freshness)));
}

/** fatigueResist of the fighter (a fraction): the unconditional `fatigueResist` stat mods of his held perks. */
export function fatigueResistOf(fighter: Pick<Fighter, 'perkIds'>, content: ContentDB): number {
  let sum = 0;
  for (const id of fighter.perkIds ?? []) {
    for (const m of content.perks.get(id)?.passive?.statMods ?? []) {
      if (m.stat === 'fatigueResist' && typeof m.value === 'number' && m.per === undefined && m.if === undefined) sum += m.value;
    }
  }
  return sum;
}

/** The penalty tier of a whole Freshness (combat.json freshness.tiers, as the sim reads it) and its rank among the penalty tiers in bp (0 for the top tier, 10,000 for the last). */
function tierAt(f: number, content: ContentDB): { tier: ContentDB['combat']['freshness']['tiers'][number]; rankBp: number } {
  const tiers = [...content.combat.freshness.tiers].sort((a, b) => b.minFreshness - a.minFreshness);
  const found = tiers.findIndex((t) => f >= t.minFreshness);
  // Below every tier's minimum (content without a 0 tier): the last, harshest tier, as the sim's fatigueTier does.
  const at = found === -1 ? tiers.length - 1 : found;
  return { tier: tiers[at]!, rankBp: Math.trunc((at * BP) / Math.max(1, tiers.length - 1)) };
}

/** The sim's Freshness penalty severity in bp (sim/profile.ts fatigueSeverityBp): the tier's rank among the penalty tiers x (1 - clamp(fatigueResist)). */
export function freshnessSeverityBp(freshness: number, fatigueResist: number, content: ContentDB): number {
  const fr = content.combat.freshness;
  const f = wholeFreshness(freshness, content);
  const [lo, hi] = fr.resistClamp;
  const resist = Math.min(Math.round(hi * BP), Math.max(Math.round(lo * BP), Math.round(fatigueResist * BP)));
  return Math.trunc((tierAt(f, content).rankBp * (BP - resist)) / BP);
}

/** The fighter's effective rating at `freshness` (see the file comment for the approximation). */
export function ratingAtFreshness(fighter: Fighter, freshness: number, content: ContentDB): FreshnessRating {
  const f = wholeFreshness(freshness, content);
  const rating = ratingOf(fighter, content);
  const severityBp = freshnessSeverityBp(f, fatigueResistOf(fighter, content), content);
  const zero: FreshnessRatingParts = { attackSpeed: 0, moveSpeed: 0, power: 0, support: 0, reaction: 0 };
  if (severityBp <= 0) return { freshness: f, severityBp: 0, rating, effectiveRating: rating, delta: 0, deltaExact: 0, parts: zero };

  // The tier's penalties scaled by (1 - fatigueResist): the same percentages the sim applies.
  const keep = severityBp / tierAt(f, content).rankBp;
  const tierPen = tierAt(f, content).tier;
  const s = 1;
  const pen = { attackSpeed: tierPen.attackSpeed * keep, moveSpeed: tierPen.moveSpeed * keep, power: tierPen.power * keep, support: tierPen.support * keep, reactionDelay: tierPen.reactionDelay * keep };
  const d = content.combat.derived;
  const klass = content.classes.require(fighter.classId);
  const w = klass.ratingWeights as Record<string, number>;
  const weight = (id: string): number => w[id] ?? 0;
  /** Rating points of losing `points` of each listed attribute. */
  const price = (ids: readonly string[], points: number): number => 5 * ids.reduce((n, id) => n + weight(id), 0) * points;
  const attrsOf = (m: Readonly<Record<string, number | undefined>> | null): { ids: string[]; sum: number } => {
    const ids = Object.keys(m ?? {}).filter((id) => (m![id] ?? 0) > 0);
    return { ids, sum: ids.reduce((n, id) => n + m![id]!, 0) };
  };

  const power = attrsOf(klass.powerAttrs as Record<string, number | undefined>);
  const support = attrsOf(klass.supportAttrs as Record<string, number | undefined> | null);
  const stats = effectiveStatsOf(fighter, content) as Record<string, number>;
  const r = d.reaction;
  const reactionS = Math.min(r.maxS, Math.max(r.minS, r.baseS + r.perAwrS * ((stats['awr'] ?? 10) - 10) + r.perCmpS * ((stats['cmp'] ?? 10) - 10)));

  const loss = (x: number): number => (x === 0 ? 0 : -x);
  const parts: FreshnessRatingParts = {
    attackSpeed: loss(price(['agi'], (-pen.attackSpeed * s) / d.attackSpeed.perAgi)),
    moveSpeed: loss(price(['pac'], (-pen.moveSpeed * s) / d.moveSpeed.perPac)),
    power: power.sum > 0 ? loss(price(power.ids, (-pen.power * s) / d.power.perWeightedPoint / power.sum)) : 0,
    support: support.sum > 0 ? loss(price(support.ids, (-pen.support * s) / d.support.perWeightedPoint / support.sum)) : 0,
    reaction: loss(price(['awr'], (pen.reactionDelay * s * reactionS) / -r.perAwrS)),
  };
  const deltaExact = parts.attackSpeed + parts.moveSpeed + parts.power + parts.support + parts.reaction;
  const { ratingMin, ratingMax } = content.development.scale;
  // Half away from zero, like the rating itself; the loss is never positive.
  const rounded = rating + (deltaExact < 0 ? -Math.round(-deltaExact) : Math.round(deltaExact));
  const effectiveRating = Math.min(rating, Math.min(ratingMax, Math.max(ratingMin, rounded)));
  return { freshness: f, severityBp, rating, effectiveRating, delta: effectiveRating - rating, deltaExact, parts };
}
