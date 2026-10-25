import { en, type TextKey } from './en';

export type { TextKey };

/** Look up UI copy. Unknown keys render the key itself so gaps are visible, not blank. */
export function t(key: TextKey, params?: Record<string, string | number>): string {
  let text: string = en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}
