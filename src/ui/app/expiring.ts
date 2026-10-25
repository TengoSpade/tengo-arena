import type { ClubContext } from '../store/views';

/** Player fighters whose contract ends with this season, not renewed and not retiring. */
export function expiringUnrenewed(ctx: ClubContext | null) {
  if (!ctx) return [];
  const season = ctx.state.calendar.season;
  return ctx.roster.filter((f) => f.contract && f.contract.endSeason <= season && !f.contract.next && !f.finalSeason);
}
