/**
 * A minimal Chrome DevTools Protocol client over Node's built-in WebSocket (Node 22+; zero dependencies).
 * One browser-level connection; pages are driven through flattened sessions (`sessionId` on each message).
 */

export interface CdpEvent {
  method: string;
  params: Record<string, unknown>;
  sessionId?: string;
}

export class CdpError extends Error {
  constructor(
    readonly method: string,
    readonly code: number,
    message: string,
  ) {
    super(`CDP ${method} failed (${code}): ${message}`);
    this.name = 'CdpError';
  }
}

interface Pending {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class CdpClient {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly handlers = new Set<(event: CdpEvent) => void>();
  private closedReason: string | null = null;

  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener('message', (ev) => this.onMessage(ev.data));
    ws.addEventListener('close', () => this.onClose('the DevTools connection closed'));
    ws.addEventListener('error', () => this.onClose('the DevTools connection failed'));
  }

  /** Connect to a `ws://` DevTools endpoint (the browser's, from /json/version or DevToolsActivePort). */
  static connect(url: string, timeoutMs = 10_000): Promise<CdpClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        reject(new Error(`no answer from the DevTools endpoint ${url} within ${timeoutMs} ms`));
        try {
          ws.close();
        } catch {
          /* already closed */
        }
      }, timeoutMs);
      ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve(new CdpClient(ws));
      });
      ws.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error(`could not open the DevTools endpoint ${url}`));
      });
    });
  }

  private onMessage(data: unknown): void {
    const text = typeof data === 'string' ? data : String(data);
    let msg: { id?: number; result?: unknown; error?: { code: number; message: string }; method?: string; params?: Record<string, unknown>; sessionId?: string };
    try {
      msg = JSON.parse(text) as typeof msg;
    } catch {
      return;
    }
    if (typeof msg.id === 'number') {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new CdpError(p.method, msg.error.code, msg.error.message));
      else p.resolve(msg.result ?? {});
      return;
    }
    if (msg.method) {
      const event: CdpEvent = { method: msg.method, params: msg.params ?? {}, ...(msg.sessionId ? { sessionId: msg.sessionId } : {}) };
      for (const h of [...this.handlers]) h(event);
    }
  }

  private onClose(reason: string): void {
    if (this.closedReason) return;
    this.closedReason = reason;
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error(`${reason} while waiting for ${p.method}`));
      this.pending.delete(id);
    }
  }

  get closed(): boolean {
    return this.closedReason !== null;
  }

  /** Send a command (to a page session when `sessionId` is given); rejects with CdpError, or on timeout. */
  send<T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}, sessionId?: string, timeoutMs = 30_000): Promise<T> {
    if (this.closedReason) return Promise.reject(new Error(`${this.closedReason}: cannot send ${method}`));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(id, { method, resolve: resolve as (v: unknown) => void, reject, timer });
      try {
        this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      } catch (e) {
        // A socket that cannot send: forget the request now, so its timer does not outlive it.
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  /** Subscribe to every event; returns the unsubscribe function. */
  on(handler: (event: CdpEvent) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Resolve with the first event for which `match` is true. Rejects on timeout, and when `signal` aborts (the caller no
   * longer needs the event: its listener and timer are released at once, so nothing is left running or rejecting later).
   */
  waitForEvent(match: (event: CdpEvent) => boolean, timeoutMs: number, what: string, signal?: AbortSignal): Promise<CdpEvent> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (): void => {
        settled = true;
        clearTimeout(timer);
        off();
        signal?.removeEventListener('abort', onAbort);
      };
      const off = this.on((e) => {
        if (settled || !match(e)) return;
        done();
        resolve(e);
      });
      const timer = setTimeout(() => {
        if (settled) return;
        done();
        reject(new Error(`timed out after ${timeoutMs} ms waiting for ${what}`));
      }, timeoutMs);
      const onAbort = (): void => {
        if (settled) return;
        done();
        reject(new Error(`stopped waiting for ${what}`));
      };
      if (signal?.aborted) onAbort();
      else signal?.addEventListener('abort', onAbort);
    });
  }

  close(): void {
    this.onClose('the DevTools connection was closed by the driver');
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
  }
}
