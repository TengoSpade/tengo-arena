/**
 * Player settings record (05 §5: across careers, outside saves). Stored in
 * localStorage in the browser; the desktop build (M7) may swap this for a
 * file. Storage is optional: failures fall back to defaults silently.
 */
const KEY = 'arena-league.settings.v1';

export function readSettingsRecord(): Record<string, unknown> | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function writeSettingsRecord(record: Record<string, unknown>): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(record));
  } catch {
    /* optional */
  }
}
