/**
 * Find and launch a headless Chromium-based browser (Edge first, then Chrome) with a throwaway profile, and
 * return its DevTools endpoint. Zero dependencies: Node's child_process, fs and fetch.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

export class SmokeSetupError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SmokeSetupError';
  }
}

/** Where a browser usually lives; the first existing one wins. `--browser` or SMOKE_BROWSER overrides. */
export function browserCandidates(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env): string[] {
  const out: string[] = [];
  if (platform === 'win32') {
    const roots = [env['ProgramFiles(x86)'], env['ProgramFiles'], env['LOCALAPPDATA']].filter((v): v is string => !!v);
    for (const r of roots) out.push(join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    for (const r of roots) out.push(join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  } else if (platform === 'darwin') {
    out.push('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  } else {
    out.push('/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  }
  return out;
}

export function findBrowser(explicit?: string): string {
  const wanted = explicit ?? process.env['SMOKE_BROWSER'];
  if (wanted) {
    if (!existsSync(wanted)) throw new SmokeSetupError('browser.not-found', `The browser given by --browser / SMOKE_BROWSER does not exist: ${wanted}`);
    return wanted;
  }
  const found = browserCandidates().find((p) => existsSync(p));
  if (!found) {
    throw new SmokeSetupError(
      'browser.not-found',
      `No Edge or Chrome found. Looked in:\n  ${browserCandidates().join('\n  ')}\nPass --browser <path to msedge.exe or chrome.exe> or set SMOKE_BROWSER.`,
    );
  }
  return found;
}

/**
 * The environment the browser starts with. `__COMPAT_LAYER` (an application-compatibility shim some hosts set, e.g.
 * 'DetectorsAppHealth' under Claude Code on Windows) makes msedge.exe re-launch itself detached and exit with code 0,
 * which orphans the real browser (it keeps running after the launcher is gone), so it is dropped.
 */
export function browserEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out = { ...env };
  delete out['__COMPAT_LAYER'];
  delete out['ELECTRON_RUN_AS_NODE'];
  return out;
}

/** How the browser gets its WebGL: 'auto' lets it choose (SwiftShader software GL when there is no usable GPU). */
export type GpuMode = 'auto' | 'hardware' | 'software';

export interface LaunchOptions {
  exe: string;
  /** Default true (--headless=new). false opens a window (debugging the driver). */
  headless?: boolean;
  /** Extra command-line flags. */
  extraArgs?: readonly string[];
  /** Initial window size (the pages set their own viewport through CDP). */
  windowSize?: { width: number; height: number };
  /**
   * 'auto' (default): the browser's own choice, plus permission to fall back to software WebGL so a context always exists.
   * 'hardware': ask for the GPU (ANGLE on Direct3D 11 on Windows) and no software fallback.
   * 'software': force SwiftShader (comparable numbers across machines, but not the reference machine's).
   */
  gpu?: GpuMode;
  /** Give up waiting for the DevTools endpoint after this long. */
  timeoutMs?: number;
}

export interface LaunchedBrowser {
  exe: string;
  child: ChildProcess;
  userDataDir: string;
  port: number;
  /** Browser-level ws:// endpoint. */
  wsUrl: string;
  version: { product: string; userAgent: string; protocol: string };
  /** Stop the browser (its whole process tree) and delete the profile. */
  close(): Promise<void>;
}

/** The flags that make a headless run stable and comparable (no throttling of background pages, no first-run UI). */
export function browserArgs(opts: LaunchOptions, userDataDir: string): string[] {
  const size = opts.windowSize ?? { width: 1920, height: 1080 };
  const gpu = opts.gpu ?? 'auto';
  const args = [
    opts.headless === false ? '' : '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    `--window-size=${size.width},${size.height}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-sync',
    '--disable-default-apps',
    '--disable-component-update',
    '--disable-background-networking',
    '--disable-features=Translate,MediaRouter,OptimizationHints',
    // Frame pacing must not be throttled for a page that is not in front.
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    // performance.memory with real numbers.
    '--enable-precise-memory-info',
    '--hide-scrollbars',
    '--mute-audio',
    '--force-color-profile=srgb',
  ];
  if (gpu === 'auto') args.push('--enable-unsafe-swiftshader');
  else if (gpu === 'software') args.push('--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader');
  else args.push('--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []));
  args.push(...(opts.extraArgs ?? []), 'about:blank');
  return args.filter((a) => a !== '');
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Kill a process and everything it started (Edge and Chrome spawn a tree). */
function killTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGKILL');
}

/** The only profile folder names this driver creates (mkdtemp: the prefix and six letters or digits). */
export const PROFILE_NAME = /^arena-smoke-profile-[A-Za-z0-9]{6}$/;

/**
 * True for a folder this driver made: a direct child of the temp folder named like PROFILE_NAME. Everything that kills
 * browsers or deletes folders goes through this, so an empty or odd name can never become a match-everything pattern
 * (-like '**') and a person's own profile can never be touched.
 */
export function isOwnProfile(userDataDir: string, temp: string = tmpdir()): boolean {
  if (!userDataDir) return false;
  const same = (x: string, y: string): boolean => (process.platform === 'win32' ? resolve(x).toLowerCase() === resolve(y).toLowerCase() : resolve(x) === resolve(y));
  return PROFILE_NAME.test(basename(userDataDir)) && same(dirname(resolve(userDataDir)), temp);
}

/** The PowerShell that stops every Edge or Chrome process whose command line names this profile folder. */
export function killByProfileScript(profileName: string): string {
  if (!PROFILE_NAME.test(profileName)) throw new Error(`refusing to build a kill pattern from "${profileName}"`);
  return [
    'Get-CimInstance Win32_Process',
    `| Where-Object { $_.CommandLine -like '*${profileName}*' -and $_.Name -match '^(msedge|chrome)\\.exe$' }`,
    '| ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
  ].join(' ');
}

/**
 * Kill every browser process that was started with this profile folder, even when the launcher process is already
 * gone (a browser that re-launches itself is no longer in the launcher's tree). Matches on the folder's unique name
 * only, so a person's own browser is never touched. Refuses (returns false, runs nothing) for any folder that is not one
 * this driver made.
 */
export function killByProfile(userDataDir: string): boolean {
  if (!isOwnProfile(userDataDir)) return false;
  const name = basename(userDataDir);
  if (process.platform === 'win32') {
    spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', killByProfileScript(name)], { stdio: 'ignore', timeout: 30_000 });
  } else {
    spawnSync('pkill', ['-9', '-f', name], { stdio: 'ignore' });
  }
  return true;
}

/** Delete a profile folder (own folders only), retrying while the dying browser still holds files; false if it is still there. */
async function removeProfile(userDataDir: string, attempts = 40, delayMs = 500): Promise<boolean> {
  if (!isOwnProfile(userDataDir)) return false;
  for (let i = 0; i < attempts; i++) {
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* still locked */
    }
    if (!existsSync(userDataDir)) return true;
    await sleep(delayMs);
  }
  return false;
}

/** Every browser this process launched and has not closed: profile folder to launcher (null before it is spawned). */
const launched = new Map<string, ChildProcess | null>();

/**
 * Stop everything this process launched and delete the profile folders, synchronously: for Ctrl+C, a kill, or a crash,
 * including the moment between creating the profile and the browser answering.
 */
export function cleanupLaunchedSync(): void {
  for (const [dir, child] of launched) {
    if (child) killTree(child);
    killByProfile(dir);
    if (isOwnProfile(dir)) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* a locked file: the next run's sweep takes it */
      }
    }
  }
  launched.clear();
}

/**
 * Delete profile folders left by earlier runs that were killed hard: arena-smoke-profile-* in the temp folder, older than
 * `maxAgeMs` (an hour by default, so a run in progress is never touched). Returns what it removed.
 */
export function sweepStaleProfiles(maxAgeMs = 3_600_000, temp: string = tmpdir(), now: number = Date.now()): string[] {
  const removed: string[] = [];
  let names: string[];
  try {
    names = readdirSync(temp);
  } catch {
    return removed;
  }
  for (const name of names) {
    if (!PROFILE_NAME.test(name)) continue;
    const dir = join(temp, name);
    try {
      if (now - statSync(dir).mtimeMs < maxAgeMs) continue;
      killByProfile(dir);
      rmSync(dir, { recursive: true, force: true });
      if (!existsSync(dir)) removed.push(dir);
    } catch {
      /* in use or locked: leave it */
    }
  }
  return removed;
}

export async function launchBrowser(opts: LaunchOptions): Promise<LaunchedBrowser> {
  const userDataDir = mkdtempSync(join(tmpdir(), 'arena-smoke-profile-'));
  launched.set(userDataDir, null);
  const child = spawn(opts.exe, browserArgs(opts, userDataDir), { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true, env: browserEnv() });
  launched.set(userDataDir, child);
  let stderr = '';
  child.stderr?.on('data', (d: Buffer) => {
    stderr = (stderr + d.toString()).slice(-4000);
  });
  let exited: number | null = null;
  child.on('exit', (code) => {
    exited = code ?? -1;
  });

  let closed = false;
  const cleanup = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    killTree(child);
    killByProfile(userDataDir);
    // The profile folder stays locked until the dying browser lets go of its files: keep trying for up to 20 s, and say so.
    const gone = await removeProfile(userDataDir);
    launched.delete(userDataDir);
    if (!gone) console.warn(`warning: could not delete the browser profile ${userDataDir}; the next run removes it once it is an hour old`);
  };

  const timeoutMs = opts.timeoutMs ?? 20_000;
  const deadline = Date.now() + timeoutMs;
  let port = 0;
  while (Date.now() < deadline) {
    // Exit code 0 is a browser that re-launched itself (see browserEnv): keep waiting for its port file.
    if (exited !== null && exited !== 0) {
      await cleanup();
      throw new SmokeSetupError('browser.exited', `The browser exited at start-up (code ${exited}).\n${stderr.trim()}`);
    }
    try {
      const file = readFileSync(join(userDataDir, 'DevToolsActivePort'), 'utf8').split(/\r?\n/);
      const p = Number(file[0]);
      if (Number.isInteger(p) && p > 0) {
        port = p;
        break;
      }
    } catch {
      /* not written yet */
    }
    await sleep(100);
  }
  if (!port) {
    await cleanup();
    throw new SmokeSetupError('browser.no-endpoint', `The browser did not publish a DevTools port within ${timeoutMs} ms.\n${stderr.trim()}`);
  }

  let version: { Browser?: string; 'User-Agent'?: string; 'Protocol-Version'?: string; webSocketDebuggerUrl?: string } = {};
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      version = (await res.json()) as typeof version;
      if (version.webSocketDebuggerUrl) break;
    } catch {
      /* retry */
    }
    await sleep(100);
  }
  if (!version.webSocketDebuggerUrl) {
    await cleanup();
    throw new SmokeSetupError('browser.no-endpoint', `The DevTools endpoint on port ${port} did not answer /json/version.`);
  }
  return {
    exe: opts.exe,
    child,
    userDataDir,
    port,
    wsUrl: version.webSocketDebuggerUrl,
    version: { product: version.Browser ?? 'unknown', userAgent: version['User-Agent'] ?? '', protocol: version['Protocol-Version'] ?? '' },
    close: cleanup,
  };
}
