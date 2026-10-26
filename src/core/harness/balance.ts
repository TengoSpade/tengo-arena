import type { ContentDB, PerkDef } from '../content';
import { asId, type AbilityRanks, type FighterMatchStats, type PerkId, type RecordLevel, type RoundTiebreakStep, type SideInput } from '../model';
import { Rng, STREAM, deriveSeed, type Seed } from '../rng';
import { eligiblePerks, eligibleRankSteps, perkEligible, perkPool, simulateFight, simulateRound, sideInput, type FighterSpec } from '../sim';
import { byNumber, byString, chain } from '../util';

/**
 * Headless balance harness: many seeded fights -> per-class win rates (V1,
 * vis-002; 03-combat §8 "Balance harness specification"; M1.1 modes from
 * combat-skills.md §8). Owner: WP1 / M1.1 WP-A.
 * CONTRACT: options and report shape fixed (additive changes allowed).
 *
 * Pure: no clock of its own (the CLI may pass one for timings), no IO.
 * Every "fight" is one round. Lineups are drawn from the `balance` stream;
 * each pair of lineups plays twice with the same round seed and sides swapped
 * (mirroring), so side advantage cancels out. perk-impact, rank-impact and
 * fatigue use counterfactual pairs (see `versus`): the same matchup and seeds
 * with and without the change.
 */
export type BalanceMode =
  /** Random 5v5 drafts from all classes; win rate per class appearance. */
  | 'random-draft'
  /** Each class's default preset against the same class (sanity: ~50%). */
  | 'mirror'
  /** vis-002: tailored presets versus default presets at equal rating. */
  | 'preset-vs-default'
  /** M1.1: random drafts with ability ranks and perks per skill profile. */
  | 'progression'
  /** M1.1: per perk, the pick rate under auto-pick and the win-rate lift with and without the perk. */
  | 'perk-impact'
  /** M1.1: per rankable ability, rank 3 against rank 1 in the same matchups. */
  | 'rank-impact'
  /** M1.1: one side at a fixed Freshness profile against the same side fresh, in the same matchups. */
  | 'fatigue'
  /** M1.1: full matches with 7-fighter squads and swaps (runs game.playMatchAuto; needs WP-C). */
  | 'squad-match';

/** M1.1 skill profiles (combat-skills.md §8 "Typical progression assumptions"). */
export type SkillProfile = 'none' | 'season3' | 'veteran';
/** How the skills of a profile are chosen: auto-pick (pass A) or uniformly among eligible items (pass B). */
export type SkillPick = 'auto' | 'uniform';

export const SKILL_PROFILES: Readonly<Record<SkillProfile, { ranks: number; perks: number }>> = {
  none: { ranks: 0, perks: 0 },
  season3: { ranks: 2, perks: 1 },
  veteran: { ranks: 4, perks: 3 },
};

export interface BalanceOptions {
  seed: Seed;
  fights: number;
  content: ContentDB;
  mode?: BalanceMode;
  /** Additive: a millisecond clock for per-fight timings (the CLI passes performance.now). */
  clock?: () => number;
  /** Additive: record level of the timed fights (default 'none'; 'full' for the 3x budget check). */
  record?: RecordLevel;
  /** Additive (M1.1): skill profile (default: season3; fatigue: none). */
  profile?: SkillProfile;
  /** Additive (M1.1): skill choice (default auto). */
  pick?: SkillPick;
  /** Additive (M1.1): measured rounds per perk (perk-impact) or per ability (rank-impact), each also played without the change; default fights / items / 2, even. */
  perItem?: number;
}

export interface ClassBalanceRow {
  classId: string;
  appearances: number;
  wins: number;
  winRate: number;
  /** Additive: Wilson 95% interval of the win rate. */
  ciLow?: number;
  ciHigh?: number;
  /** Additive: averages per fighter-round. */
  avgDamage?: number;
  avgHealing?: number;
  avgDowns?: number;
  avgLifetimeS?: number;
}

/** Additive: rows for archetype groups and preset styles. */
export interface GroupBalanceRow {
  id: string;
  appearances: number;
  wins: number;
  winRate: number;
  ciLow: number;
  ciHigh: number;
}

export interface FightLengthStats {
  rounds: number;
  p10S: number;
  medianS: number;
  p90S: number;
  overtimeRate: number;
  timeCapRate: number;
  homeWinRate: number;
  tiebreakSteps: Partial<Record<RoundTiebreakStep, number>>;
}

/** Additive (M1.1): one perk's pick rate and win-rate lift. */
export interface PerkImpactRow {
  perkId: string;
  archetype: string;
  tier: number;
  /** Share of fighters (whose pool holds the perk) that hold it under auto-pick: season3 / veteran profile. */
  pickRate: number;
  pickRateVeteran: number;
  /** Rounds with the perk (perk-impact: side A with the perk; progression: the holders' fighter-rounds). */
  rounds: number;
  wins: number;
  winRate: number;
  /** perk-impact: side A's win rate without the perk (same matchups and seeds); progression: the holders' class win rates. */
  baselineWinRate: number;
  /** Win rate minus the baseline, in points (perk-impact: paired, 95% CI from the per-matchup differences). */
  liftPts: number;
  ciLowPts: number;
  ciHighPts: number;
  /** pickRateVeteran x liftPts. */
  dominance: number;
  /** Mean perk procs per round for triggered perks (perk-impact), else null. */
  procsPerRound: number | null;
  /** The perk has no combat effect (lifecycle-only effects). */
  lifecycleOnly: boolean;
  /** perk-impact: the situation the perk was measured in ('captain', 'fresh entry', 'F 40'), or null. */
  context: string | null;
  flags: string[];
}

/** Additive (M1.1): rank 3 against rank 1 of one ability. */
export interface RankImpactRow {
  abilityId: string;
  classId: string;
  slot: 'a1' | 'a2' | 'passive';
  family: string;
  rounds: number;
  wins: number;
  winRate: number;
  /** Side A's win rate with the ability at rank 1 (same matchups and seeds). */
  baselineWinRate: number;
  liftPts: number;
  ciLowPts: number;
  ciHighPts: number;
  flags: string[];
}

/** Additive (M1.1): the tired side's win rate for one Freshness profile. */
export interface FatigueRow {
  id: string;
  label: string;
  rounds: number;
  wins: number;
  /** 50% plus the paired change against the same side fresh (the estimate compared with the target). */
  winRate: number;
  ciLow: number;
  ciHigh: number;
  /** The tired side's raw win rate, and the same side's win rate fresh, in the same matchups and seeds. */
  rawWinRate: number;
  freshWinRate: number;
  target: { min: number; max: number };
  inTarget: boolean;
}

export interface BalanceReport {
  kind: 'balance';
  stub: boolean;
  mode: BalanceMode;
  seed: Seed;
  fights: number;
  contentHash: string;
  classes: ClassBalanceRow[];
  /** Classes outside the target band (docs/design 05 §10; M1.1 modes: combat-skills.md §8). */
  outliers: string[];
  targetBand: { min: number; max: number };
  /** Additive: pure archetypes plus 'hybrid', by fighter-round. */
  archetypes?: GroupBalanceRow[];
  archetypeOutliers?: string[];
  /** Additive (M1.1): the archetype band used for archetypeOutliers. */
  archetypeBand?: { min: number; max: number };
  /** Additive: preset styles (preset-vs-default: the tailored side's style). */
  styles?: GroupBalanceRow[];
  fightLength?: FightLengthStats;
  /** Additive: abilities never cast in more than half of their class's rounds. */
  rarelyCastAbilities?: { abilityId: string; neverCastShare: number; castsPerRound: number }[];
  /** Additive: preset rules that never fired in more than 80% of rounds. */
  idleRules?: { presetId: string; rule: number; neverFiredShare: number }[];
  /** Additive: fight-wide detectors (03-combat §8 targets). */
  detectors?: { healingPerDamage: number; overhealShare: number; hardCcUptime: number };
  /** Additive: ms per fight when a clock was given. */
  timing?: { record: RecordLevel; medianMs: number; p99Ms: number; meanMs: number; maxMs: number };
  /** Additive: every flag raised, in words. */
  flags?: string[];
  /** Additive (M1.1): skill profile and pick of the run. */
  profile?: SkillProfile;
  pick?: SkillPick;
  /** Additive (M1.1): perk-impact (paired) or progression (observational) rows, by dominance. */
  perks?: PerkImpactRow[];
  /** Additive (M1.1): rank-impact rows, by lift. */
  ranks?: RankImpactRow[];
  /** Additive (M1.1): fatigue rows. */
  fatigue?: FatigueRow[];
}

/** TUNABLE (tech): M1 first-pass band; M7 target 45-55%. */
export const BALANCE_TARGET_BAND = { min: 0.4, max: 0.6 } as const;

/** M1.1 targets at typical progression (combat-skills.md §8, PROPOSED · TUNABLE). */
export const M11_TARGETS = {
  archetype: { min: 0.42, max: 0.58 },
  class: { min: 0.35, max: 0.65 },
  timeCapMax: 0.02,
  overtimeMax: 0.25,
  medianS: { min: 25, max: 40 },
  /** perk-impact flags: lift > +5 points with the interval excluding 0; dominance top 3 above 1.0; pick share > 60%. */
  perkLiftPts: 5,
  perkDominance: 1,
  perkPickShare: 0.6,
  /** rank-impact flags: lift > +6 points or < +0.5 point. */
  rankLiftMaxPts: 6,
  rankLiftMinPts: 0.5,
} as const;

/** combat-skills.md §8 fatigue targets: the tired side's win rate. */
export const FATIGUE_PROFILES: readonly { id: string; label: string; freshness: number; count: 1 | 5; target: { min: number; max: number } }[] = [
  { id: 'one_f28', label: 'one fighter at F 28', freshness: 28, count: 1, target: { min: 0.44, max: 0.48 } },
  { id: 'all_f52', label: 'all five at F 52', freshness: 52, count: 5, target: { min: 0.45, max: 0.49 } },
  { id: 'all_f40', label: 'all five at F 40', freshness: 40, count: 5, target: { min: 0.3, max: 0.4 } },
  { id: 'all_f10', label: 'all five at F 10', freshness: 10, count: 5, target: { min: 0.15, max: 0.25 } },
];

/** 03-combat §8 flag thresholds (PROVISIONAL until combat.json carries them; OPEN request to the combat designer). */
const PROVISIONAL_OVERTIME_MAX = 0.25;
const PROVISIONAL_CAP_MAX = 0.01;
const PROVISIONAL_NEVER_CAST_MAX = 0.5;
const PROVISIONAL_NEVER_FIRED_MAX = 0.8;
const PROVISIONAL_STYLE_MAX = 0.55;
const PROVISIONAL_MEDIAN_MS_MAX = 2;

/**
 * Harness auto-pick (pass A): the best of AUTO_DRAWS offer draws by the
 * combat auto-pick value (combat-skills.md §5, perks.json aiPreferences).
 * An approximation of lifecycle's level-up auto-pick (fighters.autoPickChoice,
 * WP-B), which compares one drawn skill with stat options per level-up; the
 * best-of-3 stands for the several skill slots a fighter sees per pick.
 */
const AUTO_DRAWS = 3;

interface Tally {
  appearances: number;
  wins: number;
  damage: number;
  healing: number;
  downs: number;
  lifetime: number;
}

const newTally = (): Tally => ({ appearances: 0, wins: 0, damage: 0, healing: 0, downs: 0, lifetime: 0 });

export function wilson(wins: number, n: number): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 1 };
  const z = 1.96;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { low: center - half, high: center + half };
}

/** A random legal lineup: 5 classes, at most 2 of one class, at least one front-row starter. */
function drawLineup(rng: Rng, content: ContentDB): string[] {
  const ids = content.classes.list.map((k) => k.id);
  for (;;) {
    const pick: string[] = [];
    while (pick.length < 5) {
      const id = rng.pick(ids);
      if (pick.filter((x) => x === id).length < 2) pick.push(id);
    }
    if (pick.some((id) => content.classes.require(id).startingRow === 'front')) return pick;
  }
}

function tailoredPreset(rng: Rng, content: ContentDB, classId: string): string {
  const k = content.classes.require(classId);
  const others = k.presetIds.filter((p) => p !== k.defaultPresetId);
  return others.length > 0 ? rng.pick(others) : k.defaultPresetId;
}

// ---- M1.1 skills ------------------------------------------------------------------------------------

interface Skills {
  abilityRanks: AbilityRanks;
  perkIds: string[];
}

interface PickContext {
  classId: string;
  style: string;
  captainOrVice: boolean;
  stamina: number;
  presetSlots: ReadonlySet<string>;
}

interface AiPrefs {
  tagWeights: Record<string, Record<string, number>>;
  styleMult: Record<string, Record<string, number>>;
  context: {
    captainTag: { ifCaptainOrVice: number; otherwise: number };
    staminaTag: { ifStaminaAtMost8: number; ifStaminaAtLeast14: number };
    tier3Mult: number;
    rankScore: { base: number; familyBonus: Record<string, string[]>; familyBonusMult: number; passiveMult: number; presetUseMult: number };
  };
  autoPickValue: { rankBase: number; clamp: [number, number] };
}

const mean = (xs: readonly number[]): number => (xs.length === 0 ? 1 : xs.reduce((s, x) => s + x, 0) / xs.length);
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

function pickContext(content: ContentDB, spec: FighterSpec, captainOrVice: boolean): PickContext {
  const k = content.classes.require(spec.classId);
  const preset = content.presets.require(spec.presetId ?? k.defaultPresetId);
  const presetSlots = new Set<string>();
  for (const r of preset.rules) if (r.then.type === 'ability') presetSlots.add(String(r.then['slot']));
  return { classId: k.id, style: preset.style, captainOrVice, stamina: spec.stats?.stamina ?? spec.baseStat ?? 10, presetSlots };
}

/** combat-skills.md §5 perk value: autoPickValue x tag factor x style multiplier x context, clamped. */
export function perkAutoValue(content: ContentDB, perk: PerkDef, ctx: PickContext): number {
  const ai = content.perkAiPreferences as unknown as AiPrefs;
  const rows = content.classes.require(ctx.classId).archetypes.map((a) => ai.tagWeights[a] ?? {});
  const tags = perk.tags as readonly string[];
  const tagFactor = mean(tags.map((t) => mean(rows.map((r) => r[t] ?? 1))));
  const style = ai.styleMult[ctx.style] ?? {};
  const styleMult = mean(tags.map((t) => style[t] ?? 1));
  let context = 1;
  if (tags.includes('captain')) context *= ctx.captainOrVice ? ai.context.captainTag.ifCaptainOrVice : ai.context.captainTag.otherwise;
  if (tags.includes('stamina')) {
    if (ctx.stamina <= 8) context *= ai.context.staminaTag.ifStaminaAtMost8;
    else if (ctx.stamina >= 14) context *= ai.context.staminaTag.ifStaminaAtLeast14;
  }
  if (perk.tier === 3) context *= ai.context.tier3Mult;
  const [lo, hi] = ai.autoPickValue.clamp;
  return clamp(perk.autoPickValue * tagFactor * styleMult * context, lo, hi);
}

/** combat-skills.md §5 rank value: base x family bonus x passive multiplier x preset use, clamped. */
export function rankAutoValue(content: ContentDB, slot: 'a1' | 'a2' | 'passive', ctx: PickContext): number {
  const ai = content.perkAiPreferences as unknown as AiPrefs;
  const rs = ai.context.rankScore;
  const k = content.classes.require(ctx.classId);
  const family = content.abilityRanks(k.abilities[slot])?.family ?? '';
  let v = ai.autoPickValue.rankBase;
  if (k.archetypes.some((a) => (rs.familyBonus[a] ?? []).includes(family))) v *= rs.familyBonusMult;
  if (slot === 'passive') v *= rs.passiveMult;
  if (ctx.presetSlots.has(slot)) v *= rs.presetUseMult;
  const [lo, hi] = ai.autoPickValue.clamp;
  return clamp(v, lo, hi);
}

/** Draw a fighter's ranks and perks for a profile (stat gates are not applied: harness fighters have flat stats). */
function drawSkills(rng: Rng, content: ContentDB, ctx: PickContext, profile: SkillProfile, pick: SkillPick, exclude: readonly string[] = []): Skills {
  const { ranks: nRanks, perks: nPerks } = SKILL_PROFILES[profile];
  const ranks = { a1: 1, a2: 1, passive: 1 } as { a1: 1 | 2 | 3; a2: 1 | 2 | 3; passive: 1 | 2 | 3 };
  for (let i = 0; i < nRanks; i++) {
    const steps = eligibleRankSteps(content, ctx.classId, ranks);
    if (steps.length === 0) break;
    let step = rng.pick(steps);
    if (pick === 'auto') {
      let best = rankAutoValue(content, step.slot, ctx);
      for (let d = 1; d < AUTO_DRAWS; d++) {
        const s = rng.pick(steps);
        const v = rankAutoValue(content, s.slot, ctx);
        if (v > best) {
          best = v;
          step = s;
        }
      }
    }
    ranks[step.slot] = step.toRank;
  }
  const tierW = content.perkRules.offerDraw.perkTierWeights as unknown as Record<string, number>;
  const held: string[] = [];
  for (let i = 0; i < nPerks; i++) {
    const pool = eligiblePerks(content, ctx.classId, held).filter((p) => !exclude.includes(p.id));
    if (pool.length === 0) break;
    let perk: PerkDef;
    if (pick === 'uniform') perk = rng.pick(pool);
    else {
      perk = rng.weighted(pool, (p) => tierW[String(p.tier)] ?? 1);
      let best = perkAutoValue(content, perk, ctx);
      for (let d = 1; d < AUTO_DRAWS; d++) {
        const p = rng.weighted(pool, (q) => tierW[String(q.tier)] ?? 1);
        const v = perkAutoValue(content, p, ctx);
        if (v > best) {
          best = v;
          perk = p;
        }
      }
    }
    held.push(perk.id);
  }
  return { abilityRanks: { ...ranks }, perkIds: held };
}

/** Copy a side with per-fighter M1.1 fields. */
function withRoundFields(side: SideInput, skills: readonly (Skills | null)[], freshness: readonly number[] = [], entered: readonly boolean[] = []): SideInput {
  return {
    ...side,
    fighters: side.fighters.map((f, i) => {
      const s = skills[i];
      return {
        ...f,
        ...(s ? { abilityRanks: s.abilityRanks, perkIds: s.perkIds.map((id) => asId<PerkId>(id)) } : {}),
        ...(freshness[i] !== undefined ? { freshness: freshness[i] } : {}),
        ...(entered[i] ? { enteredThisRound: true } : {}),
      };
    }),
  };
}

// ---- Collector -----------------------------------------------------------------------------------------

interface PlayArgs {
  home: SideInput;
  away: SideInput;
  homeSpecs: readonly FighterSpec[];
  awaySpecs: readonly FighterSpec[];
  roundSeed: Seed;
  /** Style tally key per fighter (classic modes). */
  styleOf: (spec: FighterSpec, homeSide: boolean) => string;
  /** Use simulateRound (M1.1 modes) rather than simulateFight. */
  roundApi: boolean;
  /** Record level override (perk procs need 'summary'). */
  record?: RecordLevel;
}

interface PlayResult {
  winner: 'home' | 'away' | null;
  /** Per-unit perk procs (home slots 0-4, away 5-9) when recorded. */
  procs: Record<string, number>[] | null;
}

function collector(content: ContentDB, record: RecordLevel, clock: (() => number) | undefined) {
  const ticksPerSecond = content.combat.tick.ticksPerSecond;
  const overtimeStart = Math.round(content.combat.overtime.startS * ticksPerSecond);
  const classIds = content.classes.list.map((k) => k.id);
  const classes = new Map<string, Tally>(classIds.map((id) => [id, newTally()]));
  const groups = new Map<string, Tally>();
  const styles = new Map<string, Tally>();
  const abilityCasts = new Map<string, { rounds: number; never: number; casts: number }>();
  const ruleFires = new Map<string, { rounds: number; never: number[] }>();
  const durations: number[] = [];
  const times: number[] = [];
  const steps: Partial<Record<RoundTiebreakStep, number>> = {};
  let overtime = 0;
  let capped = 0;
  let homeWins = 0;
  let damage = 0;
  let healing = 0;
  let overheal = 0;
  let ccTicks = 0;
  let arenaTicks = 0;
  let played = 0;

  const groupOf = (classId: string): string => {
    const k = content.classes.require(classId);
    return k.archetypes.length === 1 ? k.archetypes[0]! : 'hybrid';
  };
  const count = (map: Map<string, Tally>, key: string, won: boolean, s: FighterMatchStats | null): void => {
    let t = map.get(key);
    if (!t) {
      t = newTally();
      map.set(key, t);
    }
    t.appearances++;
    if (won) t.wins++;
    if (s) {
      t.damage += s.damageDealt + s.damageToShields;
      t.healing += s.healingDone + s.shieldingDone;
      t.downs += s.downsInflicted;
      t.lifetime += s.ticksOnArena;
    }
  };

  function play(a: PlayArgs): PlayResult {
    const rec = a.record ?? record;
    const t0 = clock ? clock() : 0;
    const out = a.roundApi
      ? simulateRound({ round: 1, home: a.home, away: a.away }, a.roundSeed, content, { record: rec })
      : simulateFight({ seed: a.roundSeed, round: 1, home: a.home, away: a.away }, content, { record: rec });
    if (clock) times.push(clock() - t0);
    played++;
    const r = out.result;
    durations.push(r.durationTicks);
    if (r.durationTicks > overtimeStart) overtime++;
    if (r.endReason === 'time-limit') capped++;
    if (r.winner === 'home') homeWins++;
    if (r.tiebreakStep) steps[r.tiebreakStep] = (steps[r.tiebreakStep] ?? 0) + 1;
    for (const [side, specs, input] of [
      ['home', a.homeSpecs, a.home],
      ['away', a.awaySpecs, a.away],
    ] as const) {
      const won = r.winner === side;
      specs.forEach((spec, slot) => {
        const s = out.fighterStats[input.fighters[slot]!.fighterId]!;
        count(classes, spec.classId, won, s);
        count(groups, groupOf(spec.classId), won, null);
        count(styles, a.styleOf(spec, side === 'home'), won, null);
        damage += s.damageDealt + s.damageToShields;
        healing += s.healingDone;
        overheal += s.overheal;
        ccTicks += s.ccReceivedTicks;
        arenaTicks += s.ticksOnArena;
        const k = content.classes.require(spec.classId);
        for (const slotName of ['a1', 'a2'] as const) {
          const abilityId = k.abilities[slotName];
          const casts = s.casts[abilityId as never] ?? 0;
          const row = abilityCasts.get(abilityId) ?? { rounds: 0, never: 0, casts: 0 };
          row.rounds++;
          row.casts += casts;
          if (casts === 0) row.never++;
          abilityCasts.set(abilityId, row);
        }
        const presetId = spec.presetId ?? k.defaultPresetId;
        const fr = ruleFires.get(presetId) ?? { rounds: 0, never: new Array<number>(s.ruleFires.length - 1).fill(0) };
        fr.rounds++;
        for (let ri = 0; ri < s.ruleFires.length - 1; ri++) if ((s.ruleFires[ri] ?? 0) === 0) fr.never[ri]!++;
        ruleFires.set(presetId, fr);
      });
    }
    let procs: Record<string, number>[] | null = null;
    if (out.log) {
      const ev = out.log.events.find((e) => e.type === 'round.summary');
      const units = (ev?.data as unknown as { units?: { perkProcs?: Record<string, number> }[] } | undefined)?.units;
      if (units) procs = units.map((u) => u.perkProcs ?? {});
    }
    return { winner: r.winner, procs };
  }

  function classWinRate(classId: string): number {
    const t = classes.get(classId)!;
    return t.appearances ? t.wins / t.appearances : 0.5;
  }

  function report(
    base: { mode: BalanceMode; seed: Seed; classBand: { min: number; max: number }; archetypeBand: { min: number; max: number }; m11: boolean },
  ): Omit<BalanceReport, 'kind' | 'stub'> {
    const row = (classId: string, t: Tally): ClassBalanceRow => {
      const ci = wilson(t.wins, t.appearances);
      const n = Math.max(1, t.appearances);
      return {
        classId,
        appearances: t.appearances,
        wins: t.wins,
        winRate: t.appearances ? t.wins / t.appearances : 0,
        ciLow: round4(ci.low),
        ciHigh: round4(ci.high),
        avgDamage: Math.round(t.damage / n),
        avgHealing: Math.round(t.healing / n),
        avgDowns: round4(t.downs / n),
        avgLifetimeS: round4(t.lifetime / n / ticksPerSecond),
      };
    };
    const groupRow = (id: string, t: Tally): GroupBalanceRow => {
      const ci = wilson(t.wins, t.appearances);
      return { id, appearances: t.appearances, wins: t.wins, winRate: t.appearances ? t.wins / t.appearances : 0, ciLow: round4(ci.low), ciHigh: round4(ci.high) };
    };
    const inBand = (r: number, band: { min: number; max: number }): boolean => r >= band.min && r <= band.max;

    const classRows = [...classes.entries()]
      .map(([id, t]) => row(id, t))
      .sort(chain(byNumber((r: ClassBalanceRow) => r.winRate, true), byString((r: ClassBalanceRow) => r.classId)));
    const outliers = classRows.filter((r) => r.appearances > 0 && !inBand(r.winRate, base.classBand)).map((r) => r.classId);
    const archetypes = [...groups.entries()].map(([id, t]) => groupRow(id, t)).sort(byString((r: GroupBalanceRow) => r.id));
    const archetypeOutliers = archetypes.filter((r) => r.appearances > 0 && !inBand(r.winRate, base.archetypeBand)).map((r) => r.id);
    const styleRows = [...styles.entries()].map(([id, t]) => groupRow(id, t)).sort(byString((r: GroupBalanceRow) => r.id));

    const sorted = [...durations].sort((x, y) => x - y);
    const q = (p: number): number => (sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]! / ticksPerSecond);
    const n = Math.max(1, durations.length);
    const fightLength: FightLengthStats = {
      rounds: durations.length,
      p10S: q(0.1),
      medianS: q(0.5),
      p90S: q(0.9),
      overtimeRate: round4(overtime / n),
      timeCapRate: round4(capped / n),
      homeWinRate: round4(homeWins / n),
      tiebreakSteps: steps,
    };

    const rarelyCastAbilities = [...abilityCasts.entries()]
      .map(([abilityId, r]) => ({ abilityId, neverCastShare: round4(r.never / r.rounds), castsPerRound: round4(r.casts / r.rounds) }))
      .filter((r) => r.neverCastShare > PROVISIONAL_NEVER_CAST_MAX)
      .sort((x, y) => y.neverCastShare - x.neverCastShare || (x.abilityId < y.abilityId ? -1 : x.abilityId > y.abilityId ? 1 : 0));
    const idleRules: { presetId: string; rule: number; neverFiredShare: number }[] = [];
    for (const [presetId, r] of [...ruleFires.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
      r.never.forEach((nv, rule) => {
        const share = round4(nv / r.rounds);
        if (share > PROVISIONAL_NEVER_FIRED_MAX) idleRules.push({ presetId, rule, neverFiredShare: share });
      });
    }

    let timing: BalanceReport['timing'];
    if (clock && times.length > 0) {
      const ts = [...times].sort((x, y) => x - y);
      timing = {
        record,
        medianMs: round4(ts[Math.floor(ts.length / 2)]!),
        p99Ms: round4(ts[Math.min(ts.length - 1, Math.floor(ts.length * 0.99))]!),
        meanMs: round4(ts.reduce((s, x) => s + x, 0) / ts.length),
        maxMs: round4(ts[ts.length - 1]!),
      };
    }

    const capMax = base.m11 ? M11_TARGETS.timeCapMax : PROVISIONAL_CAP_MAX;
    const flags: string[] = [];
    for (const r of classRows) if (r.appearances > 0 && !inBand(r.winRate, base.classBand)) flags.push(`class ${r.classId} win rate ${pct(r.winRate)}`);
    for (const r of archetypes) if (r.appearances > 0 && !inBand(r.winRate, base.archetypeBand)) flags.push(`archetype ${r.id} win rate ${pct(r.winRate)}`);
    if (fightLength.overtimeRate > PROVISIONAL_OVERTIME_MAX) flags.push(`overtime rate ${pct(fightLength.overtimeRate)} > 25%`);
    if (fightLength.timeCapRate > capMax) flags.push(`time-cap rate ${pct(fightLength.timeCapRate)} > ${pct(capMax)}`);
    if (base.m11 && durations.length > 0 && (fightLength.medianS < M11_TARGETS.medianS.min || fightLength.medianS > M11_TARGETS.medianS.max)) {
      flags.push(`median fight ${fightLength.medianS.toFixed(1)} s outside ${M11_TARGETS.medianS.min}-${M11_TARGETS.medianS.max} s`);
    }
    for (const r of styleRows) if (r.id !== 'default' && r.appearances > 0 && r.winRate >= PROVISIONAL_STYLE_MAX) flags.push(`style ${r.id} win rate ${pct(r.winRate)} >= 55%`);
    for (const a of rarelyCastAbilities) flags.push(`ability ${a.abilityId} never cast in ${pct(a.neverCastShare)} of rounds`);
    for (const r of idleRules) flags.push(`rule ${r.presetId}#${r.rule + 1} never fired in ${pct(r.neverFiredShare)} of rounds`);
    if (timing && record === 'none' && timing.medianMs > PROVISIONAL_MEDIAN_MS_MAX) flags.push(`median ${timing.medianMs} ms per round > 2 ms`);

    return {
      mode: base.mode,
      seed: base.seed,
      fights: played,
      contentHash: content.ref.hash,
      classes: classRows,
      outliers,
      targetBand: { ...base.classBand },
      archetypes,
      archetypeOutliers,
      ...(base.m11 ? { archetypeBand: { ...base.archetypeBand } } : {}),
      styles: styleRows,
      fightLength,
      rarelyCastAbilities,
      idleRules,
      detectors: {
        healingPerDamage: round4(damage ? healing / damage : 0),
        overhealShare: round4(healing + overheal ? overheal / (healing + overheal) : 0),
        hardCcUptime: round4(arenaTicks ? ccTicks / arenaTicks : 0),
      },
      ...(timing ? { timing } : {}),
      flags,
    };
  }

  return { play, report, classWinRate, played: () => played };
}

// ---- Entry -----------------------------------------------------------------------------------------

export function runBalance(options: BalanceOptions): BalanceReport {
  const { seed, fights, content } = options;
  const mode = options.mode ?? 'random-draft';
  if (!Number.isSafeInteger(fights) || fights < 0) throw new RangeError(`fights must be a non-negative integer, got ${fights}`);
  if (mode === 'squad-match') {
    throw new Error('balance: squad-match runs game.playMatchAuto with 7-fighter squads and swaps, which lands with M1.1 WP-C (not merged on this branch)');
  }
  const record = options.record ?? 'none';
  const col = collector(content, record, options.clock);
  const m11 = mode === 'progression' || mode === 'perk-impact' || mode === 'rank-impact' || mode === 'fatigue';
  const profile: SkillProfile = options.profile ?? (mode === 'fatigue' ? 'none' : 'season3');
  const pick: SkillPick = options.pick ?? 'auto';
  const extra: Partial<BalanceReport> = {};

  if (mode === 'random-draft' || mode === 'mirror' || mode === 'preset-vs-default') classic(options, mode, col);
  else if (mode === 'progression') extra.perks = progression(options, profile, pick, col);
  else if (mode === 'perk-impact') extra.perks = perkImpact(options, profile, pick, col);
  else if (mode === 'rank-impact') extra.ranks = rankImpact(options, profile, pick, col);
  else extra.fatigue = fatigue(options, profile, pick, col);

  const base = col.report({
    mode,
    seed,
    classBand: m11 ? M11_TARGETS.class : BALANCE_TARGET_BAND,
    archetypeBand: m11 ? M11_TARGETS.archetype : BALANCE_TARGET_BAND,
    m11,
  });
  const flags = [...(base.flags ?? [])];
  for (const p of extra.perks ?? []) for (const f of p.flags) flags.push(`perk ${p.perkId}: ${f}`);
  for (const r of extra.ranks ?? []) for (const f of r.flags) flags.push(`rank ${r.abilityId}: ${f}`);
  for (const r of extra.fatigue ?? []) if (!r.inTarget) flags.push(`fatigue ${r.id}: tired side ${pct(r.winRate)} outside ${pct(r.target.min)}-${pct(r.target.max)}`);
  // Mirror-style M1.1 modes measure one side against its twin: class and archetype rates are not balance signals there.
  const paired = mode === 'perk-impact' || mode === 'rank-impact' || mode === 'fatigue';
  const kept = paired ? flags.filter((f) => !f.startsWith('class ') && !f.startsWith('archetype ')) : flags;
  return {
    kind: 'balance',
    stub: false,
    ...base,
    ...(paired ? { outliers: [], archetypeOutliers: [] } : {}),
    flags: kept,
    ...(m11 ? { profile, pick } : {}),
    ...extra,
  };
}

type Collector = ReturnType<typeof collector>;

function classic(options: BalanceOptions, mode: 'random-draft' | 'mirror' | 'preset-vs-default', col: Collector): void {
  const { seed, fights, content } = options;
  const pairs = Math.ceil(fights / 2);
  let played = 0;
  for (let i = 0; i < pairs; i++) {
    const rng = Rng.create(seed, STREAM.balance, mode, i);
    const a = drawLineup(rng, content);
    const b = mode === 'random-draft' ? drawLineup(rng, content) : [...a];
    const specsA: FighterSpec[] = a.map((classId) => ({ classId }));
    const specsB: FighterSpec[] = b.map((classId) => ({ classId }));
    if (mode === 'preset-vs-default') for (const s of specsA) s.presetId = tailoredPreset(rng, content, s.classId);
    const capA = rng.int(0, 4);
    const capB = rng.int(0, 4);
    const roundSeed = deriveSeed(seed, STREAM.balance, mode, i);
    for (let swap = 0; swap < 2 && played < fights; swap++, played++) {
      const homeSpecs = swap === 0 ? specsA : specsB;
      const awaySpecs = swap === 0 ? specsB : specsA;
      col.play({
        home: sideInput(content, 'home', homeSpecs, swap === 0 ? capA : capB),
        away: sideInput(content, 'away', awaySpecs, swap === 0 ? capB : capA),
        homeSpecs,
        awaySpecs,
        roundSeed,
        roundApi: false,
        styleOf: (spec, homeSide) => {
          if (mode === 'preset-vs-default') {
            const tailored = (homeSide ? homeSpecs : awaySpecs) === specsA;
            const style = tailored ? (content.presets.get(spec.presetId ?? '')?.style ?? 'balanced') : 'default';
            return tailored ? `tailored:${style}` : 'default';
          }
          return content.presets.get(content.classes.require(spec.classId).defaultPresetId)?.style ?? 'balanced';
        },
      });
    }
  }
}

const defaultStyle = (content: ContentDB) => (spec: FighterSpec) => content.presets.get(spec.presetId ?? content.classes.require(spec.classId).defaultPresetId)?.style ?? 'balanced';

/** Skills for a lineup: captain at `cap`, vice the next slot. */
function lineupSkills(rng: Rng, content: ContentDB, specs: readonly FighterSpec[], cap: number, profile: SkillProfile, pick: SkillPick): Skills[] {
  return specs.map((s, i) => drawSkills(rng, content, pickContext(content, s, i === cap || i === (cap + 1) % 5), profile, pick));
}

interface PerkTally {
  eligible: number;
  held: number;
  eligibleVet: number;
  heldVet: number;
  rounds: number;
  wins: number;
  /** progression: the holders' class win rates, summed. */
  expected: number;
  procs: number;
  /** perk-impact: counterfactual pairs. */
  baseWins: number;
  matchups: number;
  dSum: number;
  dSq: number;
}

const newPerkTally = (): PerkTally => ({ eligible: 0, held: 0, eligibleVet: 0, heldVet: 0, rounds: 0, wins: 0, expected: 0, procs: 0, baseWins: 0, matchups: 0, dSum: 0, dSq: 0 });

/** Pick rates under auto-pick at season3 and veteran, from pure draws (no fights). */
function samplePickRates(seed: Seed, content: ContentDB, samplesPerClass: number, tallies: Map<string, PerkTally>): void {
  for (const k of content.classes.list) {
    const pool = perkPool(content, k.id).map((p) => p.id);
    for (let i = 0; i < samplesPerClass; i++) {
      const rng = Rng.create(seed, STREAM.balance, 'pick-rate', k.id, i);
      const ctx = pickContext(content, { classId: k.id }, i % 5 < 2);
      const s3 = drawSkills(rng, content, ctx, 'season3', 'auto');
      const vet = drawSkills(rng, content, ctx, 'veteran', 'auto');
      for (const id of pool) {
        const t = tallies.get(id)!;
        t.eligible++;
        t.eligibleVet++;
        if (s3.perkIds.includes(id)) t.held++;
        if (vet.perkIds.includes(id)) t.heldVet++;
      }
    }
  }
}

function perkRows(content: ContentDB, tallies: Map<string, PerkTally>, paired: boolean): PerkImpactRow[] {
  const rows: PerkImpactRow[] = [];
  for (const p of content.perks.list) {
    const t = tallies.get(p.id)!;
    const winRate = t.rounds ? t.wins / t.rounds : 0;
    const base = paired ? (t.rounds ? t.baseWins / t.rounds : 0.5) : t.rounds ? t.expected / t.rounds : 0.5;
    const ci = wilson(t.wins, t.rounds);
    const lift = paired ? pairedLift(t.dSum, t.dSq, t.matchups) : { liftPts: (winRate - base) * 100, ciLowPts: (ci.low - base) * 100, ciHighPts: (ci.high - base) * 100 };
    const pickRate = t.eligible ? t.held / t.eligible : 0;
    const pickRateVeteran = t.eligibleVet ? t.heldVet / t.eligibleVet : 0;
    const liftPts = lift.liftPts;
    const triggered = (p.passive?.triggers.length ?? 0) > 0;
    rows.push({
      perkId: p.id,
      archetype: p.archetype,
      tier: p.tier,
      pickRate: round4(pickRate),
      pickRateVeteran: round4(pickRateVeteran),
      rounds: t.rounds,
      wins: t.wins,
      winRate: round4(winRate),
      baselineWinRate: round4(base),
      liftPts: round2(liftPts),
      ciLowPts: round2(lift.ciLowPts),
      ciHighPts: round2(lift.ciHighPts),
      dominance: round4(pickRateVeteran * liftPts),
      procsPerRound: paired && triggered && t.rounds ? round4(t.procs / t.rounds) : null,
      lifecycleOnly: !p.passive && p.traitEffects.length === 0,
      context: paired ? perkContext(p).label : null,
      flags: [],
    });
  }
  rows.sort((x, y) => y.dominance - x.dominance || (x.perkId < y.perkId ? -1 : 1));
  for (const r of rows) {
    if (r.rounds > 0 && r.liftPts > M11_TARGETS.perkLiftPts && r.ciLowPts > 0) r.flags.push(`lift +${r.liftPts.toFixed(1)} points (CI ${r.ciLowPts.toFixed(1)} to ${r.ciHighPts.toFixed(1)})`);
    if (r.pickRateVeteran > M11_TARGETS.perkPickShare) r.flags.push(`pick share ${pct(r.pickRateVeteran)} > 60%`);
    if (paired && r.procsPerRound === 0) r.flags.push('never procs');
  }
  rows.slice(0, 3).forEach((r) => {
    if (r.dominance > M11_TARGETS.perkDominance) r.flags.push(`dominance ${r.dominance.toFixed(2)} in the top 3 above 1.0`);
  });
  return rows;
}

/** progression: random drafts, skills per profile on every fighter; observational perk rows. */
function progression(options: BalanceOptions, profile: SkillProfile, pick: SkillPick, col: Collector): PerkImpactRow[] {
  const { seed, fights, content } = options;
  const tallies = new Map<string, PerkTally>(content.perks.list.map((p) => [p.id, newPerkTally()]));
  const holders: { perkId: string; classId: string; won: boolean }[] = [];
  const pairs = Math.ceil(fights / 2);
  let played = 0;
  for (let i = 0; i < pairs; i++) {
    const rng = Rng.create(seed, STREAM.balance, 'progression', profile, pick, i);
    const specsA: FighterSpec[] = drawLineup(rng, content).map((classId) => ({ classId }));
    const specsB: FighterSpec[] = drawLineup(rng, content).map((classId) => ({ classId }));
    const capA = rng.int(0, 4);
    const capB = rng.int(0, 4);
    const skillsA = lineupSkills(rng, content, specsA, capA, profile, pick);
    const skillsB = lineupSkills(rng, content, specsB, capB, profile, pick);
    const roundSeed = deriveSeed(seed, STREAM.balance, 'progression', i);
    for (let swap = 0; swap < 2 && played < fights; swap++, played++) {
      const [hs, as, hk, ak, hc, ac] = swap === 0 ? [specsA, specsB, skillsA, skillsB, capA, capB] : [specsB, specsA, skillsB, skillsA, capB, capA];
      const r = col.play({
        home: withRoundFields(sideInput(content, 'home', hs, hc, (hc + 1) % 5), hk),
        away: withRoundFields(sideInput(content, 'away', as, ac, (ac + 1) % 5), ak),
        homeSpecs: hs,
        awaySpecs: as,
        roundSeed,
        roundApi: true,
        styleOf: defaultStyle(content),
      });
      for (const [specs, skills, side] of [
        [hs, hk, 'home'],
        [as, ak, 'away'],
      ] as const) {
        specs.forEach((s, slot) => {
          for (const id of skills[slot]!.perkIds) holders.push({ perkId: id, classId: s.classId, won: r.winner === side });
        });
      }
    }
  }
  for (const h of holders) {
    const t = tallies.get(h.perkId)!;
    t.rounds++;
    if (h.won) t.wins++;
    t.expected += col.classWinRate(h.classId);
  }
  samplePickRates(seed, content, 40, tallies);
  return perkRows(content, tallies, false);
}

/** Fights per item: options.perItem (measured rounds), else fights / items; always even (both orientations). */
function perItemOf(options: BalanceOptions, items: number): number {
  const n = options.perItem ?? Math.floor(options.fights / Math.max(1, items) / 2);
  return Math.max(2, n - (n % 2));
}

/** A random lineup with one of `classIds` at a random slot (keeps the front-row rule when it can). */
function lineupWith(rng: Rng, content: ContentDB, classIds: readonly string[]): { lineup: string[]; slot: number } {
  for (let tries = 0; tries < 20; tries++) {
    const lineup = drawLineup(rng, content);
    const slots = lineup.map((id, i) => (classIds.includes(id) ? i : -1)).filter((i) => i >= 0);
    if (slots.length > 0) return { lineup, slot: rng.pick(slots) };
  }
  const lineup = drawLineup(rng, content);
  const slot = rng.int(0, 4);
  lineup[slot] = rng.pick(classIds);
  return { lineup, slot };
}

/** One side of a counterfactual matchup. */
interface Arm {
  specs: FighterSpec[];
  cap: number;
  skills: Skills[];
  freshness?: number[];
  entered?: boolean[];
}

/**
 * Counterfactual pairs: a matchup A vs B (different random lineups) is played
 * in both orientations with one round seed, once as is and once with A
 * changed (a perk, a rank, Freshness). The lift is the change in A's wins.
 * Mirror lineups are avoided on purpose: between identical sides any edge,
 * however small (one tick of swing timing, one point of Power), decides most
 * fights, so a 0.2% penalty measured 33% instead of ~49% (WP-A, 2026-10-26).
 */
function versus(col: Collector, content: ContentDB, a: Arm, b: Arm, roundSeed: Seed, record?: RecordLevel): { winsA: number; procsA: Record<string, number>[] } {
  let winsA = 0;
  const procsA: Record<string, number>[] = [];
  for (let swap = 0; swap < 2; swap++) {
    const aHome = swap === 0;
    const [h, w] = aHome ? [a, b] : [b, a];
    const r = col.play({
      home: withRoundFields(sideInput(content, 'home', h.specs, h.cap, (h.cap + 1) % 5), h.skills, h.freshness, h.entered),
      away: withRoundFields(sideInput(content, 'away', w.specs, w.cap, (w.cap + 1) % 5), w.skills, w.freshness, w.entered),
      homeSpecs: h.specs,
      awaySpecs: w.specs,
      roundSeed,
      roundApi: true,
      styleOf: defaultStyle(content),
      ...(record ? { record } : {}),
    });
    if (r.winner === (aHome ? 'home' : 'away')) winsA++;
    if (r.procs) procsA.push(...(aHome ? r.procs.slice(0, 5) : r.procs.slice(5, 10)));
  }
  return { winsA, procsA };
}

/** Paired lift: per matchup d = (wins changed - wins as is) / 2; mean and 95% CI (normal), in points. */
function pairedLift(dSum: number, dSq: number, n: number): { liftPts: number; ciLowPts: number; ciHighPts: number } {
  if (n === 0) return { liftPts: 0, ciLowPts: 0, ciHighPts: 0 };
  const m = dSum / n;
  const variance = n > 1 ? Math.max(0, (dSq - n * m * m) / (n - 1)) : 0.25;
  const half = 1.96 * Math.sqrt(variance / n);
  return { liftPts: m * 100, ciLowPts: (m - half) * 100, ciHighPts: (m + half) * 100 };
}

function randomArm(rng: Rng, content: ContentDB, lineup: string[], profile: SkillProfile, pick: SkillPick): Arm {
  const specs: FighterSpec[] = lineup.map((classId) => ({ classId }));
  const cap = rng.int(0, 4);
  return { specs, cap, skills: lineupSkills(rng, content, specs, cap, profile, pick) };
}

/** Fatigue level for perks measured Tired (fatigueResist, self_freshness_below). */
const PERK_CONTEXT_FRESHNESS = 40;

/**
 * The situation a perk is measured in, with and without the perk: captain
 * perks on the acting captain, fresh-entry perks on a fighter entering from
 * the reserves, Freshness perks on a Tired fighter (F 40).
 */
function perkContext(perk: PerkDef): { captain: boolean; entered: boolean; freshness: number | null; label: string | null } {
  const passive = JSON.stringify(perk.passive ?? {});
  const captain = (perk.tags as readonly string[]).includes('captain');
  const entered = passive.includes('self_fresh_entry');
  const tired = passive.includes('fatigueResist') || passive.includes('self_freshness_below');
  const label = captain ? 'captain' : entered ? 'fresh entry' : tired ? `F ${PERK_CONTEXT_FRESHNESS}` : null;
  return { captain, entered, freshness: tired ? PERK_CONTEXT_FRESHNESS : null, label };
}

/** perk-impact: per perk, counterfactual pairs with and without the perk on one fighter of side A. */
function perkImpact(options: BalanceOptions, profile: SkillProfile, pick: SkillPick, col: Collector): PerkImpactRow[] {
  const { seed, content } = options;
  const tallies = new Map<string, PerkTally>(content.perks.list.map((p) => [p.id, newPerkTally()]));
  const per = perItemOf(options, content.perks.list.length);
  const fillerOf = (perk: PerkDef): string =>
    content.perks.list.find((q) => q.tier === 1 && q.archetype === 'general' && q.id !== perk.id && !q.exclusiveWith.includes(perk.id) && !perk.exclusiveWith.includes(q.id))!.id;
  for (const perk of content.perks.list) {
    const classIds = content.classes.list.filter((k) => perk.archetype === 'general' || (k.archetypes as readonly string[]).includes(perk.archetype)).map((k) => k.id);
    const t = tallies.get(perk.id)!;
    const cx = perkContext(perk);
    for (let i = 0; i < per / 2; i++) {
      const rng = Rng.create(seed, STREAM.balance, 'perk-impact', perk.id, i);
      const { lineup, slot } = lineupWith(rng, content, classIds);
      const a = randomArm(rng, content, lineup, profile, pick);
      const b = randomArm(rng, content, drawLineup(rng, content), profile, pick);
      // The focus fighter's base perks: the drawn ones without the perk and its partners, or the minimal prerequisites.
      let basePerks = a.skills[slot]!.perkIds.filter((id) => id !== perk.id && !perk.exclusiveWith.includes(id) && !content.perks.require(id).exclusiveWith.includes(perk.id));
      if (basePerks.length >= content.perkRules.perkCap) basePerks = basePerks.slice(0, content.perkRules.perkCap - 1);
      if (!perkEligible(content, lineup[slot]!, perk, basePerks)) {
        basePerks = perk.tier === 1 ? [] : perk.tier === 2 ? [fillerOf(perk)] : [fillerOf(perk), perk.requires.anyPerks[0]!];
      }
      if (!perkEligible(content, lineup[slot]!, perk, basePerks)) throw new Error(`balance: cannot make ${perk.id} eligible for ${lineup[slot]}`);
      const ctxA: Arm = {
        ...a,
        cap: cx.captain ? slot : a.cap,
        ...(cx.freshness === null ? {} : { freshness: a.specs.map((_, j) => (j === slot ? cx.freshness! : 100)) }),
        entered: a.specs.map((_, j) => cx.entered && j === slot),
      };
      const without: Arm = { ...ctxA, skills: a.skills.map((s, j) => (j === slot ? { abilityRanks: s.abilityRanks, perkIds: basePerks } : s)) };
      const withPerk: Arm = { ...ctxA, skills: a.skills.map((s, j) => (j === slot ? { abilityRanks: s.abilityRanks, perkIds: [...basePerks, perk.id] } : s)) };
      const roundSeed = deriveSeed(seed, STREAM.balance, 'perk-impact', perk.id, i);
      const base = versus(col, content, without, b, roundSeed);
      const alt = versus(col, content, withPerk, b, roundSeed, 'summary');
      const d = (alt.winsA - base.winsA) / 2;
      t.rounds += 2;
      t.wins += alt.winsA;
      t.baseWins += base.winsA;
      t.matchups++;
      t.dSum += d;
      t.dSq += d * d;
      for (let k = 0; k < alt.procsA.length; k += 5) t.procs += alt.procsA[k + slot]![perk.id] ?? 0;
    }
  }
  samplePickRates(seed, content, 80, tallies);
  return perkRows(content, tallies, true);
}

/** rank-impact: per rankable ability, counterfactual pairs with one fighter of side A at rank 3 instead of rank 1. */
function rankImpact(options: BalanceOptions, profile: SkillProfile, pick: SkillPick, col: Collector): RankImpactRow[] {
  const { seed, content } = options;
  const rows: RankImpactRow[] = [];
  const items: { classId: string; slot: 'a1' | 'a2' | 'passive'; abilityId: string; family: string }[] = [];
  for (const k of content.classes.list) {
    for (const slot of ['a1', 'a2', 'passive'] as const) {
      const row = content.abilityRanks(k.abilities[slot]);
      if (row && row.rankable) items.push({ classId: k.id, slot, abilityId: k.abilities[slot], family: row.family });
    }
  }
  const per = perItemOf(options, items.length);
  for (const it of items) {
    let wins = 0;
    let baseWins = 0;
    let dSum = 0;
    let dSq = 0;
    let n = 0;
    for (let i = 0; i < per / 2; i++) {
      const rng = Rng.create(seed, STREAM.balance, 'rank-impact', it.abilityId, i);
      const { lineup, slot } = lineupWith(rng, content, [it.classId]);
      const a = randomArm(rng, content, lineup, profile, pick);
      const b = randomArm(rng, content, drawLineup(rng, content), profile, pick);
      const at = (rank: 1 | 3): Arm => ({ ...a, skills: a.skills.map((s, j) => (j === slot ? { abilityRanks: { ...s.abilityRanks, [it.slot]: rank }, perkIds: s.perkIds } : s)) });
      const roundSeed = deriveSeed(seed, STREAM.balance, 'rank-impact', it.abilityId, i);
      const base = versus(col, content, at(1), b, roundSeed);
      const alt = versus(col, content, at(3), b, roundSeed);
      const d = (alt.winsA - base.winsA) / 2;
      wins += alt.winsA;
      baseWins += base.winsA;
      dSum += d;
      dSq += d * d;
      n++;
    }
    const lift = pairedLift(dSum, dSq, n);
    const flags: string[] = [];
    if (lift.liftPts > M11_TARGETS.rankLiftMaxPts) flags.push(`lift +${lift.liftPts.toFixed(1)} points > +6`);
    if (lift.liftPts < M11_TARGETS.rankLiftMinPts) flags.push(`lift ${lift.liftPts >= 0 ? '+' : ''}${lift.liftPts.toFixed(1)} points < +0.5`);
    rows.push({
      abilityId: it.abilityId,
      classId: it.classId,
      slot: it.slot,
      family: it.family,
      rounds: 2 * n,
      wins,
      winRate: round4(wins / Math.max(1, 2 * n)),
      baselineWinRate: round4(baseWins / Math.max(1, 2 * n)),
      liftPts: round2(lift.liftPts),
      ciLowPts: round2(lift.ciLowPts),
      ciHighPts: round2(lift.ciHighPts),
      flags,
    });
  }
  rows.sort((x, y) => y.liftPts - x.liftPts || (x.abilityId < y.abilityId ? -1 : 1));
  return rows;
}

/**
 * fatigue: counterfactual pairs; side A starts at a Freshness profile, then
 * fresh, against the same side B. The tired side's win rate is 50% plus the
 * paired change (A and B are exchangeable random lineups, so A fresh wins 50%
 * in expectation); the raw rates are reported beside it.
 */
function fatigue(options: BalanceOptions, profile: SkillProfile, pick: SkillPick, col: Collector): FatigueRow[] {
  const { seed, fights, content } = options;
  const perProfile = Math.floor(fights / FATIGUE_PROFILES.length / 2);
  const per = Math.max(2, perProfile - (perProfile % 2));
  const rows: FatigueRow[] = [];
  for (const fp of FATIGUE_PROFILES) {
    let wins = 0;
    let baseWins = 0;
    let dSum = 0;
    let dSq = 0;
    let n = 0;
    for (let i = 0; i < per / 2; i++) {
      const rng = Rng.create(seed, STREAM.balance, 'fatigue', fp.id, i);
      const a = randomArm(rng, content, drawLineup(rng, content), profile, pick);
      const b = randomArm(rng, content, drawLineup(rng, content), profile, pick);
      const one = rng.int(0, 4);
      const tired: Arm = { ...a, freshness: a.specs.map((_, j) => (fp.count === 5 || j === one ? fp.freshness : 100)) };
      const roundSeed = deriveSeed(seed, STREAM.balance, 'fatigue', fp.id, i);
      const base = versus(col, content, a, b, roundSeed);
      const alt = versus(col, content, tired, b, roundSeed);
      const d = (alt.winsA - base.winsA) / 2;
      wins += alt.winsA;
      baseWins += base.winsA;
      dSum += d;
      dSq += d * d;
      n++;
    }
    const lift = pairedLift(dSum, dSq, n);
    const winRate = 0.5 + lift.liftPts / 100;
    rows.push({
      id: fp.id,
      label: fp.label,
      rounds: 2 * n,
      wins,
      winRate: round4(winRate),
      ciLow: round4(0.5 + lift.ciLowPts / 100),
      ciHigh: round4(0.5 + lift.ciHighPts / 100),
      rawWinRate: round4(wins / Math.max(1, 2 * n)),
      freshWinRate: round4(baseWins / Math.max(1, 2 * n)),
      target: { ...fp.target },
      inTarget: winRate >= fp.target.min && winRate <= fp.target.max,
    });
  }
  return rows;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function round4(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
