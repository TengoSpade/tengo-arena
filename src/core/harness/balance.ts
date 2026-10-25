import type { ContentDB } from '../content';
import type { FighterMatchStats, RecordLevel, RoundTiebreakStep } from '../model';
import { Rng, STREAM, deriveSeed, type Seed } from '../rng';
import { simulateFight, sideInput, type FighterSpec } from '../sim';
import { byNumber, byString, chain } from '../util';

/**
 * Headless balance harness: many seeded fights -> per-class win rates (V1,
 * vis-002; 03-combat §8 "Balance harness specification"). Owner: WP1.
 * CONTRACT: options and report shape fixed (additive changes allowed).
 *
 * Pure: no clock of its own (the CLI may pass one for timings), no IO.
 * Every "fight" is one round (simulateFight). Lineups are drawn from the
 * `balance` stream; each pair of lineups plays twice with the same round seed
 * and sides swapped (mirroring), so side advantage cancels out.
 */
export type BalanceMode =
  /** Random 5v5 drafts from all classes; win rate per class appearance. */
  | 'random-draft'
  /** Each class's default preset against the same class (sanity: ~50%). */
  | 'mirror'
  /** vis-002: tailored presets versus default presets at equal rating. */
  | 'preset-vs-default';

export interface BalanceOptions {
  seed: Seed;
  fights: number;
  content: ContentDB;
  mode?: BalanceMode;
  /** Additive: a millisecond clock for per-fight timings (the CLI passes performance.now). */
  clock?: () => number;
  /** Additive: record level of the timed fights (default 'none'; 'full' for the 3x budget check). */
  record?: RecordLevel;
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

export interface BalanceReport {
  kind: 'balance';
  stub: boolean;
  mode: BalanceMode;
  seed: Seed;
  fights: number;
  contentHash: string;
  classes: ClassBalanceRow[];
  /** Classes outside the target band (docs/design 05 §10). */
  outliers: string[];
  targetBand: { min: number; max: number };
  /** Additive: pure archetypes plus 'hybrid', by fighter-round. */
  archetypes?: GroupBalanceRow[];
  archetypeOutliers?: string[];
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
}

/** TUNABLE (tech): M1 first-pass band; M7 target 45-55%. */
export const BALANCE_TARGET_BAND = { min: 0.4, max: 0.6 } as const;

/** 03-combat §8 flag thresholds (PROVISIONAL until combat.json carries them; OPEN request to the combat designer). */
const PROVISIONAL_OVERTIME_MAX = 0.25;
const PROVISIONAL_CAP_MAX = 0.01;
const PROVISIONAL_NEVER_CAST_MAX = 0.5;
const PROVISIONAL_NEVER_FIRED_MAX = 0.8;
const PROVISIONAL_STYLE_MAX = 0.55;
const PROVISIONAL_MEDIAN_MS_MAX = 2;

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

export function runBalance(options: BalanceOptions): BalanceReport {
  const { seed, fights, content } = options;
  const mode = options.mode ?? 'random-draft';
  if (!Number.isSafeInteger(fights) || fights < 0) throw new RangeError(`fights must be a non-negative integer, got ${fights}`);
  const record = options.record ?? 'none';
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
      const home = sideInput(content, 'home', homeSpecs, swap === 0 ? capA : capB);
      const away = sideInput(content, 'away', awaySpecs, swap === 0 ? capB : capA);
      const t0 = options.clock ? options.clock() : 0;
      const out = simulateFight({ seed: roundSeed, round: 1, home, away }, content, { record });
      if (options.clock) times.push(options.clock() - t0);
      const r = out.result;
      durations.push(r.durationTicks);
      if (r.durationTicks > overtimeStart) overtime++;
      if (r.endReason === 'time-limit') capped++;
      if (r.winner === 'home') homeWins++;
      if (r.tiebreakStep) steps[r.tiebreakStep] = (steps[r.tiebreakStep] ?? 0) + 1;
      for (const [side, specs, input] of [
        ['home', homeSpecs, home],
        ['away', awaySpecs, away],
      ] as const) {
        const won = r.winner === side;
        specs.forEach((spec, slot) => {
          const s = out.fighterStats[input.fighters[slot]!.fighterId]!;
          count(classes, spec.classId, won, s);
          count(groups, groupOf(spec.classId), won, null);
          if (mode === 'preset-vs-default') {
            const tailored = specs === specsA;
            const style = tailored ? (content.presets.get(spec.presetId ?? '')?.style ?? 'balanced') : 'default';
            count(styles, tailored ? `tailored:${style}` : 'default', won, null);
          } else {
            count(styles, content.presets.get(content.classes.require(spec.classId).defaultPresetId)?.style ?? 'balanced', won, null);
          }
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
    }
  }

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
  const inBand = (r: number): boolean => r >= BALANCE_TARGET_BAND.min && r <= BALANCE_TARGET_BAND.max;

  const classRows = [...classes.entries()]
    .map(([id, t]) => row(id, t))
    .sort(chain(byNumber((r: ClassBalanceRow) => r.winRate, true), byString((r: ClassBalanceRow) => r.classId)));
  const outliers = classRows.filter((r) => r.appearances > 0 && !inBand(r.winRate)).map((r) => r.classId);
  const archetypes = [...groups.entries()].map(([id, t]) => groupRow(id, t)).sort(byString((r: GroupBalanceRow) => r.id));
  const archetypeOutliers = archetypes.filter((r) => r.appearances > 0 && !inBand(r.winRate)).map((r) => r.id);
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
  if (options.clock && times.length > 0) {
    const ts = [...times].sort((x, y) => x - y);
    timing = {
      record,
      medianMs: round4(ts[Math.floor(ts.length / 2)]!),
      p99Ms: round4(ts[Math.min(ts.length - 1, Math.floor(ts.length * 0.99))]!),
      meanMs: round4(ts.reduce((s, x) => s + x, 0) / ts.length),
      maxMs: round4(ts[ts.length - 1]!),
    };
  }

  const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
  const flags: string[] = [];
  for (const r of classRows) if (r.appearances > 0 && !inBand(r.winRate)) flags.push(`class ${r.classId} win rate ${pct(r.winRate)}`);
  for (const r of archetypes) if (r.appearances > 0 && !inBand(r.winRate)) flags.push(`archetype ${r.id} win rate ${pct(r.winRate)}`);
  if (fightLength.overtimeRate > PROVISIONAL_OVERTIME_MAX) flags.push(`overtime rate ${pct(fightLength.overtimeRate)} > 25%`);
  if (fightLength.timeCapRate > PROVISIONAL_CAP_MAX) flags.push(`time-cap rate ${pct(fightLength.timeCapRate)} > 1%`);
  for (const r of styleRows) if (r.id !== 'default' && r.appearances > 0 && r.winRate >= PROVISIONAL_STYLE_MAX) flags.push(`style ${r.id} win rate ${pct(r.winRate)} >= 55%`);
  for (const a of rarelyCastAbilities) flags.push(`ability ${a.abilityId} never cast in ${pct(a.neverCastShare)} of rounds`);
  for (const r of idleRules) flags.push(`rule ${r.presetId}#${r.rule + 1} never fired in ${pct(r.neverFiredShare)} of rounds`);
  if (timing && record === 'none' && timing.medianMs > PROVISIONAL_MEDIAN_MS_MAX) flags.push(`median ${timing.medianMs} ms per round > 2 ms`);

  return {
    kind: 'balance',
    stub: false,
    mode,
    seed,
    fights: played,
    contentHash: content.ref.hash,
    classes: classRows,
    outliers,
    targetBand: { ...BALANCE_TARGET_BAND },
    archetypes,
    archetypeOutliers,
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

function round4(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}
