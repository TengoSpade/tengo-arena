import { en, type TextKey } from './en';

export type { TextKey };

function fill(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  let out = text;
  for (const [name, value] of Object.entries(params)) out = out.split(`{${name}}`).join(String(value));
  return out;
}

/** Look up UI copy. Unknown keys render the key itself so gaps are visible, not blank. */
export function t(key: TextKey, params?: Record<string, string | number>): string {
  return fill(en[key] ?? key, params);
}

export function hasText(key: string): key is TextKey {
  return Object.prototype.hasOwnProperty.call(en, key);
}

/** Copy for a runtime key (error and blocker codes); falls back to `fallback` when the table has no entry. */
export function tKey(key: string, fallback: TextKey, params?: Record<string, string | number>): string {
  return hasText(key) ? t(key, params) : t(fallback, params);
}

/** Fill a screen-local template ("{n} of {cap}"). */
export function format(template: string, params?: Record<string, string | number>): string {
  return fill(template, params);
}
