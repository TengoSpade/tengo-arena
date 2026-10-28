/** A navigation that fails must leave nothing behind: no listener, no timer, no rejection nobody awaits (which ends the process). */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CdpClient } from './cdp';
import { PageDriver, SmokeFailure } from './page';

type Handler = (method: string, params: Record<string, unknown>) => Record<string, unknown> | undefined;

/** A DevTools socket that answers every command from `handler` (default: an empty result) and lets the test push events. */
class ScriptedSocket {
  static last: ScriptedSocket;
  static handler: Handler = () => ({});
  private handlers = new Map<string, ((ev: { data?: unknown }) => void)[]>();
  readonly sent: string[] = [];
  constructor(readonly url: string) {
    ScriptedSocket.last = this;
    queueMicrotask(() => this.emit('open', {}));
  }
  addEventListener(type: string, fn: (ev: { data?: unknown }) => void): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn]);
  }
  send(text: string): void {
    const msg = JSON.parse(text) as { id: number; method: string; params: Record<string, unknown> };
    this.sent.push(msg.method);
    const result = ScriptedSocket.handler(msg.method, msg.params);
    queueMicrotask(() => this.emit('message', { data: JSON.stringify({ id: msg.id, result: result ?? {} }) }));
  }
  close(): void {
    this.emit('close', {});
  }
  emit(type: string, ev: { data?: unknown }): void {
    for (const h of this.handlers.get(type) ?? []) h(ev);
  }
  event(method: string, params: Record<string, unknown>, sessionId = 'S1'): void {
    this.emit('message', { data: JSON.stringify({ method, params, sessionId }) });
  }
}

const real = globalThis.WebSocket;
const handler: Handler = (method) => (method === 'Target.createTarget' ? { targetId: 'T1' } : method === 'Target.attachToTarget' ? { sessionId: 'S1' } : {});

beforeEach(() => {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ScriptedSocket;
  ScriptedSocket.handler = handler;
});
afterEach(() => {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = real;
});

async function openPage(): Promise<{ client: CdpClient; page: PageDriver }> {
  const client = await CdpClient.connect('ws://x');
  const page = await PageDriver.open(client, { width: 800, height: 600 });
  return { client, page };
}

describe('waiting for events', () => {
  it('releases the listener and the timer when the caller stops waiting, and rejects once, handled', async () => {
    const client = await CdpClient.connect('ws://x');
    const stop = new AbortController();
    const waited = client.waitForEvent(() => false, 60_000, 'a load', stop.signal);
    const outcome = waited.then(
      () => 'resolved',
      (e: Error) => e.message,
    );
    stop.abort();
    expect(await outcome).toMatch(/stopped waiting for a load/);
    // Nothing is left listening: an event after the abort changes nothing.
    ScriptedSocket.last.event('Page.loadEventFired', {});
  });

  it('an already aborted signal rejects at once', async () => {
    const client = await CdpClient.connect('ws://x');
    const stop = new AbortController();
    stop.abort();
    await expect(client.waitForEvent(() => true, 1000, 'x', stop.signal)).rejects.toThrow(/stopped waiting/);
  });

  it('still resolves with the event when it comes', async () => {
    const client = await CdpClient.connect('ws://x');
    const waited = client.waitForEvent((e) => e.method === 'Page.loadEventFired', 1000, 'a load', new AbortController().signal);
    ScriptedSocket.last.event('Page.loadEventFired', { timestamp: 1 });
    await expect(waited).resolves.toMatchObject({ method: 'Page.loadEventFired' });
  });
});

describe('navigation', () => {
  it('a failed navigation rejects with the browser\'s message and leaves no dangling rejection', async () => {
    const { page } = await openPage();
    ScriptedSocket.handler = (method) => (method === 'Page.navigate' ? { errorText: 'net::ERR_CONNECTION_REFUSED' } : handler(method, {}));
    await expect(page.goto('http://127.0.0.1:1/')).rejects.toBeInstanceOf(SmokeFailure);
    await expect(page.goto('http://127.0.0.1:1/')).rejects.toThrow(/ERR_CONNECTION_REFUSED/);
    // The load waiter of each failed goto was cancelled and handled: a late event and a macrotask turn raise nothing.
    ScriptedSocket.last.event('Page.loadEventFired', {});
    await new Promise((r) => setTimeout(r, 20));
  });

  it('a command that fails after the waiter is set up (a reload) leaves no dangling rejection either', async () => {
    const { page } = await openPage();
    ScriptedSocket.handler = (method) => {
      if (method === 'Page.reload') throw new Error('the browser went away');
      return handler(method, {});
    };
    await expect(page.reload()).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 20));
  });

  it('a navigation that loads resolves', async () => {
    const { page } = await openPage();
    ScriptedSocket.handler = (method) => {
      if (method === 'Page.navigate') queueMicrotask(() => ScriptedSocket.last.event('Page.loadEventFired', { timestamp: 1 }));
      return handler(method, {});
    };
    await expect(page.goto('http://127.0.0.1:1/')).resolves.toBeUndefined();
  });
});
