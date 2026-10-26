/**
 * Vite dev-server plugin for playtest tickets (active only under `npm run dev`).
 *
 *   GET  /__tickets/next?career=<key>   -> { run, ticket }
 *   POST /__tickets                     JSON TicketPayload (base64 PNG) -> { id, dir }
 *   GET  /__tickets/<id>/<file>         state.json | ticket.json | screenshot.png (reproduction)
 *   GET  /__tickets/tickets.md          the markdown index
 *   GET  /__tickets/info                { dir, build }
 *
 * Files go to `<repo>/tickets/` only (scripts/tickets/store.ts validates every write). The build
 * (git short commit + dirty flag) is read once when the server starts.
 */
import { execSync } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { LIMITS, TicketError, createTicketsFs, type TicketPayload, type TicketsFs } from './store.ts';

function gitBuild(cwd: string): { commit: string; dirty: boolean } {
  try {
    const commit = execSync('git rev-parse --short HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain --untracked-files=no', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().length > 0;
    return { commit, dirty };
  } catch {
    return { commit: 'unknown', dirty: false };
  }
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new TicketError(413, 'request too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json'): void {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

/** The request handler on its own, so tests can drive it without a server. */
export function ticketsHandler(fs: TicketsFs, build: Record<string, unknown>) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname.replace(/^\/__tickets/, '') || '/';
      if (req.method === 'POST' && (path === '/' || path === '')) {
        const payload = JSON.parse(await readBody(req, LIMITS.body)) as TicketPayload;
        const out = fs.write(payload);
        send(res, 201, { id: out.id, dir: out.dir });
        return;
      }
      if (req.method === 'GET' && path === '/next') {
        send(res, 200, fs.next(url.searchParams.get('career') ?? ''));
        return;
      }
      if (req.method === 'GET' && path === '/info') {
        send(res, 200, { dir: fs.root, md: join(fs.root, 'tickets.md'), build });
        return;
      }
      if (req.method === 'GET' && path === '/tickets.md') {
        send(res, 200, fs.readMarkdown(), 'text/markdown; charset=utf-8');
        return;
      }
      const m = /^\/([^/]+)\/([^/]+)$/.exec(path);
      if (req.method === 'GET' && m) {
        const file = m[2]!;
        send(res, 200, fs.read(decodeURIComponent(m[1]!), file), file.endsWith('.png') ? 'image/png' : 'application/json');
        return;
      }
      send(res, 404, { error: 'not found' });
    } catch (e) {
      const status = e instanceof TicketError ? e.status : e instanceof SyntaxError ? 400 : 500;
      send(res, status, { error: e instanceof Error ? e.message : String(e) });
    }
  };
}

export function ticketsPlugin(options: { dir?: string } = {}): Plugin {
  return {
    name: 'arena-league-tickets',
    apply: 'serve',
    configureServer(server) {
      if (process.env['VITEST']) return; // tests drive the handler directly
      const root = server.config.root;
      const build = gitBuild(root);
      const fs = createTicketsFs(options.dir ?? join(root, 'tickets'), build);
      const handle = ticketsHandler(fs, build);
      server.middlewares.use('/__tickets', (req, res) => void handle(req, res));
    },
  };
}
