/**
 * ui-report · Match report (04 §6.3, mockup match-report.html; O12, P-22).
 * In M1 this screen is how the owner experiences every fight: scoreboard and
 * round pips, MVP, "What decided it" traces, the box score, rule recaps with
 * never-fired warnings, key moments, downs (death summaries), injuries and
 * XP. Read-only; the report comes from the store (core/game buildMatchReport).
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ScreenProps } from '../../app/routes';
import type { FighterId, FixtureId, MatchReport } from '../../../core/model';
import { weekTitle } from '../league/lib/calendar';
import { clubShort } from '../league/lib/club';
import { href, go, useCareer, type Career } from '../league/lib/store';
import { showToast } from '../../components';
import { Callout, Empty, NoCareer, Tabs } from '../league/lib/ui';
import { adjacentReports, eventLogText, fighterInfos, moments, perspective } from './analysis';
import { BoxScore } from './BoxScore';
import { Aftermath, Downs, Moments } from './Moments';
import { Recaps } from './Recaps';
import { Scoreboard } from './Scoreboard';
import { Traces } from './Traces';
import { t } from './text';
import './match-report.css';

export default function MatchReportScreen({ params }: ScreenProps) {
  const career = useCareer();
  if (!career) return <NoCareer testId="screen-match-report" />;
  const fixtureId = (params.fixtureId ?? '') as FixtureId;
  return <Report career={career} fixtureId={fixtureId} />;
}

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function Report({ career, fixtureId }: { career: Career; fixtureId: FixtureId }) {
  const { store, game } = career;
  const built = useMemo(() => store.matchReport(fixtureId), [store, game, fixtureId]);
  const fixture = game.fixtures[fixtureId];
  if (!built.ok) {
    const notPlayed = fixture && fixture.status !== 'played';
    return (
      <section class="page" data-testid="screen-match-report">
        <Empty icon="warning" title={t('error.title')} text={notPlayed ? t('error.notPlayed') : `${built.error.message} (${built.error.code})`}>
          <a class="btn" href={href('fixtures')}>
            {t('error.back')}
          </a>
        </Empty>
      </section>
    );
  }
  return <ReportBody career={career} fixtureId={fixtureId} report={built.value} />;
}

function ReportBody({ career, fixtureId, report }: { career: Career; fixtureId: FixtureId; report: MatchReport }) {
  const { game, content, club } = career;
  const [round, setRound] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<FighterId | null>(null);
  const result = game.results[fixtureId] ?? null;
  const fixture = game.fixtures[fixtureId];
  const persp = perspective(report, club.id);
  const infos = useMemo(() => fighterInfos(report, result, persp), [report, result, persp.usSide]);
  const all = useMemo(() => moments(report, result, infos, persp, game, content), [report, result, infos, game, content]);
  const adj = adjacentReports(game, fixtureId);
  const tickMs = content.combat.tick.tickMs;

  useEffect(() => {
    setRound(null);
    setFocusId(null);
  }, [fixtureId]);

  // 04 ui-report shortcuts: 1-5 round tabs (0 whole match), ← → previous / next report.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        const n = Number(e.key);
        if (n === 0 || n <= report.rounds.length) {
          e.preventDefault();
          e.stopPropagation();
          setRound(n === 0 ? null : n);
        }
      } else if (e.key === 'ArrowLeft' && adj.prev && !(e.target as HTMLElement | null)?.closest?.('[role="tablist"]')) {
        e.stopPropagation();
        go(`match/${encodeURIComponent(adj.prev)}`);
      } else if (e.key === 'ArrowRight' && adj.next && !(e.target as HTMLElement | null)?.closest?.('[role="tablist"]')) {
        e.stopPropagation();
        go(`match/${encodeURIComponent(adj.next)}`);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [report.rounds.length, adj.prev, adj.next]);

  const opponent = persp.involved ? clubShort(game, persp.themClubId) : '';
  const tierId = fixture?.tierId ?? null;
  const week = weekTitle(content, fixture?.weekIndex ?? 0, tierId);
  const crumb = persp.involved
    ? t('crumb.match', { week, opponent })
    : t('crumb.neutral', { week, home: clubShort(game, report.home.clubId), away: clubShort(game, report.away.clubId) });

  const copyLog = async () => {
    const text = eventLogText(report, all, game, tickMs);
    try {
      await navigator.clipboard.writeText(text);
      showToast({ kind: 'good', title: t('action.logCopied'), sub: t('action.logCopiedSub', { n: text.split('\n').length }) });
    } catch {
      showToast({ kind: 'bad', title: t('action.logFailed') });
    }
  };

  const tabs = [
    { value: 'all', label: t('tabs.whole') },
    ...report.rounds.map((r) => ({
      value: String(r.round),
      label: t('tabs.round', { n: r.round }),
      count: r.winner === persp.usSide ? 'W' : 'L',
    })),
  ];

  return (
    <section class="page report" data-testid="screen-match-report">
      <div class="l-row report-top">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          <a href={href('fixtures')}>{t('crumb.fixtures')}</a> <span class="icon icon--sm" data-icon="chevron-right" aria-hidden="true" /> <span>{crumb}</span>
        </nav>
        <div class="l-push l-cluster l-cluster--xs">
          <a class={adj.prev ? 'btn btn--sm btn--ghost' : 'btn btn--sm btn--ghost is-disabled'} href={adj.prev ? href(`match/${encodeURIComponent(adj.prev)}`) : undefined} aria-disabled={adj.prev ? undefined : 'true'} data-tip="←">
            <span class="icon" data-icon="chevron-left" aria-hidden="true" />
            {t('action.prev')}
          </a>
          <a class={adj.next ? 'btn btn--sm btn--ghost' : 'btn btn--sm btn--ghost is-disabled'} href={adj.next ? href(`match/${encodeURIComponent(adj.next)}`) : undefined} aria-disabled={adj.next ? undefined : 'true'} data-tip="→">
            {t('action.next')}
            <span class="icon" data-icon="chevron-right" aria-hidden="true" />
          </a>
          <button class="btn btn--sm btn--ghost" type="button" aria-disabled="true" data-tip={t('action.replayTip')}>
            <span class="icon" data-icon="play" aria-hidden="true" />
            {t('action.replay')}
          </button>
          <button class="btn btn--sm btn--ghost" type="button" data-tip={t('action.logTip')} onClick={copyLog} disabled={!report.timelineAvailable}>
            <span class="icon" data-icon="scroll" aria-hidden="true" />
            {t('action.log')}
          </button>
        </div>
      </div>

      <Scoreboard state={game} content={content} report={report} result={result} fixture={fixture} persp={persp} infos={infos} />

      <div class="report-tabs">
        <Tabs
          label={t('tabs.label')}
          idPrefix="report-round"
          value={round === null ? 'all' : String(round)}
          tabs={tabs}
          onChange={(v) => setRound(v === 'all' ? null : Number(v))}
        />
        <span class="report-tabs__hint u-xs u-faint">{t('tabs.hint', { n: report.rounds.length })}</span>
      </div>

      <div class="l-grid report-grid">
        <div class="span-8 l-stack">
          {report.timelineAvailable ? (
            <Traces state={game} content={content} report={report} infos={infos} persp={persp} focusId={focusId} />
          ) : (
            <Callout kind="warn" title={t('missing.title')}>
              {t('missing.text')}
            </Callout>
          )}
          <BoxScore state={game} content={content} report={report} result={result} infos={infos} persp={persp} round={round} focusId={focusId} onFocus={setFocusId} />
          <Recaps state={game} content={content} infos={infos} persp={persp} focusId={focusId} />
        </div>
        <div class="span-4 l-stack">
          {report.timelineAvailable && (
            <Moments state={game} content={content} report={report} all={all} persp={persp} round={round} focusId={focusId} onFocus={setFocusId} />
          )}
          <Downs state={game} content={content} infos={infos} persp={persp} round={round} focusId={focusId} />
          <Aftermath state={game} content={content} report={report} infos={infos} persp={persp} />
        </div>
      </div>
    </section>
  );
}
