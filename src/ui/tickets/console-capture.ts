/**
 * The last 50 console errors and warnings, plus uncaught errors and rejections, for playtest
 * tickets. Installed once at app start; the wrapped console methods still log normally.
 */
export interface ConsoleEntry {
  level: 'error' | 'warn';
  message: string;
  at: string;
}

const LIMIT = 50;
const entries: ConsoleEntry[] = [];
let installed = false;

function text(args: readonly unknown[]): string {
  return args
    .map((a) => (a instanceof Error ? `${a.name}: ${a.message}${a.stack ? `\n${a.stack}` : ''}` : typeof a === 'string' ? a : safeJson(a)))
    .join(' ')
    .slice(0, 2000);
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function push(level: ConsoleEntry['level'], message: string): void {
  entries.push({ level, message, at: new Date().toISOString() });
  if (entries.length > LIMIT) entries.shift();
}

export function installConsoleCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const wrap =
    (level: ConsoleEntry['level'], original: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      push(level, text(args));
      original(...args);
    };
  console.error = wrap('error', console.error.bind(console));
  console.warn = wrap('warn', console.warn.bind(console));
  window.addEventListener('error', (e) => push('error', text([e.error ?? e.message])));
  window.addEventListener('unhandledrejection', (e) => push('error', `Unhandled rejection: ${text([e.reason])}`));
}

export function consoleEntries(): readonly ConsoleEntry[] {
  return [...entries];
}
