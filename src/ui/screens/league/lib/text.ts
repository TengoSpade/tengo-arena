/**
 * Tiny copy-table helper for WP7 screens. Each screen keeps its own
 * `text.ts` (src/ui/README: "screens keep their own text.ts"); generic
 * interface wording only. Theme names (clubs, tiers, classes, currency)
 * always come from content.
 */
export type TextTable = Readonly<Record<string, string>>;

/** Returns t(key, params) for a table. Unknown params stay visible as {name}. */
export function makeText<T extends TextTable>(table: T): (key: keyof T & string, params?: Record<string, string | number>) => string {
  return (key, params) => {
    let text: string = table[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
    }
    return text;
  };
}

/** Copy shared by several WP7 screens (round names, empty states). */
export const COMMON = {
  'round.quarterfinal': 'Quarterfinal',
  'round.semifinal': 'Semifinal',
  'round.final': 'Final',
  'week.seasonEnd': 'Season end',
  'noCareer.title': 'No career loaded',
  'noCareer.text': 'Start a new career or load a save to see this screen.',
  'noCareer.new': 'New career',
  'noCareer.load': 'Load a save',
  'unavailable.title': 'Not available yet',
  'unavailable.text': 'This part of the game is still being built ({what}).',
} as const;

export const tc = makeText(COMMON);
