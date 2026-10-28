/**
 * One browser page driven over CDP: navigation, evaluation, waiting, real mouse and key input, screenshots,
 * emulation (colour scheme, reduced motion, colour-vision deficiency), heap, and the console record.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CdpClient } from './cdp';
import type { ConsoleRecord } from './checks';

/** A step that cannot work as it is. `blocked` = a piece another work package delivers is not there yet. */
export class SmokeFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly blocked = false,
  ) {
    super(message);
    this.name = 'SmokeFailure';
  }
}

export type VisionDeficiency = 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia' | 'achromatopsia';

export interface Locator {
  css?: string;
  /** Regular-expression source matched against the element's visible text. */
  text?: string;
  flags?: string;
  nth?: number;
  within?: string;
}

export interface Located {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  testId: string | null;
  disabled: boolean;
  tag: string;
}

export interface OpenOptions {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  colorScheme?: 'light' | 'dark';
  reducedMotion?: boolean;
}

const PROBE_SOURCE = readFileSync(new URL('../page/probe.js', import.meta.url), 'utf8');

const KEYS: Record<string, { code: string; vk: number; text?: string }> = {
  Enter: { code: 'Enter', vk: 13, text: '\r' },
  Escape: { code: 'Escape', vk: 27 },
  Space: { code: 'Space', vk: 32, text: ' ' },
  ' ': { code: 'Space', vk: 32, text: ' ' },
  Tab: { code: 'Tab', vk: 9 },
  ArrowLeft: { code: 'ArrowLeft', vk: 37 },
  ArrowRight: { code: 'ArrowRight', vk: 39 },
  ArrowUp: { code: 'ArrowUp', vk: 38 },
  ArrowDown: { code: 'ArrowDown', vk: 40 },
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class PageDriver {
  readonly console: ConsoleRecord[] = [];
  private perfEnabled = false;
  private constructor(
    readonly client: CdpClient,
    readonly targetId: string,
    readonly sessionId: string,
    readonly viewport: { width: number; height: number },
  ) {
    client.on((e) => {
      if (e.sessionId !== sessionId) return;
      if (e.method === 'Runtime.consoleAPICalled') {
        const type = String(e.params['type']);
        if (type !== 'error' && type !== 'warning' && type !== 'assert') return;
        const args = (e.params['args'] as { value?: unknown; description?: string }[] | undefined) ?? [];
        const text = args.map((a) => (a.value !== undefined ? String(a.value) : (a.description ?? ''))).join(' ');
        this.console.push({ source: 'console', level: type === 'warning' ? 'warning' : 'error', text });
      } else if (e.method === 'Runtime.exceptionThrown') {
        const d = e.params['exceptionDetails'] as { text?: string; exception?: { description?: string }; url?: string } | undefined;
        this.console.push({ source: 'exception', level: 'error', text: d?.exception?.description ?? d?.text ?? 'uncaught exception', ...(d?.url ? { url: d.url } : {}) });
      } else if (e.method === 'Log.entryAdded') {
        const entry = e.params['entry'] as { level?: string; source?: string; text?: string; url?: string } | undefined;
        if (entry && (entry.level === 'error' || entry.level === 'warning')) {
          this.console.push({ source: `log:${entry.source ?? 'other'}`, level: entry.level, text: entry.text ?? '', ...(entry.url ? { url: entry.url } : {}) });
        }
      }
    });
  }

  static async open(client: CdpClient, opts: OpenOptions): Promise<PageDriver> {
    const { targetId } = await client.send<{ targetId: string }>('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await client.send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });
    const page = new PageDriver(client, targetId, sessionId, { width: opts.width, height: opts.height });
    await Promise.all([page.send('Page.enable'), page.send('Runtime.enable'), page.send('Log.enable'), page.send('Network.enable')]);
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE_SOURCE });
    await page.send('Runtime.evaluate', { expression: PROBE_SOURCE });
    await page.setViewport(opts.width, opts.height, opts.deviceScaleFactor ?? 1);
    await page.setMedia({ ...(opts.colorScheme ? { colorScheme: opts.colorScheme } : {}), reducedMotion: opts.reducedMotion ?? false });
    return page;
  }

  send<T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}, timeoutMs?: number): Promise<T> {
    return this.client.send<T>(method, params, this.sessionId, timeoutMs);
  }

  async setViewport(width: number, height: number, deviceScaleFactor = 1): Promise<void> {
    (this.viewport as { width: number; height: number }).width = width;
    (this.viewport as { width: number; height: number }).height = height;
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false });
  }

  async setMedia(opts: { colorScheme?: 'light' | 'dark'; reducedMotion?: boolean }): Promise<void> {
    const features: { name: string; value: string }[] = [];
    if (opts.colorScheme) features.push({ name: 'prefers-color-scheme', value: opts.colorScheme });
    features.push({ name: 'prefers-reduced-motion', value: opts.reducedMotion ? 'reduce' : 'no-preference' });
    await this.send('Emulation.setEmulatedMedia', { features });
  }

  /** CDP's colour-vision-deficiency emulation (the arena's art-005 screenshots, A9). */
  async setVision(type: VisionDeficiency): Promise<void> {
    await this.send('Emulation.setEmulatedVisionDeficiency', { type });
  }

  /**
   * Wait for the page's next load event around `start`. The waiter is cancelled however `start` ends, and its promise is
   * marked handled at once, so a failed navigation never leaves a rejection nobody awaits (which would end the process).
   */
  private async untilLoaded(what: string, timeoutMs: number, start: () => Promise<void>): Promise<void> {
    const stop = new AbortController();
    const loaded = this.client.waitForEvent((e) => e.sessionId === this.sessionId && e.method === 'Page.loadEventFired', timeoutMs, what, stop.signal);
    loaded.catch(() => undefined);
    try {
      await start();
      await loaded;
    } finally {
      stop.abort();
    }
  }

  async goto(url: string, timeoutMs = 30_000): Promise<void> {
    await this.untilLoaded(`the page load of ${url}`, timeoutMs, async () => {
      const nav = await this.send<{ errorText?: string }>('Page.navigate', { url });
      if (nav.errorText) throw new SmokeFailure('page.navigate', `Could not open ${url}: ${nav.errorText}`);
    });
  }

  /** Evaluate an expression in the page; the value comes back by value. Throws with the page's own message. */
  async eval<T = unknown>(expression: string, timeoutMs = 30_000): Promise<T> {
    const r = await this.send<{ result: { value?: T; description?: string }; exceptionDetails?: { text?: string; exception?: { description?: string } } }>(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true, userGesture: true },
      timeoutMs,
    );
    if (r.exceptionDetails) {
      throw new SmokeFailure('page.eval', `The page threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text ?? 'unknown error'}\nin: ${expression.slice(0, 200)}`);
    }
    return r.result.value as T;
  }

  /** Call window.__smoke.<fn>(...args) (the injected probe). */
  probe<T = unknown>(fn: string, ...args: unknown[]): Promise<T> {
    return this.eval<T>(`window.__smoke.${fn}(${args.map((a) => JSON.stringify(a)).join(', ')})`);
  }

  /** Poll `expression` until it is truthy; the failure names what was awaited and shows the page's text. */
  async waitFor(expression: string, what: string, opts: { timeoutMs?: number; pollMs?: number; blocked?: { code: string } } = {}): Promise<void> {
    const timeoutMs = opts.timeoutMs ?? 15_000;
    const deadline = Date.now() + timeoutMs;
    let lastError = '';
    while (Date.now() < deadline) {
      try {
        if (await this.eval<unknown>(`!!(${expression})`)) return;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
      await sleep(opts.pollMs ?? 50);
    }
    const text = await this.eval<string>('window.__smoke ? window.__smoke.pageText(500) : document.body.innerText.slice(0, 500)').catch(() => '');
    throw new SmokeFailure(opts.blocked?.code ?? 'page.timeout', `Timed out after ${timeoutMs} ms waiting for ${what}.${lastError ? ` Last error: ${lastError}` : ''}\nPage shows: ${text.replace(/\s+/g, ' ').slice(0, 300)}`, opts.blocked !== undefined);
  }

  async waitForHash(pattern: RegExp, what: string, timeoutMs = 15_000): Promise<void> {
    await this.waitFor(`new RegExp(${JSON.stringify(pattern.source)}, ${JSON.stringify(pattern.flags)}).test(location.hash)`, what, { timeoutMs });
  }

  async locate(spec: Locator): Promise<Located | null> {
    return this.probe<Located | null>('locate', spec);
  }

  /** Wait for a control, then click it with real mouse events at its centre. */
  async click(spec: Locator, what: string, opts: { timeoutMs?: number; blocked?: { code: string } } = {}): Promise<Located> {
    const deadline = Date.now() + (opts.timeoutMs ?? 10_000);
    let at: Located | null = null;
    while (Date.now() < deadline) {
      at = await this.locate(spec);
      if (at && !at.disabled) break;
      await sleep(80);
    }
    if (!at || at.disabled) {
      const controls = await this.probe<{ tag: string; testId: string | null; text: string; disabled: boolean }[]>('controls').catch(() => []);
      const list = controls
        .slice(0, 25)
        .map((c) => `${c.tag}${c.testId ? `[${c.testId}]` : ''} "${c.text}"${c.disabled ? ' (disabled)' : ''}`)
        .join('; ');
      throw new SmokeFailure(opts.blocked?.code ?? 'page.no-control', `${at?.disabled ? 'The control is disabled' : 'Could not find'}: ${what} (${JSON.stringify(spec)}).\nVisible controls: ${list || 'none'}`, opts.blocked !== undefined);
    }
    await this.mouseClick(at.x, at.y);
    return at;
  }

  async mouseClick(x: number, y: number): Promise<void> {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }

  async press(key: string, modifiers = 0): Promise<void> {
    const k = KEYS[key] ?? { code: `Key${key.toUpperCase()}`, vk: key.toUpperCase().charCodeAt(0), text: key.length === 1 ? key : undefined };
    const base = { key: key === 'Space' ? ' ' : key, code: k.code, windowsVirtualKeyCode: k.vk, modifiers };
    await this.send('Input.dispatchKeyEvent', { type: k.text !== undefined ? 'keyDown' : 'rawKeyDown', ...base, ...(k.text !== undefined ? { text: k.text } : {}) });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }

  /** Type into the focused element. */
  async typeText(text: string): Promise<void> {
    await this.send('Input.insertText', { text });
  }

  async screenshot(file: string | null, opts: { clip?: { x: number; y: number; width: number; height: number } } = {}): Promise<Buffer> {
    const r = await this.send<{ data: string }>('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false, ...(opts.clip ? { clip: { ...opts.clip, scale: 1 } } : {}) });
    const buf = Buffer.from(r.data, 'base64');
    if (file) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, buf);
    }
    return buf;
  }

  /** Chromium's per-page counters (seconds): Timestamp, TaskDuration, ScriptDuration, LayoutDuration, RecalcStyleDuration... Cumulative since the page started. */
  async perfMetrics(): Promise<Record<string, number>> {
    if (!this.perfEnabled) {
      await this.send('Performance.enable');
      this.perfEnabled = true;
    }
    const r = await this.send<{ metrics: { name: string; value: number }[] }>('Performance.getMetrics');
    return Object.fromEntries(r.metrics.map((m) => [m.name, m.value]));
  }

  /** JS heap in use, bytes; a forced garbage collection first so samples are comparable. */
  async heapUsed(gc = true): Promise<number> {
    if (gc) await this.send('HeapProfiler.collectGarbage', {}, 60_000);
    const r = await this.send<{ usedSize: number }>('Runtime.getHeapUsage');
    return r.usedSize;
  }

  async reload(): Promise<void> {
    await this.untilLoaded('the page reload', 30_000, async () => {
      await this.send('Page.reload');
    });
  }

  async close(): Promise<void> {
    try {
      await this.client.send('Target.closeTarget', { targetId: this.targetId });
    } catch {
      /* the browser is going away */
    }
  }
}

export { sleep };
