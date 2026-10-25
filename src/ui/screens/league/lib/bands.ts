/**
 * Band helper (04 notes for implementers, TUNABLE): attributes 1-5 -> 1,
 * 6-10 -> 2, 11-15 -> 3, 16-20 -> 4; rating and potential 1-39 -> 1,
 * 40-54 -> 2, 55-69 -> 3, 70-100 -> 4. One helper for every WP7 screen.
 */
export type Band = 1 | 2 | 3 | 4;

export const STAT_BANDS = [5, 10, 15] as const;
export const RATING_BANDS = [39, 54, 69] as const;

export function statBand(value: number): Band {
  if (value <= STAT_BANDS[0]) return 1;
  if (value <= STAT_BANDS[1]) return 2;
  if (value <= STAT_BANDS[2]) return 3;
  return 4;
}

export function ratingBand(value: number): Band {
  if (value <= RATING_BANDS[0]) return 1;
  if (value <= RATING_BANDS[1]) return 2;
  if (value <= RATING_BANDS[2]) return 3;
  return 4;
}

/** Potential 1-100 as five stars in halves: [full, half, empty] counts. */
export function starParts(potential: number): { full: number; half: boolean; empty: number } {
  const halves = Math.max(0, Math.min(10, Math.round(potential / 10)));
  const full = Math.floor(halves / 2);
  const half = halves % 2 === 1;
  return { full, half, empty: 5 - full - (half ? 1 : 0) };
}
