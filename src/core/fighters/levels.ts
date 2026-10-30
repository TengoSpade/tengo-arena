/**
 * M1.1 levels (progression.md sys-development "levels and XP per level",
 * sys-fighters "Stamina", §6 save migration). Implemented in the contracts
 * phase because the v2 -> v3 save migration needs them; WP-B owns them from
 * here on (05 M1.1 addendum).
 *
 *   initialLevel = 1 + round(Σ_i max(0, train100_i − share × cap100_i) ÷ 100)          (levels.json level)
 *   xpNeeded     = clamp(round5(B × A × G × lifeScale ÷ (pace × raceGrowth × traitDev × mentor)), min, max)
 *     B = base + perLevel × level;  A = wPhys × agePhys(ha) + (1 − wPhys) × ageMental(ha)
 *     G = gapFactor(potential − trainedRating);  lifeScale = lifespan ÷ 80 (lifespanScaling)
 *     raceGrowth / traitDev = the wPhys blend of the physical and mental multipliers
 *
 * Every formula rounds once at its end (./fixed.ts); factors are content
 * decimals converted to basis points, so results are identical everywhere.
 */
import type { ContentDB } from '../content';
import { FRESHNESS10_MAX, defaultAbilityRanks, type ClubId, type Fighter, type FreshnessLabel, type GameState, type StatId } from '../model';
import { Rng, STREAM, type Seed } from '../rng';
import { captaincyBreakdown, topFiveMean } from './captaincy';
import { traitDevMult } from './development';
import { effectSources, statAdds } from './effects';
import { BP, bp, roundN, stepLookup } from './fixed';
import { developed100, displayStat, effectiveStatsOf, fighterHumanAge100, freshRatingOf, potentialStats, ratingFromStats } from './stats';
import { tables } from './tables';

/** The class's rating-weight share on physical stats, Stamina included (wPhys), as a fraction. */
export function physicalWeightShare(classId: string, content: ContentDB): number {
  const t = tables(content);
  const w = t.ratingWeightsBp.get(classId);
  if (!w) throw new RangeError(`physicalWeightShare: unknown class "${classId}"`);
  let phys = 0;
  let all = 0;
  for (const id of t.statIds) {
    const v = w[id] ?? 0;
    all += v;
    if (t.groupOf[id] === 'physical') phys += v;
  }
  return all > 0 ? phys / all : 0;
}

/** 1 + round(Σ max(0, train100 − share × cap100) ÷ 100) over every stat (lvl-005: 13 × (1000 − 700) -> 40). */
export function initialLevel(fighter: Pick<Fighter, 'train100' | 'cap100'>, content: ContentDB): number {
  const shareBp = bp(content.levels.level.initialFloorShareOfCap);
  let sum = 0;
  for (const id of tables(content).statIds) {
    const floor = ((fighter.cap100[id] ?? 0) * shareBp) / BP;
    const above = (fighter.train100[id] ?? 0) - floor;
    if (above > 0) sum += above;
  }
  return 1 + roundN(sum / 100);
}

/** The developed value of every stat from the M1 clocks (cap × M_g(D_g + bloom)): train100 at generation and migration. */
export function trainFromClocks(fighter: Fighter, content: ContentDB): Record<StatId, number> {
  const out = {} as Record<StatId, number>;
  for (const id of tables(content).statIds) out[id] = developed100(fighter, id, content);
  return out;
}

/** Rating of the trained values with no wear (permanent trait adds as in potential): the gap factor's "trainedRating". */
export function trainedRating(fighter: Fighter, content: ContentDB): number {
  const t = tables(content);
  const adds = statAdds(fighter, content, { permanentOnly: true });
  const stats = {} as Record<StatId, number>;
  for (const id of t.statIds) stats[id] = displayStat(Math.max(100, fighter.train100[id] ?? 0) + 100 * (adds[id] ?? 0), content);
  return ratingFromStats(fighter.classId, stats, content);
}

export interface XpNeededContext {
  /** Mentoring multiplier for a young fighter (levelMentorMult), 1 when absent. */
  mentor?: number;
  /** Level whose requirement is wanted (default: the fighter's current level). */
  level?: number;
}

/** XP needed for the next level, frozen when a level starts (lvl-001: 155; lvl-002: 75; lvl-003: 500; lvl-004: 130). */
export function xpNeededFor(fighter: Fighter, content: ContentDB, ctx: XpNeededContext = {}): number {
  const x = content.levels.xpPerLevel;
  const race = content.races.require(fighter.raceId);
  const dev = content.development;
  const ha100 = fighterHumanAge100(fighter, content);
  const ha = ha100 / 100;
  const wPhys = physicalWeightShare(fighter.classId, content);
  const level = ctx.level ?? fighter.level;
  const b = x.base + x.perLevel * level;
  const a = wPhys * stepLookup(x.ageFactorPhysical, ha) + (1 - wPhys) * stepLookup(x.ageFactorMental, ha);
  const potential = ratingFromStats(fighter.classId, potentialStats(fighter, content), content);
  const g = stepLookup(x.gapFactor, potential - trainedRating(fighter, content));
  const lifeScale = x.lifespanScaling ? race.lifespan / dev.time.humanBaselineLifespan : 1;
  const pace = dev.pace.levels.find((l) => l.id === fighter.paceId)?.mult ?? 1;
  const raceGrowth = wPhys * race.growthMult.physical + (1 - wPhys) * race.growthMult.mental;
  const traitDev = wPhys * traitDevMult(fighter, content, 'physical', ha100) + (1 - wPhys) * traitDevMult(fighter, content, 'mental', ha100);
  const mentor = ctx.mentor ?? 1;
  const raw = (b * a * g * lifeScale) / (pace * raceGrowth * traitDev * mentor);
  const rounded = 5 * roundN(raw / 5);
  return rounded < x.min ? x.min : rounded > x.max ? x.max : rounded;
}

/**
 * Mentoring multiplier at a level start for a young fighter (human-age ≤
 * development.json captaincy.mentoring.youngHumanAgeAtMost): his club captain's
 * grade mentorDevMult × the strongest trait mentors on the roster (at most
 * traitMentorsCounted), capped at totalMentorMultCap; 1 otherwise.
 */
export function levelMentorMult(state: GameState, fighter: Fighter, content: ContentDB): number {
  const cfg = content.development.captaincy.mentoring;
  const clubId = fighter.clubId;
  if (clubId === null || fighter.status !== 'active' || fighterHumanAge100(fighter, content) > cfg.youngHumanAgeAtMost * 100) return 1;
  const club = state.clubs[clubId];
  let total = 1;
  const captain = club?.captainId ? state.fighters[club.captainId] : undefined;
  if (captain && captain.id !== fighter.id && captain.clubId === clubId) {
    total *= bp(captaincyBreakdown(captain, content, topFiveMean(state, clubId as ClubId, content)).grade.mentorDevMult) / BP;
  }
  const mentors: number[] = [];
  for (const f of Object.values(state.fighters)) {
    if (f.id === fighter.id || f.clubId !== clubId || f.status !== 'active') continue;
    for (const s of effectSources(f, content)) {
      if (s.kind !== 'trait') continue;
      for (const e of s.effects) if (e.type === 'mentor') mentors.push(e.youngDevMult);
    }
  }
  mentors.sort((p, q) => q - p);
  for (const m of mentors.slice(0, cfg.traitMentorsCounted)) total *= bp(m) / BP;
  const cap = bp(cfg.totalMentorMultCap) / BP;
  return total > cap ? cap : total;
}

/** Fresh M1.1 progression fields for a generated fighter (train100 from the clocks, initial level, rested, rank 1, no perks). */
export function initProgression(fighter: Fighter, content: ContentDB): void {
  fighter.train100 = trainFromClocks(fighter, content);
  fighter.level = initialLevel(fighter, content);
  fighter.xpIntoLevel = 0;
  fighter.xpNeeded = xpNeededFor(fighter, content);
  fighter.pendingLevelUps = [];
  fighter.levelUpMode = 'inherit';
  fighter.abilityRanks = defaultAbilityRanks();
  fighter.perkIds = [];
  fighter.freshness10 = roundN(content.levels.freshness.start * content.levels.freshness.storageUnitsPerPoint);
}

// ---- Freshness reads (sys-freshness) ------------------------------------------------------------------

/** Freshness 0-100 as the sim and the UI read it: floor(freshness10 ÷ 10); a missing value reads 100. */
export function freshnessOf(fighter: Pick<Fighter, 'freshness10'>): number {
  const v = fighter.freshness10;
  if (typeof v !== 'number') return 100;
  const c = v < 0 ? 0 : v > FRESHNESS10_MAX ? FRESHNESS10_MAX : v;
  return Math.floor(c / 10);
}

/** Label of a Freshness value 0-100 (levels.json freshness.labels: the first label whose min ≤ value). */
export function freshnessLabel(value: number, content: ContentDB): FreshnessLabel {
  for (const l of content.levels.freshness.labels) if (value >= l.min) return l.id;
  return content.levels.freshness.labels[content.levels.freshness.labels.length - 1]!.id;
}

/** Injury-chance multiplier (bp) for a round started at Freshness F: min(max, 1 + perPoint × (threshold − F)) below the threshold (frs-009). */
export function freshnessInjuryMultBp(value: number, content: ContentDB): number {
  const fr = content.levels.freshness;
  if (value >= fr.threshold) return BP;
  const m = BP + roundN(bp(fr.injuryMultPerPointBelow) * (fr.threshold - value));
  const max = bp(fr.injuryMultMax);
  return m > max ? max : m;
}

// ---- v2 -> v3 save migration (progression.md §6) ---------------------------------------------------------

/** Rng for the migration: Rng.create(root, 'migration', 'm1.1', fighterId, purpose). */
function migrationRng(root: Seed, fighterId: string, purpose: string): Rng {
  return Rng.create(root, STREAM.migration, 'm1.1', fighterId, purpose);
}

/**
 * The 12-stat rating a v2 save showed, from the M1.1 weights renormalised
 * without stamina (the v2 weights are the M1.1 ones ÷ 0.98, rounded; the v2
 * content is not available at load). Used only for the peak-rating shift.
 */
export function ratingWithoutStamina(fighter: Fighter, content: ContentDB): number {
  const t = tables(content);
  const w = t.ratingWeightsBp.get(fighter.classId)!;
  const stats = effectiveStatsOf(fighter, content);
  let sumW = 0;
  let sum = 0;
  for (const id of t.statIds) {
    if (id === 'stamina') continue;
    sumW += w[id] ?? 0;
    sum += (w[id] ?? 0) * (stats[id] ?? 0);
  }
  if (sumW <= 0) return freshRatingOf(fighter, content);
  const r = roundN((5 * sum) / sumW);
  const { ratingMin, ratingMax } = content.development.scale;
  return r < ratingMin ? ratingMin : r > ratingMax ? ratingMax : r;
}

/**
 * Migrate every v2 fighter of the state to v3 in place (progression.md §6
 * steps 1-7), in fighter id order: first Stamina, train100 and the peak shift
 * for everyone, then levels (the mentor term reads club-mates' final stats).
 * The caller (core/save migrateV2ToV3) gives the clubs their v3 fields.
 * Deterministic: every draw comes from the migration stream keyed by fighter
 * id, so migrating twice is byte-identical (mig-002).
 */
export function migrateFightersV3(state: GameState, content: ContentDB): void {
  const list = Object.values(state.fighters).sort((a, b) => idOrder(a.id) - idOrder(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const f of list) migrateStatsV3(state, f, content);
  for (const f of list) migrateLevelV3(state, f, content);
}

function idOrder(id: string): number {
  const n = Number(id.slice(id.lastIndexOf('-') + 1));
  return Number.isSafeInteger(n) ? n : 0;
}

function migrateStatsV3(state: GameState, fighter: Fighter, content: ContentDB): void {
  const t = tables(content);
  const dev = content.development;
  const sta = 'stamina' as StatId;
  const before = ratingWithoutStamina(fighter, content);
  // 2. Stamina: cap from P, the class offset, the race tendency, +2.5 and a ±3 jitter; bloom −2..2 human-years; shared physical wear.
  const race = content.races.require(fighter.raceId);
  const st = content.levels.stamina;
  const jitter100 = roundN(st.jitterPoints * 100);
  const jitter = migrationRng(state.rng.root, fighter.id, content.levels.migration.staminaPurpose).int(-jitter100, jitter100);
  const tendCap = dev.scale.raceTendencyCapPerStat;
  const tend = (race.statTendencies as Record<string, number>)['stamina'] ?? 0;
  const tend100 = roundN((tend > tendCap ? tendCap : tend < -tendCap ? -tendCap : tend) * 100);
  const offset = t.classOffset100.get(fighter.classId)?.['stamina'] ?? 0;
  const raw = roundN(fighter.potentialRoll * 20 + offset + tend100 + roundN(st.capOffsetPoints * 100) + jitter);
  const lo = dev.scale.capMin * 100;
  const hi = dev.scale.capMax * 100;
  const bloomRange = dev.developmentClock.bloomRangeHumanYears;
  fighter.cap100 = { ...fighter.cap100, [sta]: raw < lo ? lo : raw > hi ? hi : raw };
  fighter.bloom = { ...fighter.bloom, [sta]: migrationRng(state.rng.root, fighter.id, content.levels.migration.bloomPurpose).int(-bloomRange, bloomRange) * 100 };
  fighter.wear100 = { ...fighter.wear100, [sta]: fighter.wear100['str' as StatId] ?? 0 };
  // 1. train100 = the M1 developed value of every stat (Stamina: cap × M_phys(D_phys + bloom), the same formula).
  fighter.train100 = trainFromClocks(fighter, content);
  // 3. Rating: peakRating moves with the reweight so the change never triggers the D-T hazard.
  const after = freshRatingOf(fighter, content);
  fighter.career.peakRating = Math.max(0, fighter.career.peakRating + after - before);
  fighter.career.levelsGained = 0;
}

function migrateLevelV3(state: GameState, fighter: Fighter, content: ContentDB): void {
  // 4. Level from the formula; this season's round XP carried into the bar (below one level); no pending level-ups.
  fighter.level = initialLevel(fighter, content);
  fighter.xpNeeded = xpNeededFor(fighter, content, { mentor: levelMentorMult(state, fighter, content) });
  const carried = content.levels.migration.carrySeasonXpIntoBar ? fighter.season.xp : 0;
  fighter.xpIntoLevel = Math.max(0, Math.min(carried, fighter.xpNeeded - 1));
  fighter.pendingLevelUps = [];
  // 5-6. Rested; inherit the club policy; rank 1 everywhere, no perks.
  fighter.freshness10 = roundN(content.levels.migration.freshness * content.levels.freshness.storageUnitsPerPoint);
  fighter.levelUpMode = 'inherit';
  fighter.abilityRanks = defaultAbilityRanks();
  fighter.perkIds = [];
  // 7. Season counters gain zeros (M1 season XP was all round XP); history rows read null in the new columns.
  fighter.season = {
    ...fighter.season,
    roundXp: fighter.season.xp,
    benchXp: 0,
    levelLog: [],
    tiredRoundStarts: 0,
    spentRoundStarts: 0,
    restWeeks: 0,
    squadReserveMatches: 0,
  };
  fighter.history = fighter.history.map((row) => ({ ...row, levelStart: null, levelEnd: null, stamina: null, benchXp: null, tiredRoundStarts: null }));
}
