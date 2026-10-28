import { describe, expect, it } from 'vitest';
import { checkFirstOpen } from '../lib/checks';
import { ARM_OPEN_TIMER, checkPrefetchSeen, VIEWER_CHUNKS, WAIT_FOR_PREFETCH, type PrefetchSeen } from './first-open';

const seen = (missing: string[] = []): PrefetchSeen => ({
  waitedMs: 1100,
  chunks: Object.fromEntries(VIEWER_CHUNKS.map((n) => [n, missing.includes(n) ? null : { startedAgoMs: 5000, endedAgoMs: 4200, kB: 40 }])),
});

describe('the real-path first open', () => {
  const strict = { softwareGl: false, strict: true };

  it('is judged on three opens and, under --strict-perf, on the cold one, under its own check id', () => {
    const ok = checkFirstOpen([420, 300, 310], strict, { id: 'perf.first-open-real' });
    expect(ok.id).toBe('perf.first-open-real');
    expect(ok.status).toBe('pass');
    const cold = checkFirstOpen([560, 300, 310], strict, { id: 'perf.first-open-real', coldNote: 'real path' });
    expect(cold.status).toBe('fail');
    expect(cold.detail).toContain('real path');
    expect(checkFirstOpen([560, 300, 310], { softwareGl: false, strict: false }).status).toBe('warn');
    expect(checkFirstOpen([560, 700, 710], strict).status).toBe('fail');
  });

  it('fails when a viewer chunk was not fetched before Watch, and says which', () => {
    const miss = checkPrefetchSeen([seen(), seen(['WebGLRenderer'])], 'dom');
    expect(miss.status).toBe('fail');
    expect(miss.actual).toContain('page 2: WebGLRenderer');
    expect(checkPrefetchSeen([seen(), seen(), seen()], 'dom').status).toBe('pass');
    expect(checkPrefetchSeen([], 'dom').status).toBe('skip');
  });

  it('says what a pass proves: in the smoke build the hook prefetches too', () => {
    expect(checkPrefetchSeen([seen()], 'hook').detail).toContain('also prefetches at boot');
    expect(checkPrefetchSeen([seen()], 'dom').detail).toContain('only the UI');
  });

  it('page scripts are well-formed JavaScript', () => {
    expect(() => new Function(`return ${WAIT_FOR_PREFETCH}`)).not.toThrow();
    expect(() => new Function(`return ${ARM_OPEN_TIMER}`)).not.toThrow();
  });
});
