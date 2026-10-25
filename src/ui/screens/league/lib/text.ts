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

/** Copy shared by several WP7 screens (calendar, results, rounds). */
export const COMMON = {
  'round.quarterfinal': 'Quarterfinal',
  'round.semifinal': 'Semifinal',
  'round.final': 'Final',
  'round.quarterfinal.plural': 'Quarterfinals',
  'round.semifinal.plural': 'Semifinals',
  'round.final.plural': 'Final',
  'week.matchweek': 'Matchweek {n}',
  'week.matchweek.short': 'MW{n}',
  'week.preseason': 'Preseason week {id}',
  'week.tournament': '{tournament} {round}',
  'week.seasonEnd': 'Season end',
  'result.won': 'Won',
  'result.lost': 'Lost',
  'result.W': 'W',
  'result.L': 'L',
  'side.home': 'Home',
  'side.away': 'Away',
  'venue.neutral': 'Neutral venue',
  'noCareer.title': 'No career loaded',
  'noCareer.text': 'Start a new career or load a save to see this screen.',
  'noCareer.new': 'New career',
  'noCareer.load': 'Load a save',
  'unavailable.title': 'Not available yet',
  'unavailable.text': 'This part of the game is still being built ({what}).',
  'hiredBlade': 'Hired blade',
  'hiredBlade.tip': 'A one-match fighter assigned by the Charter Registry because fewer than 5 fit fighters were available. Outside the roster cap.',
  'captain': 'Captain',
  'viceCaptain': 'VC',
  'mvp': 'MVP',
  'tbd': 'To be decided',
} as const;

export const tc = makeText(COMMON);
