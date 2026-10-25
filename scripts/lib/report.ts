import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { REPO_ROOT } from './node-content';

/** Write a JSON report (default under reports/, which is git-ignored) and return its repo-relative path. */
export function writeReport(outArg: string | undefined, defaultName: string, report: unknown): string {
  const path = outArg ? (isAbsolute(outArg) ? outArg : join(REPO_ROOT, outArg)) : join(REPO_ROOT, 'reports', defaultName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return relative(REPO_ROOT, path).split('\\').join('/');
}
