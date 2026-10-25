/** Minimal `--key value` / `--flag` argument parser for the headless CLIs. */
export function parseArgs(argv: readonly string[]): Map<string, string | true> {
  const out = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq > 0) {
      out.set(token.slice(2, eq), token.slice(eq + 1));
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out.set(token.slice(2), next);
      i++;
    } else {
      out.set(token.slice(2), true);
    }
  }
  return out;
}

export function intArg(args: Map<string, string | true>, key: string, fallback: number): number {
  const raw = args.get(key);
  if (raw === undefined || raw === true) return fallback;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`--${key} must be a non-negative integer, got "${raw}"`);
  return n;
}

export function stringArg(args: Map<string, string | true>, key: string, fallback: string): string {
  const raw = args.get(key);
  return raw === undefined || raw === true ? fallback : raw;
}
