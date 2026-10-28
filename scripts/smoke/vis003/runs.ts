/**
 * Finding the vis-003 folder of a run. `latest` means the newest run made from the real game: a self-test on the mock arena
 * writes the same files from a stand-in arena and must never be picked up as if it were the fights of the game.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Vis003Source } from './packet';

/** The `source` the capture wrote in manifest.json ('game' or 'mock'); 'unknown' for a folder without a readable manifest. */
export function visSourceOf(visDir: string): Vis003Source | 'unknown' {
  try {
    const m = JSON.parse(readFileSync(join(visDir, 'manifest.json'), 'utf8')) as { source?: unknown };
    return m.source === 'mock' ? 'mock' : m.source === 'game' ? 'game' : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Every run folder under the reports folder that has a vis003 folder, oldest first (run ids sort by time). */
export function visRuns(reportsDir: string): { name: string; visDir: string; source: Vis003Source | 'unknown' }[] {
  if (!existsSync(reportsDir)) return [];
  return readdirSync(reportsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(reportsDir, d.name, 'vis003', 'keys')))
    .map((d) => ({ name: d.name, visDir: join(reportsDir, d.name, 'vis003'), source: visSourceOf(join(reportsDir, d.name, 'vis003')) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The newest vis003 folder that is not from a self-test, or null. */
export function latestRealVisDir(reportsDir: string): string | null {
  const real = visRuns(reportsDir).filter((r) => r.source !== 'mock');
  return real.length ? real[real.length - 1]!.visDir : null;
}
