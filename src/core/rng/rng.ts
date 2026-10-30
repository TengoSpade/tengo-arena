import { cyrb128, u32Hex } from '../util';

/**
 * Seeded, deterministic PRNG with named substreams.
 *
 * Algorithm: sfc32 (Chris Doty-Humphrey's Small Fast Counting generator,
 * 128-bit state, passes PractRand), seeded by hashing a derivation key with
 * cyrb128. 32-bit integer math only, so sequences are identical on every JS
 * engine. Do NOT change the algorithm, the key encoding or the warm-up count:
 * replays and save reproducibility depend on them (a change requires an
 * ENGINE_VERSION bump and a decision recorded in docs/design 05).
 *
 * Substreams: every stream has a derivation key = root seed + an ordered path
 * of labels. `Rng.create(seed, 'match', 'fx-12')` and
 * `Rng.create(seed).derive('match').derive('fx-12')` are the same stream.
 * Deriving does not consume or depend on the parent's draws, so adding a
 * random call in one system never shifts the numbers another system sees.
 */

/** A root seed: any non-empty string up to 128 chars without control char U+001F. Canonical generated form is 16 lowercase hex chars. */
export type Seed = string;

/** One step of a derivation path. Numbers must be safe integers; a number label equals its String() form (1 and "1" are the same label). */
export type RngLabel = string | number;

/** Serializable snapshot of a stream, for persisting a stream mid-sequence (e.g. sim checkpoints). */
export interface RngState {
  readonly key: string;
  readonly s: readonly [number, number, number, number];
  readonly draws: number;
}

const SEP = '\u001f';
const WARMUP = 12;
const U32 = 4294967296;
const INV_SQRT_ONE_THIRD = 1 / Math.sqrt(1 / 3);

export function isValidSeed(seed: unknown): seed is Seed {
  return typeof seed === 'string' && seed.length > 0 && seed.length <= 128 && !seed.includes(SEP);
}

function labelToString(label: RngLabel): string {
  if (typeof label === 'number') {
    if (!Number.isSafeInteger(label)) throw new RangeError(`RNG label must be a safe integer, got ${label}`);
    return String(label);
  }
  if (typeof label !== 'string' || label.length === 0 || label.includes(SEP)) {
    throw new RangeError(`RNG label must be a non-empty string without U+001F, got ${JSON.stringify(label)}`);
  }
  return label;
}

function keyFor(seed: Seed, labels: readonly RngLabel[]): string {
  if (!isValidSeed(seed)) throw new RangeError(`Invalid seed ${JSON.stringify(seed)}`);
  let key = seed;
  for (const label of labels) key += SEP + labelToString(label);
  return key;
}

/**
 * Derive a short, loggable child seed (16 hex chars) from a seed and a path.
 * A derived seed is a new root: `Rng.create(deriveSeed(s, 'x'))` is NOT the
 * same stream as `Rng.create(s, 'x')`. Use it where a seed is logged, e.g.
 * the match seed stored in MatchResult so a fight can be reproduced without
 * knowing the game's root seed.
 */
export function deriveSeed(seed: Seed, ...labels: RngLabel[]): Seed {
  const [a, b] = cyrb128(`seed${SEP}${keyFor(seed, labels)}`);
  return u32Hex(a) + u32Hex(b);
}

/**
 * Build a root seed from external entropy (the UI passes words from
 * crypto.getRandomValues; tests pass constants). Core never gathers entropy itself.
 */
export function seedFromEntropy(words: readonly number[]): Seed {
  if (words.length < 2) throw new RangeError('seedFromEntropy needs at least 2 words');
  const [a, b] = cyrb128(`entropy${SEP}${words.map((w) => (w >>> 0).toString(16)).join(SEP)}`);
  return u32Hex(a) + u32Hex(b);
}

export class Rng {
  /** Derivation key (seed and labels joined by U+001F). Use `path` for display. */
  readonly key: string;
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  private n: number;

  private constructor(key: string, s: readonly [number, number, number, number], draws: number) {
    this.key = key;
    this.a = s[0] | 0;
    this.b = s[1] | 0;
    this.c = s[2] | 0;
    this.d = s[3] | 0;
    this.n = draws;
  }

  /** Create the stream for `seed` + `path`. */
  static create(seed: Seed, ...path: RngLabel[]): Rng {
    return Rng.fromKey(keyFor(seed, path));
  }

  /** Restore a stream from getState(). */
  static fromState(state: RngState): Rng {
    const { key, s, draws } = state;
    if (typeof key !== 'string' || key.length === 0) throw new RangeError('RngState.key must be a non-empty string');
    if (!Array.isArray(s) || s.length !== 4 || !s.every((w) => Number.isInteger(w))) {
      throw new RangeError('RngState.s must be four integers');
    }
    if (!Number.isSafeInteger(draws) || draws < 0) throw new RangeError('RngState.draws must be a non-negative integer');
    return new Rng(key, s, draws);
  }

  private static fromKey(key: string): Rng {
    const rng = new Rng(key, cyrb128(`rng${SEP}${key}`), 0);
    for (let i = 0; i < WARMUP; i++) rng.step();
    rng.n = 0;
    return rng;
  }

  /** Child stream for `key + labels`. Independent of this stream's draws. */
  derive(...labels: RngLabel[]): Rng {
    if (labels.length === 0) throw new RangeError('derive() needs at least one label');
    let key = this.key;
    for (const label of labels) key += SEP + labelToString(label);
    return Rng.fromKey(key);
  }

  /** Human-readable derivation path, e.g. "a1b2c3d4e5f60718/match/fx-12". */
  get path(): string {
    return this.key.split(SEP).join('/');
  }

  /** Number of 32-bit draws consumed so far (diagnostics). */
  get draws(): number {
    return this.n;
  }

  getState(): RngState {
    return { key: this.key, s: [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0], draws: this.n };
  }

  private step(): number {
    let a = this.a;
    let b = this.b;
    let c = this.c;
    let d = this.d;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    return t >>> 0;
  }

  /** Uniform unsigned 32-bit integer. Every other method is built on this. */
  nextU32(): number {
    this.n++;
    return this.step();
  }

  /** Uniform float in [0, 1). */
  float(): number {
    return this.nextU32() / U32;
  }

  /** Uniform integer in [min, max], both inclusive. Unbiased (rejection sampling). Always consumes at least one draw. */
  int(min: number, max: number): number {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
      throw new RangeError(`int(): bounds must be safe integers, got ${min}, ${max}`);
    }
    if (min > max) throw new RangeError(`int(): min ${min} > max ${max}`);
    const span = max - min + 1;
    if (span > U32) throw new RangeError(`int(): range too large (${span})`);
    const limit = U32 - (U32 % span);
    let x = this.nextU32();
    while (x >= limit) x = this.nextU32();
    return min + (x % span);
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      throw new RangeError(`range(): invalid bounds ${min}, ${max}`);
    }
    return min + (max - min) * this.float();
  }

  /** True with probability p (clamped to [0, 1]). Always consumes exactly one draw, so tuning p never shifts later draws. */
  chance(p: number): boolean {
    if (Number.isNaN(p)) throw new RangeError('chance(): p is NaN');
    return this.float() < p;
  }

  /**
   * True with probability bp / 10,000. Probabilities in rules and content are
   * integer basis points (03 §1), so this is the preferred chance roll in the
   * sim. Consumes at least one draw.
   */
  chanceBp(bp: number): boolean {
    if (!Number.isInteger(bp)) throw new RangeError(`chanceBp(): basis points must be an integer, got ${bp}`);
    return this.int(0, 9999) < bp;
  }

  /** Uniformly chosen element. Throws on an empty list. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick(): empty list');
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Index chosen with probability proportional to its weight. Zero weights are never chosen. */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    let lastPositive = -1;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] as number;
      if (!Number.isFinite(w) || w < 0) throw new RangeError(`weightedIndex(): invalid weight ${w} at ${i}`);
      if (w > 0) {
        total += w;
        lastPositive = i;
      }
    }
    if (lastPositive < 0) throw new RangeError('weightedIndex(): no positive weight');
    let x = this.float() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] as number;
      if (w <= 0) continue;
      if (x < w) return i;
      x -= w;
    }
    return lastPositive; // floating-point remainder
  }

  /** Element chosen with probability proportional to weightOf(item). */
  weighted<T>(items: readonly T[], weightOf: (item: T, index: number) => number): T {
    return items[this.weightedIndex(items.map(weightOf))] as T;
  }

  /** Shuffled copy (Fisher-Yates). The input is not modified. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  /**
   * Bell-shaped value with the given mean and standard deviation, using the
   * Irwin-Hall sum of 4 uniforms (no transcendental math). Tails are bounded
   * to about +-3.46 sd, which suits games: no absurd outliers. Consumes 4 draws.
   */
  normalish(mean: number, sd: number): number {
    const s = this.float() + this.float() + this.float() + this.float();
    return mean + (s - 2) * INV_SQRT_ONE_THIRD * sd;
  }
}
