/**
 * Build the `smoke` mode bundle (`vite build --mode smoke`) into reports/smoke/build and serve it with
 * `vite preview`; or serve a folder with a tiny static server (the self-test's mock arena). Zero dependencies.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { SmokeSetupError } from './browser';

export async function freePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const s = createNetServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => resolvePort(port));
    });
  });
}

function viteBin(repoRoot: string): string {
  const bin = join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(bin)) throw new SmokeSetupError('vite.missing', `vite is not installed (${bin}). Run npm ci.`);
  return bin;
}

export interface BuildResult {
  outDir: string;
  ms: number;
  log: string;
}

/** `vite build --mode smoke --outDir <outDir>`. The mode compiles in the test hook and the fixture round (tech-027). */
export function buildSmoke(repoRoot: string, outDir: string, mode = 'smoke'): BuildResult {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [viteBin(repoRoot), 'build', '--mode', mode, '--outDir', outDir, '--emptyOutDir'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const log = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (r.status !== 0) throw new SmokeSetupError('build.failed', `vite build --mode ${mode} failed (exit ${r.status}):\n${log.split('\n').slice(-25).join('\n')}`);
  return { outDir, ms: Date.now() - t0, log };
}

export interface Served {
  url: string;
  close(): Promise<void>;
}

async function waitForUrl(url: string, child: ChildProcess | null, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new SmokeSetupError('preview.exited', `vite preview exited (code ${child.exitCode}) before it served ${url}`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new SmokeSetupError('preview.timeout', `${url} did not answer within ${timeoutMs} ms`);
}

/** `vite preview` of a built folder on a free port. */
export async function startPreview(repoRoot: string, outDir: string): Promise<Served> {
  const port = await freePort();
  const child = spawn(process.execPath, [viteBin(repoRoot), 'preview', '--outDir', outDir, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  let stderr = '';
  child.stderr?.on('data', (d: Buffer) => {
    stderr = (stderr + d.toString()).slice(-2000);
  });
  const url = `http://127.0.0.1:${port}`;
  try {
    await waitForUrl(`${url}/`, child, 20_000);
  } catch (e) {
    child.kill();
    throw e instanceof SmokeSetupError ? new SmokeSetupError(e.code, `${e.message}\n${stderr}`) : e;
  }
  return {
    url,
    close: async () => {
      if (child.exitCode !== null) return;
      if (process.platform === 'win32' && child.pid !== undefined) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else child.kill('SIGKILL');
    },
  };
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

/** A static file server for a folder (index.html at /), for the self-test. */
export async function serveFolder(dir: string, extra: Record<string, () => string> = {}): Promise<Served> {
  const root = resolve(dir);
  const server: Server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    const dynamic = extra[path];
    if (dynamic) {
      res.writeHead(200, { 'content-type': MIME['.json']! });
      res.end(dynamic());
      return;
    }
    const rel = normalize(path === '/' ? '/index.html' : path).replace(/^([/\\])+/, '');
    const file = resolve(root, rel);
    if (!(file === root || file.startsWith(root + sep)) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  const port = await freePort();
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${port}`, close: async () => void (await new Promise<void>((r) => server.close(() => r()))) };
}
