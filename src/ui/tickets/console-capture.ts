/**
 * The last 50 console errors and warnings, plus uncaught errors and rejections, for playtest
 * tickets. Installed once at app start; the wrapped console methods log first (DevTools links point
 * at the real caller: vite.config.ts lists this file in `server.sourcemapIgnoreList`), then the
 * entry is recorded, cheaply (depth, key and length caps) and never at the cost of the log.
 */
export interface ConsoleEntry {
  level: 'error' | 'warn';
  message: string;
  at: string;
}

const LIMIT = 50;
const MAX_TEXT = 2000;
const entries: ConsoleEntry[] = [];
let installed = false;

/** A bounded copy for JSON: depth 3, 20 keys or items per level, 200 characters per string. */
function brief(v: unknown, depth = 0): unknown {
  if (typeof v === 'string') return v.length > 200 ? `${v.slice(0, 200)}…` : v;
  if (v === null || typeof v === 'number' || typeof v === 'boolean' || v === undefined) return v;
  if (typeof v !== 'object') return String(v); // bigint, symbol, function
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (depth >= 3) return Array.isArray(v) ? `[${v.length} items]` : '{…}';
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => brief(x, depth + 1));
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v).slice(0, 20)) {
    try {
      out[k] = brief((v as Record<string, unknown>)[k], depth + 1);
    } catch {
      out[k] = '?';
    }
  }
  return out;
}

export function entryText(args: readonly unknown[]): string {
  let s = '';
  for (const a of args) {
    if (s.length >= MAX_TEXT) break;
    s += (s ? ' ' : '') + (typeof a === 'string' ? a : a instanceof Error ? (a.stack ?? `${a.name}: ${a.message}`) : JSON.stringify(brief(a)));
  }
  return s.slice(0, MAX_TEXT);
}

function push(level: ConsoleEntry['level'], args: readonly unknown[]): void {
  try {
    entries.push({ level, message: entryText(args), at: new Date().toISOString() });
    if (entries.length > LIMIT) entries.shift();
  } catch {
    // Recording must never break logging.
  }
}

export function installConsoleCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const wrap =
    (level: ConsoleEntry['level'], original: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      original(...args);
      push(level, args);
    };
  console.error = wrap('error', console.error.bind(console));
  console.warn = wrap('warn', console.warn.bind(console));
  window.addEventListener('error', (e) => push('error', [e.error ?? e.message]));
  window.addEventListener('unhandledrejection', (e) => push('error', ['Unhandled rejection:', e.reason]));
}

export function consoleEntries(): readonly ConsoleEntry[] {
  return [...entries];
}
