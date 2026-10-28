import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { countChecks, exitCodeOf, renderMarkdown, runIdFor, verdictOf, writeSmokeReport, type CheckResult, type SmokeReport } from './report';

const pass = (id: string): CheckResult => ({ id, title: `Check ${id}`, status: 'pass' });
const fail = (id: string): CheckResult => ({ id, title: `Check ${id}`, status: 'fail', actual: 'it broke' });
const warn = (id: string): CheckResult => ({ id, title: `Check ${id}`, status: 'warn', detail: 'software GL' });
const skip = (id: string): CheckResult => ({ id, title: `Check ${id}`, status: 'skip' });
const blocked = { code: 'smoke.hook-missing', message: 'window.__arena.viewer is not in this build', step: 'fixture.hook' };

function report(over: Partial<SmokeReport> = {}): SmokeReport {
  const checks = over.checks ?? [pass('a'), warn('b'), skip('c')];
  return {
    format: 'arena-league-smoke',
    version: 1,
    runId: '20261028-101530',
    startedAt: '2026-10-28T10:15:30.000Z',
    finishedAt: '2026-10-28T10:16:30.000Z',
    durationMs: 60_000,
    verdict: verdictOf(checks, over.blocked ?? []),
    counts: countChecks(checks),
    blocked: [],
    build: { mode: 'smoke', commit: 'abc1234', dirty: false, url: 'http://127.0.0.1:4173', buildMs: 4200, source: 'built' },
    browser: { product: 'Edg/156', userAgent: 'ua', exe: 'msedge.exe', gpuMode: 'auto', gpuRenderer: 'ANGLE (NVIDIA)', softwareGl: false },
    host: { platform: 'win32 x64', cpus: 10, memoryGb: 32, node: 'v24' },
    options: { seed: 'arena-smoke-1' },
    steps: [{ id: 's1', title: 'A step', status: 'pass', ms: 12 }],
    checks,
    measurements: { x: 1 },
    screenshots: [{ file: 'shots/a.png', label: 'A shot', width: 1280, height: 720, tags: { theme: 'dark' } }],
    consoleErrors: [],
    consoleWarnings: 0,
    artifacts: ['cursor-save-trace.json'],
    ...over,
  };
}

describe('verdict and exit codes', () => {
  it('pass when nothing failed, warnings and skips included', () => {
    expect(verdictOf([pass('a'), warn('b'), skip('c')], [])).toBe('pass');
    expect(exitCodeOf('pass')).toBe(0);
  });
  it('fail wins over blocked', () => {
    expect(verdictOf([pass('a'), fail('b')], [blocked])).toBe('fail');
    expect(exitCodeOf('fail')).toBe(1);
  });
  it('blocked when something needed is missing and nothing failed', () => {
    expect(verdictOf([pass('a'), skip('b')], [blocked])).toBe('blocked');
    expect(exitCodeOf('blocked')).toBe(3);
  });
  it('counts by status', () => {
    expect(countChecks([pass('a'), pass('b'), fail('c'), warn('d'), skip('e')])).toEqual({ pass: 2, fail: 1, warn: 1, skip: 1 });
  });
});

describe('markdown report', () => {
  it('has the verdict, the table, the notes and the artifacts', () => {
    const md = renderMarkdown(report());
    expect(md).toContain('# Arena smoke report 20261028-101530');
    expect(md).toContain('**Verdict: PASS** (1 pass, 0 fail, 1 warn, 1 skipped)');
    expect(md).toContain('| WARN | Check b |');
    expect(md).toContain('- **b** (warn): software GL');
    expect(md).toContain('`cursor-save-trace.json`');
    expect(md).toContain('No console errors (0 warnings).');
  });

  it('says clearly what is blocked and where', () => {
    const md = renderMarkdown(report({ checks: [pass('a')], blocked: [blocked], verdict: 'blocked' }));
    expect(md).toContain('**Verdict: BLOCKED**');
    expect(md).toContain('## Blocked');
    expect(md).toContain('`fixture.hook`');
    expect(md).toContain('smoke.hook-missing');
    expect(md).toContain('window.__arena.viewer is not in this build');
  });

  it('flags software rendering next to the renderer', () => {
    const r = report();
    r.browser.softwareGl = true;
    expect(renderMarkdown(r)).toContain('software rendering');
  });

  it('escapes table cells', () => {
    const md = renderMarkdown(report({ checks: [{ id: 'x', title: 'a | b', status: 'fail', actual: 'line1\nline2' }] }));
    expect(md).toContain('a \\| b');
    expect(md).toContain('line1 line2');
  });

  it('lists console errors, capped', () => {
    const errors = Array.from({ length: 40 }, (_, i) => ({ source: 'console', text: `error ${i}` }));
    const md = renderMarkdown(report({ consoleErrors: errors }));
    expect(md).toContain('error 0');
    expect(md).toContain('and 10 more');
  });
});

describe('writing the report', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('writes report.json and report.md under the run id, and latest copies', () => {
    const dir = mkdtempSync(join(tmpdir(), 'smoke-report-'));
    dirs.push(dir);
    const r = report();
    const out = writeSmokeReport(dir, r);
    expect(out.json).toBe(join(dir, '20261028-101530', 'report.json'));
    const parsed = JSON.parse(readFileSync(out.json, 'utf8')) as SmokeReport;
    expect(parsed).toEqual(r);
    expect(readFileSync(join(dir, 'latest.md'), 'utf8')).toBe(readFileSync(out.md, 'utf8'));
    expect(JSON.parse(readFileSync(join(dir, 'latest.json'), 'utf8')).runId).toBe('20261028-101530');
  });

  it('run ids sort by time', () => {
    expect(runIdFor(new Date(2026, 9, 28, 9, 5, 3))).toBe('20261028-090503');
    expect(runIdFor(new Date(2026, 9, 28, 10, 0, 0)) > runIdFor(new Date(2026, 9, 28, 9, 59, 59))).toBe(true);
  });
});
