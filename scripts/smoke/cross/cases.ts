/**
 * The cross-runtime determinism cases (05-technical-m2 §A11 "Cross-runtime", 05 §10 "golden hash in Node and
 * Chromium"): fixed rounds of content/default simulated at record level `full`, reduced to the numbers that must be
 * identical in Node and in the browser (round checksum, the sim's own incremental event hash, and the hash recomputed
 * over the finished log). The same passes time the round load (the sim at full plus indexFightLog, A10). Runs in both runtimes from this one module; the browser gets it through cross/entry.ts.
 */
import type { ContentDB } from '../../../src/core/content';
import { hashEventStream } from '../../../src/core/model';
import { NotImplementedError } from '../../../src/core/util';
import { buildCueTable, indexFightLog } from '../../../src/render';
import { ENGINE_VERSION, sideInput, simulateRound } from '../../../src/core/sim';

export interface CrossCase {
  id: string;
  /** Round seed (the sim's input; the cases do not go through a match). */
  seed: string;
  round: number;
  home: readonly string[];
  away: readonly string[];
}

/** Class ids of content/default. Every archetype, hybrids, mirror matches and lopsided ones. */
export const CROSS_CASES: readonly CrossCase[] = [
  { id: 'core-vs-core', seed: 'smoke-cross-1', round: 1, home: ['oathguard', 'gutterknife', 'longeye', 'rimebinder', 'chirurgeon'], away: ['siegebreaker', 'oathguard', 'longeye', 'chirurgeon', 'rimebinder'] },
  { id: 'mirror', seed: 'smoke-cross-2', round: 2, home: ['gongbearer', 'bladeturner', 'boltrunner', 'hexmonger', 'cantor'], away: ['gongbearer', 'bladeturner', 'boltrunner', 'hexmonger', 'cantor'] },
  { id: 'hybrids', seed: 'smoke-cross-3', round: 1, home: ['phalanx_sergeant', 'twinfang', 'emberwright', 'galeshaper', 'aegis_scribe'], away: ['vowknight', 'leechblade', 'harpooner', 'hushweaver', 'war_drummer'] },
  { id: 'casters', seed: 'smoke-cross-4', round: 3, home: ['blightbrewer', 'thunderhand', 'dreamthief', 'snaresetter', 'grovetender'], away: ['scarhide', 'headsman', 'writ_hunter', 'undertow_mystic', 'vigilkeeper'] },
  { id: 'bruisers', seed: 'smoke-cross-5', round: 1, home: ['briarback', 'bloodhowler', 'chaffcutter', 'runecleaver', 'sunlance_acolyte'], away: ['pavisier', 'gaoler', 'netcaster', 'skullslinger', 'hourglass_sage'] },
  { id: 'late-round', seed: 'smoke-cross-6', round: 5, home: ['deeproot_keeper', 'oathguard', 'skullslinger', 'hexmonger', 'chirurgeon'], away: ['gongbearer', 'twinfang', 'longeye', 'hushweaver', 'cantor'] },
];

export interface CrossResult {
  id: string;
  winner: string;
  durationTicks: number;
  checksum: string;
  /** The sim's incremental hash of the full log (FightLog.hash). */
  hash: string;
  /** hashEventStream(header, events) recomputed over the finished log: what the viewer recomputes. */
  recomputedHash: string;
  events: number;
}

/** Round-load timings (A10 "round load": the sim at `full` plus indexFightLog), in ms. Informational for the equality check. */
export interface CrossTimings {
  /** Passes over the six cases: pass 0 is cold (first use of the code), the rest warm. */
  passes: number;
  /** Cold pass, per case. */
  coldSimMs: number[];
  coldIndexMs: number[] | null;
  /** Warm passes: simulateRound alone, indexFightLog alone and their sum, per case and pass. */
  simMs: number[];
  indexMs: number[] | null;
  loadMs: number[] | null;
  /** Why indexFightLog could not be timed (the render model is not implemented yet), or null. */
  indexProblem: string | null;
}

export interface CrossRun {
  engineVersion: number;
  contentHash: string;
  results: CrossResult[];
  timings: CrossTimings;
  /** Warm passes whose hash or checksum differed from the first pass (a determinism defect inside one runtime). */
  repeatMismatches: number;
}

export function runCrossCases(content: ContentDB, now: () => number = () => globalThis.performance.now(), passes = 5): CrossRun {
  const results: CrossResult[] = [];
  const cold = { sim: [] as number[], index: [] as number[] };
  const warm = { sim: [] as number[], index: [] as number[], load: [] as number[] };
  let indexProblem: string | null = null;
  let cues: ReturnType<typeof buildCueTable> | null = null;
  try {
    cues = buildCueTable(content);
  } catch (e) {
    if (!(e instanceof NotImplementedError)) throw e;
    indexProblem = e.message;
  }
  let repeatMismatches = 0;
  for (let pass = 0; pass < Math.max(1, passes); pass++) {
    CROSS_CASES.forEach((c, i) => {
      const input = { round: c.round, home: sideInput(content, 'home', c.home, 0, 1), away: sideInput(content, 'away', c.away, 1, 0) };
      const t0 = now();
      const out = simulateRound(input, c.seed, content, { record: 'full' });
      const simMs = now() - t0;
      const log = out.log!;
      let indexMs: number | null = null;
      if (cues) {
        const t1 = now();
        try {
          indexFightLog(log, content, cues, 'replay');
          indexMs = now() - t1;
        } catch (e) {
          if (!(e instanceof NotImplementedError)) throw e;
          indexProblem = e.message;
          cues = null;
        }
      }
      if (pass === 0) {
        results.push({
          id: c.id,
          winner: out.result.winner,
          durationTicks: out.result.durationTicks,
          checksum: out.result.checksum,
          hash: log.hash,
          recomputedHash: hashEventStream(log.header, log.events),
          events: log.events.length,
        });
        cold.sim.push(simMs);
        if (indexMs !== null) cold.index.push(indexMs);
      } else {
        if (log.hash !== results[i]!.hash || out.result.checksum !== results[i]!.checksum) repeatMismatches++;
        warm.sim.push(simMs);
        if (indexMs !== null) {
          warm.index.push(indexMs);
          warm.load.push(simMs + indexMs);
        }
      }
    });
  }
  const timed = indexProblem === null && warm.load.length > 0;
  return {
    engineVersion: ENGINE_VERSION,
    contentHash: content.ref.hash,
    results,
    repeatMismatches,
    timings: {
      passes: Math.max(1, passes),
      coldSimMs: cold.sim,
      coldIndexMs: timed ? cold.index : null,
      simMs: warm.sim,
      indexMs: timed ? warm.index : null,
      loadMs: timed ? warm.load : null,
      indexProblem,
    },
  };
}

/** What must be equal between two runs of the cases (everything but timings). */
export function compareCrossRuns(node: CrossRun, browser: CrossRun): { equal: boolean; differences: string[] } {
  const differences: string[] = [];
  if (node.engineVersion !== browser.engineVersion) differences.push(`engine version ${node.engineVersion} vs ${browser.engineVersion}`);
  if (node.contentHash !== browser.contentHash) differences.push(`content hash ${node.contentHash} vs ${browser.contentHash}`);
  if (node.repeatMismatches > 0) differences.push(`in Node ${node.repeatMismatches} repeated simulations differed from the first`);
  if (browser.repeatMismatches > 0) differences.push(`in the browser ${browser.repeatMismatches} repeated simulations differed from the first`);
  if (node.results.length !== browser.results.length) differences.push(`${node.results.length} cases in Node, ${browser.results.length} in the browser`);
  for (const a of node.results) {
    const b = browser.results.find((r) => r.id === a.id);
    if (!b) {
      differences.push(`${a.id}: missing in the browser`);
      continue;
    }
    for (const key of ['winner', 'durationTicks', 'checksum', 'hash', 'recomputedHash', 'events'] as const) {
      if (a[key] !== b[key]) differences.push(`${a.id}: ${key} ${String(a[key])} (Node) vs ${String(b[key])} (browser)`);
    }
    if (a.hash !== a.recomputedHash) differences.push(`${a.id}: in Node the incremental hash ${a.hash} differs from the recomputed ${a.recomputedHash}`);
    if (b.hash !== b.recomputedHash) differences.push(`${a.id}: in the browser the incremental hash ${b.hash} differs from the recomputed ${b.recomputedHash}`);
  }
  return { equal: differences.length === 0, differences };
}
