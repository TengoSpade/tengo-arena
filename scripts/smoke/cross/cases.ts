/**
 * The cross-runtime determinism cases (05-technical-m2 §A11 "Cross-runtime", 05 §10 "golden hash in Node and
 * Chromium"): fixed rounds of content/default simulated at record level `full`, reduced to the numbers that must be
 * identical in Node and in the browser (round checksum, the sim's own incremental event hash, and the hash recomputed
 * over the finished log). Runs in both runtimes from this one module; the browser gets it through cross/entry.ts.
 */
import type { ContentDB } from '../../../src/core/content';
import { hashEventStream } from '../../../src/core/model';
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
  /** Wall time of simulateRound at `full`, ms (informational; not compared). */
  simMs: number;
}

export interface CrossRun {
  engineVersion: number;
  contentHash: string;
  results: CrossResult[];
}

export function runCrossCases(content: ContentDB, now: () => number = () => globalThis.performance.now()): CrossRun {
  const results: CrossResult[] = [];
  for (const c of CROSS_CASES) {
    const input = { round: c.round, home: sideInput(content, 'home', c.home, 0, 1), away: sideInput(content, 'away', c.away, 1, 0) };
    const t0 = now();
    const out = simulateRound(input, c.seed, content, { record: 'full' });
    const simMs = now() - t0;
    const log = out.log!;
    results.push({
      id: c.id,
      winner: out.result.winner,
      durationTicks: out.result.durationTicks,
      checksum: out.result.checksum,
      hash: log.hash,
      recomputedHash: hashEventStream(log.header, log.events),
      events: log.events.length,
      simMs,
    });
  }
  return { engineVersion: ENGINE_VERSION, contentHash: content.ref.hash, results };
}

/** What must be equal between two runs of the cases (everything but timings). */
export function compareCrossRuns(node: CrossRun, browser: CrossRun): { equal: boolean; differences: string[] } {
  const differences: string[] = [];
  if (node.engineVersion !== browser.engineVersion) differences.push(`engine version ${node.engineVersion} vs ${browser.engineVersion}`);
  if (node.contentHash !== browser.contentHash) differences.push(`content hash ${node.contentHash} vs ${browser.contentHash}`);
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
