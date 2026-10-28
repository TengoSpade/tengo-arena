/** The driver's plumbing: PNG, browser launch arguments, options, the CDP client (on a fake socket), the recorder, the static server. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { needsPlayPress } from './arena-ui';
import { browserArgs, browserCandidates, browserEnv, findBrowser, killByProfileScript } from './browser';
import { CdpClient, CdpError } from './cdp';
import { parseOptions } from './options';
import { SmokeFailure } from './page';
import { decodePng, encodePng, makeImage, paintRing } from './png';
import { JourneyStop, Recorder } from './recorder';
import { serveFolder } from './serve';

describe('png', () => {
  it('round-trips pixels', () => {
    const img = makeImage(40, 30, [10, 20, 30]);
    paintRing(img, 20, 15, 8, 4, [200, 100, 50]);
    const back = decodePng(encodePng(img));
    expect(back.width).toBe(40);
    expect(back.height).toBe(30);
    expect(Buffer.from(back.data).equals(Buffer.from(img.data))).toBe(true);
  });

  it('refuses what is not a png', () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow(/not a PNG/);
  });
});

describe('browser launch', () => {
  it('headless with a throwaway profile and a DevTools port picked by the browser', () => {
    const args = browserArgs({ exe: 'x' }, 'C:\\tmp\\profile');
    expect(args).toContain('--headless=new');
    expect(args).toContain('--remote-debugging-port=0');
    expect(args).toContain('--user-data-dir=C:\\tmp\\profile');
    expect(args).toContain('--disable-background-timer-throttling');
    expect(args).toContain('--enable-unsafe-swiftshader');
    expect(args[args.length - 1]).toBe('about:blank');
  });

  it('headed mode drops the headless flag; hardware mode drops the software fallback', () => {
    expect(browserArgs({ exe: 'x', headless: false }, 'p')).not.toContain('--headless=new');
    const hw = browserArgs({ exe: 'x', gpu: 'hardware' }, 'p');
    expect(hw).not.toContain('--enable-unsafe-swiftshader');
    expect(hw).toContain('--enable-gpu');
    expect(browserArgs({ exe: 'x', gpu: 'software' }, 'p')).toContain('--use-angle=swiftshader');
  });

  it('drops the compatibility-layer variable that makes Edge relaunch itself and orphan', () => {
    const env = browserEnv({ __COMPAT_LAYER: 'DetectorsAppHealth', ELECTRON_RUN_AS_NODE: '1', PATH: 'p', TEMP: 't' });
    expect(env['__COMPAT_LAYER']).toBeUndefined();
    expect(env['ELECTRON_RUN_AS_NODE']).toBeUndefined();
    expect(env['PATH']).toBe('p');
  });

  it('knows where Edge and Chrome live on Windows, Edge first', () => {
    const c = browserCandidates('win32', { 'ProgramFiles(x86)': 'C:\\Program Files (x86)', ProgramFiles: 'C:\\Program Files', LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' });
    expect(c[0]).toMatch(/Microsoft.Edge.Application.msedge\.exe$/);
    expect(c.some((p) => /Google.Chrome.Application.chrome\.exe$/.test(p))).toBe(true);
    expect(c.findIndex((p) => /msedge/.test(p))).toBeLessThan(c.findIndex((p) => /chrome\.exe/.test(p)));
  });

  it('an explicit browser that does not exist is an error naming it', () => {
    expect(() => findBrowser('Z:\\nope\\msedge.exe')).toThrow(/does not exist/);
  });

  it('the cleanup script matches only browsers started with this profile folder', () => {
    const script = killByProfileScript('arena-smoke-profile-AbC123');
    expect(script).toContain("-like '*arena-smoke-profile-AbC123*'");
    expect(script).toContain('msedge|chrome');
    expect(script).toContain('Stop-Process');
  });
});

describe('options', () => {
  it('defaults', () => {
    const o = parseOptions([]);
    if (o === 'help') throw new Error('unexpected help');
    expect([...o.only]).toEqual(['cross', 'fixture', 'career']);
    expect(o.seconds).toBe(10);
    expect(o.heapLoads).toBe(20);
    expect(o.gpu).toBe('auto');
    expect(o.fights).toBe(5);
    expect(o.selfTest).toBe(false);
    expect(o.reportsDir).toMatch(/reports[\\/]smoke$/);
  });

  it('parses journeys, numbers and flags', () => {
    const o = parseOptions(['--only', 'cross,vis003', '--seconds', '4', '--no-build', '--self-test', '--allow-console', 'foo,bar', '--ring-colors', '#fff,#000']);
    if (o === 'help') throw new Error('unexpected help');
    expect([...o.only]).toEqual(['cross', 'vis003']);
    expect(o.seconds).toBe(4);
    expect(o.noBuild).toBe(true);
    expect(o.selfTest).toBe(true);
    expect(o.allowConsole.map((r) => r.source)).toEqual(['foo', 'bar']);
    expect(o.ringColors).toEqual(['#fff', '#000']);
  });

  it('rejects an unknown journey or gpu mode, and answers --help', () => {
    expect(() => parseOptions(['--only', 'nope'])).toThrow(/unknown journey/);
    expect(() => parseOptions(['--gpu', 'quantum'])).toThrow(/--gpu/);
    expect(parseOptions(['--help'])).toBe('help');
  });
});

/** A WebSocket that talks to the test instead of a network. */
class FakeSocket {
  static last: FakeSocket;
  sent: { id: number; method: string; params: unknown; sessionId?: string }[] = [];
  private handlers = new Map<string, ((ev: { data?: unknown }) => void)[]>();
  constructor(readonly url: string) {
    FakeSocket.last = this;
    queueMicrotask(() => this.emit('open', {}));
  }
  addEventListener(type: string, fn: (ev: { data?: unknown }) => void): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn]);
  }
  send(text: string): void {
    this.sent.push(JSON.parse(text));
  }
  close(): void {
    this.emit('close', {});
  }
  emit(type: string, ev: { data?: unknown }): void {
    for (const h of this.handlers.get(type) ?? []) h(ev);
  }
  reply(msg: unknown): void {
    this.emit('message', { data: JSON.stringify(msg) });
  }
}

describe('CDP client', () => {
  const real = globalThis.WebSocket;
  beforeEach(() => {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeSocket;
  });
  afterEach(() => {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = real;
  });

  it('matches answers to requests by id and carries the session', async () => {
    const c = await CdpClient.connect('ws://x');
    const a = c.send('Page.enable', {}, 'S1');
    const b = c.send('Runtime.evaluate', { expression: '1' }, 'S1');
    const [first, second] = FakeSocket.last.sent;
    expect(first).toMatchObject({ method: 'Page.enable', sessionId: 'S1' });
    FakeSocket.last.reply({ id: second!.id, result: { value: 2 } });
    FakeSocket.last.reply({ id: first!.id, result: { ok: true } });
    await expect(b).resolves.toEqual({ value: 2 });
    await expect(a).resolves.toEqual({ ok: true });
  });

  it('rejects with the protocol error', async () => {
    const c = await CdpClient.connect('ws://x');
    const p = c.send('Page.navigate', {});
    FakeSocket.last.reply({ id: FakeSocket.last.sent[0]!.id, error: { code: -32000, message: 'Cannot navigate' } });
    await expect(p).rejects.toBeInstanceOf(CdpError);
    await expect(p).rejects.toThrow(/Cannot navigate/);
  });

  it('dispatches events and waits for one', async () => {
    const c = await CdpClient.connect('ws://x');
    const seen: string[] = [];
    c.on((e) => seen.push(e.method));
    const waited = c.waitForEvent((e) => e.method === 'Page.loadEventFired' && e.sessionId === 'S1', 1000, 'load');
    FakeSocket.last.reply({ method: 'Runtime.consoleAPICalled', params: {}, sessionId: 'S1' });
    FakeSocket.last.reply({ method: 'Page.loadEventFired', params: { timestamp: 1 }, sessionId: 'S1' });
    await expect(waited).resolves.toMatchObject({ method: 'Page.loadEventFired' });
    expect(seen).toEqual(['Runtime.consoleAPICalled', 'Page.loadEventFired']);
  });

  it('times out a command and fails pending ones when the socket closes', async () => {
    const c = await CdpClient.connect('ws://x');
    await expect(c.send('Slow.method', {}, undefined, 20)).rejects.toThrow(/timed out/);
    const pending = c.send('Other.method');
    FakeSocket.last.close();
    await expect(pending).rejects.toThrow(/closed/);
    await expect(c.send('After.close')).rejects.toThrow(/cannot send/);
    expect(c.closed).toBe(true);
  });
});

describe('recorder', () => {
  it('records passing steps and failed steps (a failed step is a failed check and ends the journey)', async () => {
    const rec = new Recorder();
    await rec.journey('j', async () => {
      await rec.step('a', 'First', async () => undefined);
      await rec.step('b', 'Second', async () => {
        throw new Error('it broke\nsecond line');
      });
      await rec.step('c', 'Never', async () => undefined);
    });
    expect(rec.steps.map((s) => `${s.id}:${s.status}`)).toEqual(['a:pass', 'b:fail']);
    expect(rec.checks).toHaveLength(1);
    expect(rec.checks[0]).toMatchObject({ id: 'step.b', status: 'fail' });
    expect(rec.blocked).toHaveLength(0);
  });

  it('a blocked step names what is missing, is not a failure, and ends only its own journey', async () => {
    const rec = new Recorder();
    await rec.journey('one', async () => {
      await rec.step('x', 'Needs the hook', async () => {
        throw new SmokeFailure('smoke.hook-missing', 'window.__arena.viewer is not in this build', true);
      });
    });
    await rec.journey('two', async () => {
      await rec.step('y', 'Independent', async () => undefined);
    });
    expect(rec.blocked).toEqual([{ code: 'smoke.hook-missing', message: 'window.__arena.viewer is not in this build', step: 'x' }]);
    expect(rec.steps.map((s) => `${s.id}:${s.status}`)).toEqual(['x:blocked', 'y:pass']);
    expect(rec.checks).toHaveLength(0);
  });

  it('an unexpected crash becomes a failed check, not an exception', async () => {
    const rec = new Recorder();
    await rec.journey('crashy', async () => {
      throw new TypeError('boom');
    });
    expect(rec.checks[0]).toMatchObject({ id: 'journey.crashy', status: 'fail' });
  });

  it('block() notes a missing piece without ending anything', () => {
    const rec = new Recorder();
    rec.block('smoke.core-stub', 'liveRoundPlayback is not implemented', 'arena.hash');
    expect(rec.blocked).toHaveLength(1);
  });

  it('JourneyStop carries the journey name', () => {
    expect(new JourneyStop('career').message).toContain('career');
  });
});

describe('static server', () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('serves a folder, dynamic routes, 404s, and refuses to leave the folder', async () => {
    dir = mkdtempSync(join(tmpdir(), 'smoke-serve-'));
    writeFileSync(join(dir, 'index.html'), '<h1>hi</h1>');
    writeFileSync(join(dir, 'data.json'), '{"a":1}');
    const s = await serveFolder(dir, { '/dyn.json': () => '{"d":2}' });
    try {
      const home = await fetch(`${s.url}/`);
      expect(home.headers.get('content-type')).toMatch(/text\/html/);
      expect(await home.text()).toBe('<h1>hi</h1>');
      expect(await (await fetch(`${s.url}/data.json`)).json()).toEqual({ a: 1 });
      expect(await (await fetch(`${s.url}/dyn.json`)).json()).toEqual({ d: 2 });
      expect((await fetch(`${s.url}/missing.js`)).status).toBe(404);
      expect((await fetch(`${s.url}/..%2f..%2fpackage.json`)).status).toBe(404);
    } finally {
      await s.close();
    }
  });
});

describe('pressing Play like a player', () => {
  it('presses it when the screen is paused with a Play button, also at the round\'s last tick', () => {
    expect(needsPlayPress({ state: 'paused', playLabel: 'Play Space' })).toBe(true);
    expect(needsPlayPress({ state: 'ready', playLabel: 'Play Space' })).toBe(true);
  });
  it('does not press it while playing, while the round is ending, or off the arena screen', () => {
    expect(needsPlayPress({ state: 'playing', playLabel: 'Pause Space' })).toBe(false);
    expect(needsPlayPress({ state: 'round-end', playLabel: 'Play Space' })).toBe(false);
    expect(needsPlayPress({ state: 'paused', playLabel: '' })).toBe(false);
    expect(needsPlayPress(null)).toBe(false);
  });
});
