/**
 * Trials Day in plain words (playtest ticket AL-R001-T002), shared by Market, Home, the calendar and
 * club select. Rules (03 sys-youth-intake, sys-transfers "Trials Day", sys-contracts rookie scale,
 * D-P): in preseason week P1 each club has exclusive first pick of the rookies assigned to it (in
 * season 1 exactly one per club; later seasons an even share, the rest by lot). Signing is answered
 * at once, costs no signing fee, the ask is capped at the rookie scale (1.25 × the tier's minimum
 * wage), and the length is 1-3 seasons. Unsigned rookies join the free-agent pool at the P1 week
 * processing.
 */
import type { ClubId, Fighter, GameState } from '../../../../core/model';

export const TRIALS = {
  name: 'Trials Day',
  /** The whole rule in one paragraph (tooltips, the Market card). */
  explain:
    'Trials Day (preseason week P1): your club gets first pick of the young rookies assigned to it from the trials (in season 1, one per club). Signing is instant, costs no signing fee and the wage is capped at the rookie scale; you choose a 1–3 season contract. Rookies you leave unsigned join the free-agent pool when P1 is processed.',
  short: 'Your Trials Day rookie is exclusive to you this week only.',
} as const;

/** The club's unsigned Trials Day rookies (signing removes them from the list). */
export function trialsRookiesOf(state: GameState, clubId: ClubId): Fighter[] {
  return (state.market.trialsRookies[clubId] ?? []).map((id) => state.fighters[id]).filter((f): f is Fighter => Boolean(f));
}

/** P1 of the preseason: the only week the trials rookies can be signed. */
export function isTrialsWeek(state: GameState): boolean {
  return state.calendar.phase === 'preseason' && state.calendar.weekIndex === 1;
}
