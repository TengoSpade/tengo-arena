/**
 * Where the player lands after a week with his match (Frame's Continue, and Continue on the
 * between-round screen once the match is over): the report when pacing stops there, else Home with a
 * result toast that opens it.
 */
import type { ClubId, GameState, WeekReport } from '../../core/model';
import { showToast } from '../components/Toast';
import { pacingStops, settings } from '../store/settings';
import { t } from '../text';
import { navigate } from './router';

export function afterMatch(state: GameState | null, report: WeekReport): void {
  const clubId = state?.playerClubId;
  const fixtureId = report.playerFixtureId;
  if (!state || !clubId || !fixtureId) return;
  const result = state.results[fixtureId];
  const stops = pacingStops(settings.value);
  const won = result?.winnerClubId === clubId;
  const injured = Object.values(state.fighters).some(
    (f) => f.clubId === clubId && f.injury && f.injury.since.season === report.season && f.injury.since.weekIndex === report.weekIndex,
  );
  const open = stops.reportAlways || (!won && stops.reportOnLoss) || (injured && stops.reportOnInjury);
  if (open) {
    navigate(`#/match/${encodeURIComponent(fixtureId)}`);
    return;
  }
  navigate('#/home');
  if (result) {
    const home = result.homeClubId === clubId;
    const other = state.clubs[(home ? result.awayClubId : result.homeClubId) as ClubId];
    const score = home ? `${result.score.home}–${result.score.away}` : `${result.score.away}–${result.score.home}`;
    showToast({
      title: t(won ? 'continue.resultWon' : 'continue.resultLost', { score, where: home ? t('continue.vs') : t('continue.at'), club: other?.name ?? '' }),
      kind: won ? 'good' : 'info',
      action: { label: t('continue.openReport'), onClick: () => navigate(`#/match/${encodeURIComponent(fixtureId)}`) },
    });
  }
}
