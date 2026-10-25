/**
 * Tiny copy-table helper for WP7 screens. Each screen keeps its own
 * `text.ts` (src/ui/README: "screens keep their own text.ts"); generic
 * interface wording only. Theme names (clubs, tiers, classes, currency)
 * always come from content.
 */
import { format } from '../../../text';

export type TextTable = Readonly<Record<string, string>>;

/** Returns t(key, params) for a table. Unknown params stay visible as {name}. */
export function makeText<T extends TextTable>(table: T): (key: keyof T & string, params?: Record<string, string | number>) => string {
  return (key, params) => format(table[key] ?? key, params);
}

/** Copy shared by several WP7 screens (round names, empty states). */
export const COMMON = {
  'round.quarterfinal': 'Quarterfinal',
  'alumni.tip': '{name} left the league in season {season}. His record stays in history.',
  'round.semifinal': 'Semifinal',
  'round.final': 'Final',
  'week.seasonEnd': 'Season end',
  'week.seasonStart': 'Season start',
  'noCareer.title': 'No career loaded',
  'noCareer.text': 'Start a new career or load a save to see this screen.',
  'noCareer.new': 'New career',
  'noCareer.load': 'Load a save',
  'unavailable.title': 'Not available yet',
  'unavailable.text': 'This part of the game is still being built ({what}).',
} as const;

export const tc = makeText(COMMON);
