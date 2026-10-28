/**
 * Journey: the same fixed rounds, simulated at `full` in Node and in the browser, must give identical checksums and
 * event hashes (05 §10 "golden hash in Node and Chromium"; vis-009). It needs no viewer: it bundles core/sim for the
 * browser and runs it on a blank page.
 */
import { join } from 'node:path';
import { loadThemeOrExit } from '../../lib/cli-content';
import { REPO_ROOT } from '../../lib/node-content';
import { bundleIife } from '../lib/bundle';
import { compareCrossRuns, runCrossCases, type CrossRun } from '../cross/cases';
import { checkRoundLoad } from '../lib/checks';
import { PageDriver } from '../lib/page';
import type { JourneyEnv } from './env';

export interface CrossOutcome {
  node: CrossRun;
  browser: CrossRun;
  equal: boolean;
  differences: string[];
  bundleMs: number;
}

export async function runCrossHash(page: PageDriver): Promise<CrossOutcome> {
  const content = loadThemeOrExit('default');
  const t0 = Date.now();
  const code = await bundleIife(REPO_ROOT, join(REPO_ROOT, 'scripts', 'smoke', 'cross', 'entry.ts'), '__smokeCrossBundle');
  const bundleMs = Date.now() - t0;
  await page.eval(code);
  const browser = await page.eval<CrossRun>('window.__smokeCross.run()', 120_000);
  const node = runCrossCases(content);
  const cmp = compareCrossRuns(node, browser);
  return {
    node,
    browser,
    equal: cmp.equal,
    differences: cmp.differences,
    bundleMs,
  };
}

/** The journey: Chromium's `full` hashes against Node's, plus the sim time in the browser. */
export async function runCrossJourney(env: JourneyEnv): Promise<void> {
  const { rec } = env;
  await rec.journey('cross-runtime', async () => {
    const page = await PageDriver.open(env.client, { width: 800, height: 600 });
    try {
      const out = await rec.step('cross.run', 'Simulate six fixed rounds at full in Node and in the browser, compare hashes', () => runCrossHash(page));
      rec.measurements['hash.cross'] = { equal: out.equal, differences: out.differences, engineVersion: out.node.engineVersion, contentHash: out.node.contentHash, rounds: out.node.results.map((r) => ({ id: r.id, checksum: r.checksum, hash: r.hash, events: r.events })) };
      rec.measurements['perf.roundLoad'] = { browser: out.browser.timings, node: out.node.timings };
      rec.check({
        id: 'hash.chromium-eq-node',
        title: 'A round hashes the same in Chromium and in Node',
        status: out.equal ? 'pass' : 'fail',
        ref: 'A11 Cross-runtime, 05 §10',
        expected: 'identical round checksums and event hashes for six fixed rounds of content/default, and for every repeat of them',
        actual: out.equal ? `${out.node.results.length} rounds identical (engine ${out.node.engineVersion}, content ${out.node.contentHash.slice(0, 8)}), ${out.browser.timings.passes} passes each` : out.differences.slice(0, 3).join('; '),
        ...(out.equal ? {} : { detail: 'The same code gave different results in two JavaScript engines (or twice in one): a determinism defect (vis-009, pillar 4).' }),
      });
      rec.check(checkRoundLoad(out.browser.timings, 'Chromium'));
    } finally {
      env.collectConsole(page);
      await page.close();
    }
  });
}
