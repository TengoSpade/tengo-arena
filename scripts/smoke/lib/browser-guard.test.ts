/**
 * The process-safety guard: nothing that kills browsers or deletes folders runs for a name this driver did not make. The test
 * replaces spawnSync, so a refused call is shown to run nothing, not just to build a harmless-looking script.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const spawned = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('node:child_process', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return {
    ...real,
    spawnSync: (...args: unknown[]) => {
      spawned.calls.push(args);
      return { status: 0, stdout: '', stderr: '' };
    },
  };
});

const { PROFILE_NAME, isOwnProfile, killByProfile, killByProfileScript, sweepStaleProfiles } = await import('./browser');

beforeEach(() => {
  spawned.calls.length = 0;
});

describe('which folders are ours', () => {
  it('only arena-smoke-profile- plus six letters or digits, directly in the temp folder', () => {
    expect(PROFILE_NAME.test('arena-smoke-profile-AbC123')).toBe(true);
    expect(isOwnProfile(join(tmpdir(), 'arena-smoke-profile-AbC123'))).toBe(true);
    for (const bad of ['', '.', '/', 'arena-smoke-profile-', 'arena-smoke-profile-AbC12', 'arena-smoke-profile-AbC1234', 'arena-smoke-profile-AbC12!', 'smoke-profile-AbC123', '*', 'arena-smoke-profile-*']) {
      expect(isOwnProfile(bad)).toBe(false);
      expect(isOwnProfile(join(tmpdir(), bad))).toBe(false);
    }
  });

  it('a profile-shaped name anywhere but the temp folder is not ours (never a person\'s own profile)', () => {
    expect(isOwnProfile(join(tmpdir(), 'elsewhere', 'arena-smoke-profile-AbC123'))).toBe(false);
    expect(isOwnProfile('C:\\Users\\someone\\AppData\\Local\\Microsoft\\Edge\\User Data')).toBe(false);
    expect(isOwnProfile('/home/someone/arena-smoke-profile-AbC123')).toBe(false);
  });
});

describe('killing by profile', () => {
  it('refuses, and runs nothing, for an empty name or anything that is not ours', () => {
    for (const bad of ['', '.', '..', tmpdir(), 'arena-smoke-profile-', join(tmpdir(), 'arena-smoke-profile-*'), join(tmpdir(), 'Edge'), 'C:\\Users\\x\\AppData\\Local\\Microsoft\\Edge\\User Data']) {
      expect(killByProfile(bad)).toBe(false);
    }
    expect(spawned.calls).toHaveLength(0);
  });

  it('runs for our own folder, with its name and nothing else in the pattern', () => {
    expect(killByProfile(join(tmpdir(), 'arena-smoke-profile-AbC123'))).toBe(true);
    expect(spawned.calls).toHaveLength(1);
    const joined = JSON.stringify(spawned.calls[0]);
    expect(joined).toContain('arena-smoke-profile-AbC123');
    expect(joined).not.toContain('**');
  });

  it('the kill script cannot be built from a name that is not ours', () => {
    expect(() => killByProfileScript('')).toThrow(/refusing/);
    expect(() => killByProfileScript('*')).toThrow(/refusing/);
    expect(() => killByProfileScript("x' -or $true; #")).toThrow(/refusing/);
    expect(killByProfileScript('arena-smoke-profile-AbC123')).toContain("-like '*arena-smoke-profile-AbC123*'");
  });
});

describe('sweeping stale profile folders', () => {
  let temp = '';
  beforeEach(() => {
    temp = mkdtempSync(join(tmpdir(), 'sweep-test-'));
  });
  afterEach(() => {
    rmSync(temp, { recursive: true, force: true });
  });

  const make = (name: string, ageMs: number): string => {
    const dir = join(temp, name);
    mkdirSync(dir, { recursive: true });
    const t = (Date.now() - ageMs) / 1000;
    utimesSync(dir, t, t);
    return dir;
  };

  it('removes our folders older than an hour and leaves younger ones and everything else', () => {
    const old = make('arena-smoke-profile-OLD123', 2 * 3_600_000);
    const fresh = make('arena-smoke-profile-NEW123', 60_000);
    const other = make('someone-elses-folder', 5 * 3_600_000);
    const oddName = make('arena-smoke-profile-TOOLONG', 5 * 3_600_000);
    const removed = sweepStaleProfiles(3_600_000, temp);
    expect(removed).toEqual([old]);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
    expect(existsSync(other)).toBe(true);
    expect(existsSync(oddName)).toBe(true);
  });

  it('a missing temp folder is not an error', () => {
    expect(sweepStaleProfiles(1, join(temp, 'missing'))).toEqual([]);
  });
});
