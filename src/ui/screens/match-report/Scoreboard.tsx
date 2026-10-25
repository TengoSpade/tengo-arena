/** Scoreboard hero: crests, score, result line, round pips and the MVP strip (04 ui-report §1). */
import type { ContentDB } from '../../../core/content';
import type { Fixture, GameState, MatchReport, MatchResult } from '../../../core/model';
import { isRoundId, roundName } from '../league/lib/calendar';
import { Crest, clubName, clubVenue } from '../league/lib/club';
import { fmtInt, fmtMoney, fmtTicks } from '../league/lib/format';
import { href } from '../league/lib/store';
import { ClassTag, Portrait } from '../league/lib/ui';
import { other, type FighterInfo, type Perspective } from './analysis';
import { t } from './text';

function kindLine(state: GameState, content: ContentDB, report: MatchReport, fixture: Fixture | undefined): string {
  const tierId = fixture?.tierId ?? state.clubs[report.home.clubId]?.tierId;
  const tier = tierId ? content.tiers.get(tierId) : undefined;
  const bestOf = fixture?.bestOf ?? report.rounds.length;
  if (report.stage === 'league') {
    return t('kind.league', { tier: tier?.name ?? '', mw: fixture?.matchweek ?? '', bestOf });
  }
  return t('kind.reckoning', { tournament: tier?.tournamentName ?? '', round: isRoundId(report.stage) ? roundName(report.stage) : report.stage, bestOf });
}

function resultLine(_state: GameState, content: ContentDB, report: MatchReport, persp: Perspective, fixture: Fixture | undefined): string {
  if (!persp.involved) return t('result.wins', { club: clubName(_state, report.winnerClubId) });
  const won = report.winnerClubId === persp.usClubId;
  const parts = [won ? t('result.won') : t('result.lost')];
  if (report.stage === 'league') {
    const key = `${report.score[persp.usSide]}-${report.score[other(persp.usSide)]}` as keyof typeof content.leagues.standings.pointsByResult;
    const pts = content.leagues.standings.pointsByResult[key] ?? 0;
    parts.push(t('result.points', { sign: pts > 0 ? '+' : '', n: pts }));
  } else {
    const tier = fixture ? content.tiers.get(fixture.tierId) : undefined;
    const rounds = content.leagues.tournament.rounds;
    const i = rounds.findIndex((r) => r.id === report.stage);
    if (won && i === rounds.length - 1) parts.push(t('result.champion', { tournament: tier?.tournamentName ?? '' }));
    else if (won && rounds[i + 1]) parts.push(t('result.through', { round: isRoundId(rounds[i + 1]!.id) ? roundName(rounds[i + 1]!.id as never).toLowerCase() : rounds[i + 1]!.id }));
    else if (!won) parts.push(t('result.out', { tournament: tier?.tournamentName ?? '' }));
  }
  const gate = report.aftermath.gold.find((g) => g.clubId === persp.usClubId && g.reason === 'gate');
  if (gate) parts.push(t('result.gate', { amount: fmtMoney(gate.amount, content) }));
  return parts.join(' · ');
}

function sideRecord(_state: GameState, content: ContentDB, report: MatchReport, persp: Perspective, side: 'home' | 'away', fixture: Fixture | undefined): string {
  const clubId = report[side].clubId;
  if (persp.involved && clubId === persp.usClubId) return side === 'home' ? t('side.homeYou') : t('side.awayYou');
  if (fixture?.venueId) {
    const venue = content.venues.get(fixture.venueId)?.name ?? '';
    return side === 'home' ? t('side.neutralHome', { venue }) : t('side.neutralAway', { venue });
  }
  const city = clubVenue(content, clubId)?.city ?? '';
  return side === 'home' ? t('side.home', { city }) : t('side.away', { city });
}

export function Scoreboard({
  state,
  content,
  report,
  result,
  fixture,
  persp,
  infos,
}: {
  state: GameState;
  content: ContentDB;
  report: MatchReport;
  result: MatchResult | null;
  fixture: Fixture | undefined;
  persp: Perspective;
  infos: FighterInfo[];
}) {
  const tickMs = content.combat.tick.tickMs;
  const home = state.clubs[report.home.clubId];
  const away = state.clubs[report.away.clubId];
  const winnerSide = report.winnerClubId === report.home.clubId ? 'home' : 'away';
  const won = persp.involved && report.winnerClubId === persp.usClubId;
  const outcome = persp.involved ? (won ? t('result.won') : t('result.lost')) : t('result.wins', { club: clubName(state, report.winnerClubId) });
  const mvp = infos.find((f) => f.id === report.mvpFighterId) ?? null;
  const mvpFighter = mvp ? state.fighters[mvp.id] : undefined;
  const ms = mvp?.recap?.stats;
  const overtimeAt = content.combat.overtime.startS * (1000 / tickMs);
  return (
    <section class="panel panel--hero report-hero" aria-labelledby="h-score" data-testid="scoreboard">
      <h1 class="u-sr-only" id="h-score">
        {t('h1', { home: clubName(state, report.home.clubId), hs: report.score.home, away: clubName(state, report.away.clubId), as: report.score.away, outcome })}
      </h1>
      <div class="scoreboard">
        <div class="fixture__side">
          <Crest club={home} size="lg" />
          <div class="fixture__club">
            <span class="fixture__name">{clubName(state, report.home.clubId)}</span>
            <span class="fixture__record">{sideRecord(state, content, report, persp, 'home', fixture)}</span>
          </div>
        </div>
        <div class="fixture__center">
          <span class="fixture__kind">{kindLine(state, content, report, fixture)}</span>
          <span class="scoreboard__score" aria-hidden="true">
            <span class={winnerSide === 'home' ? 'is-win' : undefined}>{report.score.home}</span>
            <span class="scoreboard__dash">–</span>
            <span class={winnerSide === 'away' ? 'is-win' : undefined}>{report.score.away}</span>
          </span>
          <span class={persp.involved && !won ? 'scoreboard__result report-result--lost' : 'scoreboard__result'} data-testid="result-line">
            {resultLine(state, content, report, persp, fixture)}
          </span>
        </div>
        <div class="fixture__side fixture__side--away">
          <Crest club={away} size="lg" />
          <div class="fixture__club">
            <span class="fixture__name">{clubName(state, report.away.clubId)}</span>
            <span class="fixture__record">{sideRecord(state, content, report, persp, 'away', fixture)}</span>
          </div>
        </div>
      </div>
      <div class="round-pips report-pips">
        {report.rounds.map((r) => {
          const rr = result?.rounds.find((x) => x.round === r.round);
          const standing = rr ? rr.survivors[r.winner] : null;
          const time = fmtTicks(r.durationTicks, tickMs);
          const usWon = r.winner === persp.usSide;
          const main = persp.involved ? t(usWon ? 'pip.won' : 'pip.lost', { time }) : t(r.winner === 'home' ? 'pip.homeWon' : 'pip.awayWon', { time });
          const sub = r.endReason === 'time-limit' ? t('pip.timeCap') : r.durationTicks > overtimeAt ? t('pip.overtime') : standing !== null ? t('pip.standing', { n: standing }) : '';
          const extra =
            (r.endReason === 'time-limit' && r.tiebreakStep ? t('pip.tipTiebreak', { step: t(`tiebreak.${r.tiebreakStep}`) }) : '') +
            (r.durationTicks > overtimeAt ? t('pip.tipOvertime', { start: fmtTicks(overtimeAt, tickMs) }) : '');
          const tip = t('pip.tip', {
            n: r.round,
            outcome: persp.involved ? (usWon ? t('result.won').toLowerCase() : t('result.lost').toLowerCase()) : t('result.wins', { club: clubName(state, report[r.winner].clubId) }),
            time,
            reason: t(`reason.${r.endReason}`),
            standing: standing ?? '?',
            extra,
          });
          return (
            <div key={r.round} class="round-pip" data-winner={usWon ? 'us' : 'them'} tabIndex={0} data-tip={tip} aria-label={tip}>
              <span>{t('tabs.round', { n: r.round })}</span>
              <strong>{main}</strong>
              <span>{sub}</span>
            </div>
          );
        })}
      </div>
      {mvp && mvpFighter && ms && (
        <div class="mvp" data-testid="mvp">
          <span class="mvp__label">
            <span class="icon icon--sm" data-icon="star" aria-hidden="true" />
            {t('mvp')}
          </span>
          <Portrait content={content} fighter={mvpFighter} size="sm" />
          <div class="entity__stack">
            <a class="entity__name" href={href(`fighter/${encodeURIComponent(mvp.id)}`)}>
              {mvpFighter.name.full}
            </a>
            <span class="entity__sub">
              <ClassTag content={content} classId={mvpFighter.classId} /> · {mvp.row === 'front' ? t('row.front') : t('row.back')} · {clubName(state, result?.fighterStats[mvp.id]?.clubId ?? report.winnerClubId)}
            </span>
          </div>
          <div class="l-cluster l-cluster--lg u-sm report-mvp-stats">
            <span>
              <strong class="u-num">{ms.downsInflicted}</strong> <span class="u-muted">{t('mvp.downs')}</span>
            </span>
            <span>
              <strong class="u-num">{fmtInt(ms.damageDealt)}</strong> <span class="u-muted">{t('mvp.damage')}</span>
            </span>
            {ms.healingDone > 0 && (
              <span>
                <strong class="u-num">{fmtInt(ms.healingDone)}</strong> <span class="u-muted">{t('mvp.healing')}</span>
              </span>
            )}
            {ms.shieldingDone > 0 && (
              <span>
                <strong class="u-num">{fmtInt(ms.shieldingDone)}</strong> <span class="u-muted">{t('mvp.shielding')}</span>
              </span>
            )}
            <span>
              <strong class="u-num">{ms.downsSuffered}</strong> <span class="u-muted">{ms.downsSuffered === 1 ? t('mvp.downedOne') : t('mvp.downed')}</span>
            </span>
          </div>
          <span class="l-push u-xs u-faint term" tabIndex={0} data-tip={t('mvp.howTip')}>
            {t('mvp.how')}
          </span>
        </div>
      )}
    </section>
  );
}
