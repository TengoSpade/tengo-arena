/**
 * The smoke report: its types, the verdict rules, the JSON writer and the markdown renderer. Pure except
 * `writeSmokeReport`. Reports go under reports/smoke/<run id>/ (git-ignored), with `latest.json` and `latest.md`
 * copies one level up.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface CheckResult {
  /** Stable id: `<area>.<name>`, e.g. perf.fps-4x. */
  id: string;
  title: string;
  status: CheckStatus;
  /** Where the requirement comes from, e.g. "A10", "A11 test-first 5", "vis-009". */
  ref?: string;
  expected?: string;
  actual?: string;
  detail?: string;
  /** A skip that is by design (a later step of the protocol), not a piece that is missing: it does not make the verdict blocked. */
  pending?: boolean;
}

/** The run could not go on: something it needs is not there yet (the viewer, the test hook, a route). */
export interface BlockedInfo {
  /** Stable code, e.g. smoke.hook-missing. */
  code: string;
  /** What is missing and which package delivers it. */
  message: string;
  /** The journey step that needed it. */
  step: string;
}

export interface ScreenshotRecord {
  file: string;
  label: string;
  width: number;
  height: number;
  /** viewport / theme / reduced motion / vision-deficiency emulation, tick. */
  tags: Record<string, string | number | boolean>;
}

export interface StepRecord {
  id: string;
  title: string;
  status: 'pass' | 'fail' | 'skip' | 'blocked';
  ms: number;
  detail?: string;
}

export type Verdict = 'pass' | 'fail' | 'blocked';

export interface SmokeReport {
  format: 'arena-league-smoke';
  version: 1;
  /** Local run id, e.g. 20261028-101530. */
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  verdict: Verdict;
  /** Check counts by status. */
  counts: Record<CheckStatus, number>;
  /** Pieces other work packages deliver that the run needed and did not find (the run goes on with what it can). */
  blocked: BlockedInfo[];
  build: { mode: string; commit: string; dirty: boolean; url: string; buildMs: number | null; source: 'built' | 'url' | 'mock' };
  browser: { product: string; userAgent: string; exe: string; gpuMode: string; gpuRenderer: string | null; softwareGl: boolean | null };
  host: { platform: string; cpus: number; memoryGb: number; node: string };
  options: Record<string, string | number | boolean>;
  steps: StepRecord[];
  checks: CheckResult[];
  /** Raw numbers behind the checks: fps summaries, the cursor-save trace analysis, heap samples, hashes. */
  measurements: Record<string, unknown>;
  screenshots: ScreenshotRecord[];
  consoleErrors: { source: string; text: string; url?: string }[];
  consoleWarnings: number;
  /** Files written next to the report (traces, packets), relative to the run folder. */
  artifacts: string[];
}

export function countChecks(checks: readonly CheckResult[]): Record<CheckStatus, number> {
  const counts: Record<CheckStatus, number> = { pass: 0, fail: 0, warn: 0, skip: 0 };
  for (const c of checks) counts[c.status]++;
  return counts;
}

/** Checks that were not made although they were wanted: a skip that is not marked as pending by design. */
export function unmadeChecks(checks: readonly CheckResult[]): CheckResult[] {
  return checks.filter((c) => c.status === 'skip' && !c.pending);
}

/**
 * fail if any check failed; else blocked when a piece is missing or a wanted check could not be made (a silent skip is
 * never a pass); else pass (warnings do not fail).
 */
export function verdictOf(checks: readonly CheckResult[], blocked: readonly BlockedInfo[]): Verdict {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (blocked.length > 0 || unmadeChecks(checks).length > 0) return 'blocked';
  return 'pass';
}

/** Process exit code: 0 pass, 1 a check failed, 3 blocked (the viewer or its test hook is not there yet). */
export function exitCodeOf(verdict: Verdict): number {
  return verdict === 'pass' ? 0 : verdict === 'fail' ? 1 : 3;
}

const ICON: Record<CheckStatus, string> = { pass: 'PASS', fail: 'FAIL', warn: 'WARN', skip: 'SKIP' };

function esc(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function renderMarkdown(r: SmokeReport): string {
  const lines: string[] = [];
  lines.push(`# Arena smoke report ${r.runId}`);
  lines.push('');
  if (r.build.source === 'mock') {
    lines.push('> **SELF-TEST on the mock arena.** This run tests the smoke driver, not the game: none of it says anything about the arena viewer.');
    lines.push('');
  }
  lines.push(`**Verdict: ${r.verdict.toUpperCase()}** (${r.counts.pass} pass, ${r.counts.fail} fail, ${r.counts.warn} warn, ${r.counts.skip} skipped) in ${(r.durationMs / 1000).toFixed(1)} s`);
  lines.push('');
  const unmade = unmadeChecks(r.checks);
  if (r.blocked.length > 0 || unmade.length > 0) {
    lines.push('## Blocked');
    lines.push('');
    lines.push('The run needed pieces that are not in this build yet, or could not make some checks; everything else ran.');
    lines.push('');
    for (const b of r.blocked) lines.push(`- Step \`${b.step}\`: **${b.code}**. ${b.message.replace(/\r?\n/g, ' ')}`);
    for (const c of unmade) lines.push(`- Check not made, \`${c.id}\`: ${(c.detail ?? c.actual ?? 'no reason given').replace(/\r?\n/g, ' ')}`);
    lines.push('');
  }
  lines.push('## Setup');
  lines.push('');
  lines.push(`- Build: mode \`${r.build.mode}\` at ${r.build.commit}${r.build.dirty ? ' (uncommitted changes)' : ''}, ${r.build.source}${r.build.buildMs !== null ? `, built in ${(r.build.buildMs / 1000).toFixed(1)} s` : ''}, served at ${r.build.url}`);
  lines.push(`- Browser: ${r.browser.product} (${r.browser.gpuMode} GPU mode); WebGL renderer: ${r.browser.gpuRenderer ?? 'unknown'}${r.browser.softwareGl ? ' **(software rendering: frame numbers are not the reference machine\'s)**' : ''}`);
  lines.push(`- Host: ${r.host.platform}, ${r.host.cpus} CPUs, ${r.host.memoryGb} GB, Node ${r.host.node}`);
  lines.push('');
  lines.push('## Checks');
  lines.push('');
  lines.push('| Result | Check | Expected | Actual | Ref |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const c of r.checks) lines.push(`| ${ICON[c.status]} | ${esc(c.title)} | ${esc(c.expected ?? '')} | ${esc(c.actual ?? '')} | ${esc(c.ref ?? '')} |`);
  const noted = r.checks.filter((c) => c.detail && c.status !== 'pass');
  if (noted.length) {
    lines.push('');
    lines.push('### Notes on checks');
    lines.push('');
    for (const c of noted) lines.push(`- **${c.id}** (${c.status}): ${c.detail}`);
  }
  lines.push('');
  lines.push('## Steps');
  lines.push('');
  for (const s of r.steps) lines.push(`- ${s.status === 'pass' ? 'ok' : s.status} \`${s.id}\` ${s.title} (${s.ms} ms)${s.detail ? `: ${s.detail}` : ''}`);
  if (r.screenshots.length) {
    lines.push('');
    lines.push('## Screenshots');
    lines.push('');
    for (const s of r.screenshots) lines.push(`- \`${s.file}\` ${s.label} (${s.width}x${s.height})`);
  }
  lines.push('');
  lines.push('## Console');
  lines.push('');
  if (r.consoleErrors.length === 0) lines.push(`No console errors (${r.consoleWarnings} warnings).`);
  else for (const e of r.consoleErrors.slice(0, 30)) lines.push(`- [${e.source}] ${esc(e.text).slice(0, 300)}${e.url ? ` (${e.url})` : ''}`);
  if (r.consoleErrors.length > 30) lines.push(`- ... and ${r.consoleErrors.length - 30} more (see the JSON report)`);
  lines.push('');
  if (r.artifacts.length) {
    lines.push('## Artifacts');
    lines.push('');
    for (const a of r.artifacts) lines.push(`- \`${a}\``);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

/** Write <reportsDir>/<runId>/report.json and report.md, and copy them to <reportsDir>/latest.json and latest.md. */
export function writeSmokeReport(reportsDir: string, report: SmokeReport): { dir: string; json: string; md: string } {
  const dir = join(reportsDir, report.runId);
  mkdirSync(dir, { recursive: true });
  const json = join(dir, 'report.json');
  const md = join(dir, 'report.md');
  writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(md, renderMarkdown(report), 'utf8');
  // A self-test never takes the place of the last real run.
  const latest = report.build.source === 'mock' ? 'latest-selftest' : 'latest';
  copyFileSync(json, join(reportsDir, `${latest}.json`));
  copyFileSync(md, join(reportsDir, `${latest}.md`));
  return { dir, json, md };
}

export function runIdFor(date: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}
