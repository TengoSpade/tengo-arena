/**
 * ui-fixtures · Fixtures and results (04 §6.3, not mocked): our season (16
 * league fixtures plus the Reckoning, next fixture highlighted, results with
 * round scores, report links), by matchweek (all fixtures of a tier for a
 * chosen week, ← → to change week) and the calendar (P1-P4, MW1-MW16,
 * TW1-TW3 with markers). Read-only.
 */
import { useState } from 'preact/hooks';
import type { ScreenProps } from '../../app/routes';
import { useShortcuts } from '../../app/shortcuts';
import type { ContentDB } from '../../../core/content';
import type { ClubId, Fixture, GameState, TierId } from '../../../core/model';
import { DataTable, Icon, PageHeader, Panel, TabPanel, type Column } from '../../components';
import { weekDefAt, weekLong, weekShort, weekTitle } from '../league/lib/calendar';
import { TRIALS } from '../league/lib/trials';
import { ClubEntity, clubName, clubShort, clubVenue } from '../league/lib/club';
import { useWp7Engine } from '../league/lib/engine';
import { fmtPctBp, ordinal } from '../league/lib/format';
import { clubFixtures, leagueCompetition, nextFixture, opponentOf, roundLetters, tierFixturesOfWeek } from '../league/lib/season';
import { go, href, useCareer, type Career } from '../league/lib/store';
import { Empty, FormStrip, NoCareer, Segmented, Tabs } from '../league/lib/ui';
import { tryView } from '../league/lib/views';
import { t } from './text';
import './fixtures.css';

type Tab = 'season' | 'week' | 'calendar';

export default function FixturesScreen(_props: ScreenProps) {
  const career = useCareer();
  if (!career) return <NoCareer testId="screen-fixtures" />;
  return <Fixtures career={career} />;
}

function Fixtures({ career }: { career: Career }) {
  const { game, content, club } = career;
  const [tab, setTab] = useState<Tab>('season');
  const season = game.calendar.season;
  const mine = clubFixtures(game, club.id, season);
  const league = mine.filter((f) => f.stage === 'league');
  const played = mine.filter((f) => game.results[f.id]);
  const wins = played.filter((f) => game.results[f.id]!.winnerClubId === club.id).length;
  const next = nextFixture(game, club.id);
  const tier = content.tiers.get(club.tierId);
  const meta: string[] = [
    t('meta.matches', { n: league.length, home: league.filter((f) => f.homeClubId === club.id).length, away: league.filter((f) => f.awayClubId === club.id).length }),
    t('meta.record', { w: wins, l: played.length - wins }),
    next ? t('meta.next', { week: weekShort(content, next.weekIndex), club: clubShort(game, opponentOf(next, club.id)) }) : t('meta.done'),
  ];
  return (
    <section class="page" data-testid="screen-fixtures">
      <PageHeader eyebrow={t('eyebrow', { season, tier: tier?.name ?? '' })} title={t('title')} meta={meta} />
      <Tabs
        label={t('tabs.label')}
        idPrefix="fixtures"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'season', label: t('tabs.season') },
          { value: 'week', label: t('tabs.week') },
          { value: 'calendar', label: t('tabs.calendar') },
        ]}
      />
      <div class="fixtures-body">
        <TabPanel idPrefix="fixtures" id="season" selected={tab}>
          <OurSeason game={game} content={content} clubId={club.id} fixtures={mine} next={next} />
        </TabPanel>
        <TabPanel idPrefix="fixtures" id="week" selected={tab}>
          <ByWeek game={game} content={content} clubId={club.id} />
        </TabPanel>
        <TabPanel idPrefix="fixtures" id="calendar" selected={tab}>
          <CalendarStrip game={game} content={content} clubId={club.id} fixtures={mine} />
        </TabPanel>
      </div>
    </section>
  );
}

function useWingPositions(game: GameState, content: ContentDB, tierId: TierId): Map<ClubId, { pos: number; wing: string }> {
  const engine = useWp7Engine();
  const map = new Map<ClubId, { pos: number; wing: string }>();
  const comp = leagueCompetition(game, game.calendar.season, tierId);
  if (!comp) return map;
  const v = tryView(() =>
    comp.wings.map((w) => ({
      wing: content.leagues.wings.list.find((x) => x.id === w.wingId)?.name ?? String(w.wingId),
      rows: engine.standings(game, comp.id, w.wingId, content),
    })),
  );
  if (v.ok) for (const w of v.value) for (const r of w.rows) map.set(r.clubId, { pos: r.position, wing: w.wing });
  return map;
}

function venueText(game: GameState, content: ContentDB, f: Fixture): string {
  if (f.venueId) return content.venues.get(f.venueId)?.name ?? t('neutral');
  return clubVenue(content, f.homeClubId)?.arena ?? clubName(game, f.homeClubId);
}

function OurSeason({ game, content, clubId, fixtures, next }: { game: GameState; content: ContentDB; clubId: ClubId; fixtures: Fixture[]; next: Fixture | null }) {
  const positions = useWingPositions(game, content, game.clubs[clubId]!.tierId);
  const points = content.leagues.standings.pointsByResult as Record<string, number>;
  const pointsTable = Object.entries(points)
    .map(([score, pts]) => `${score.replace('-', '–')} ${pts}`)
    .join(' · ');
  const columns: Column<Fixture>[] = [
    {
      id: 'week',
      header: t('col.week'),
      cell: (f) => <span data-tip={weekLong(content, f.weekIndex, f.tierId)}>{weekShort(content, f.weekIndex)}</span>,
      sortValue: (f) => f.weekIndex,
      firstDir: 'asc',
      class: 'cell-tight',
    },
    {
      id: 'opponent',
      header: t('col.opponent'),
      fill: true,
      cell: (f) => {
        const opp = opponentOf(f, clubId);
        const p = positions.get(opp);
        return (
          <span class="l-row fixtures-opp">
            <ClubEntity state={game} clubId={opp} />
            {p && <span class="u-xs u-faint">{t('standing', { pos: ordinal(p.pos), wing: p.wing })}</span>}
            {f.wing === 'cross' && <span class="tag tag--outline">{t('cross')}</span>}
            {f.id === next?.id && <span class="tag tag--accent">{f.weekIndex === game.calendar.weekIndex ? t('thisWeek') : t('next')}</span>}
          </span>
        );
      },
      sortValue: (f) => clubName(game, opponentOf(f, clubId)),
    },
    {
      id: 'ha',
      header: t('col.ha'),
      cell: (f) => (f.venueId ? t('neutral') : f.homeClubId === clubId ? t('home') : t('away')),
      sortValue: (f) => (f.homeClubId === clubId ? 0 : 1),
    },
    { id: 'venue', header: t('col.venue'), class: 'col-mid', cell: (f) => <span class="u-muted">{venueText(game, content, f)}</span> },
    {
      id: 'result',
      header: t('col.result'),
      cell: (f) => {
        const r = game.results[f.id];
        if (!r) return <span class="u-faint">{t('notPlayed')}</span>;
        const side = r.homeClubId === clubId ? 'home' : 'away';
        const other = side === 'home' ? 'away' : 'home';
        const won = r.winnerClubId === clubId;
        return (
          <span class="l-row fixtures-result">
            <FormStrip form={[won ? 'W' : 'L']} />
            <strong class="u-num">
              {r.score[side]}–{r.score[other]}
            </strong>
          </span>
        );
      },
      sortValue: (f) => {
        const r = game.results[f.id];
        if (!r) return -99;
        const side = r.homeClubId === clubId ? 'home' : 'away';
        return r.score[side] - r.score[side === 'home' ? 'away' : 'home'];
      },
    },
    {
      id: 'rounds',
      header: t('col.rounds'),
      class: 'col-mid',
      cell: (f) => {
        const r = game.results[f.id];
        if (!r) return null;
        return <FormStrip form={roundLetters(r, clubId)} />;
      },
    },
    {
      id: 'points',
      header: t('col.points'),
      align: 'num',
      cell: (f) => {
        const r = game.results[f.id];
        if (!r || f.stage !== 'league') return <span class="u-faint">—</span>;
        const side = r.homeClubId === clubId ? 'home' : 'away';
        const key = `${r.score[side]}-${r.score[side === 'home' ? 'away' : 'home']}`;
        const pts = points[key] ?? 0;
        return (
          <span class={pts > 0 ? 'u-num' : 'u-num u-faint'} data-tip={t('tip.points', { score: key.replace('-', '–'), pts, table: pointsTable })}>
            {pts > 0 ? `+${pts}` : '0'}
          </span>
        );
      },
    },
    {
      id: 'report',
      header: <span class="u-sr-only">{t('col.report')}</span>,
      class: 'cell-tight',
      cell: (f) =>
        game.results[f.id] ? (
          <a class="btn btn--sm btn--ghost" href={href(`match/${encodeURIComponent(f.id)}`)} aria-label={t('reportAria', { match: `${weekShort(content, f.weekIndex)} ${clubShort(game, opponentOf(f, clubId))}` })}>
            <Icon name="scroll" />
            {t('report')}
          </a>
        ) : null,
    },
  ];
  return (
    <Panel title={t('season.title')} icon="fixtures" subtitle={t('season.subtitle', { n: fixtures.length })} body="flush">
      <DataTable
        label={t('season.title')}
        columns={columns}
        rows={fixtures}
        rowKey={(f) => f.id}
        variant={['compact']}
        defaultSort={{ column: 'week', dir: 'asc' }}
        rowClass={(f) => (f.id === next?.id ? 'is-us' : game.results[f.id] ? undefined : 'is-dimmed')}
        onOpen={(f) => {
          if (game.results[f.id]) go(`match/${encodeURIComponent(f.id)}`);
        }}
        empty={<Empty icon="fixtures" title={t('season.empty')} text={t('season.emptyText')} compact />}
        testId="fixtures-season"
      />
    </Panel>
  );
}

function ByWeek({ game, content, clubId }: { game: GameState; content: ContentDB; clubId: ClubId }) {
  const season = game.calendar.season;
  const [tierId, setTierId] = useState<TierId>(game.clubs[clubId]!.tierId);
  const weeks = [...new Set(Object.values(game.fixtures).filter((f) => f.season === season && f.tierId === tierId).map((f) => f.weekIndex))].sort((a, b) => a - b);
  const lastPlayed = [...weeks].reverse().find((w) => Object.values(game.fixtures).some((f) => f.season === season && f.tierId === tierId && f.weekIndex === w && game.results[f.id]));
  const [week, setWeek] = useState<number | null>(null);
  const current = week !== null && weeks.includes(week) ? week : (lastPlayed ?? weeks[0] ?? null);
  const i = current === null ? -1 : weeks.indexOf(current);
  const prev = i > 0 ? weeks[i - 1]! : null;
  const nextW = i >= 0 && i < weeks.length - 1 ? weeks[i + 1]! : null;

  // 04 ui-fixtures: ← → change week.
  useShortcuts({
    ArrowLeft: () => (prev !== null ? setWeek(prev) : false),
    ArrowRight: () => (nextW !== null ? setWeek(nextW) : false),
  });

  const list = current === null ? [] : tierFixturesOfWeek(game, tierId, season, current);
  const tiers = [...content.tiers.list].sort((a, b) => a.level - b.level);
  const columns: Column<Fixture>[] = [
    {
      id: 'home',
      header: t('col.home'),
      align: 'num',
      fill: true,
      cell: (f) => (
        <span class="fixtures-side fixtures-side--home">
          <ClubEntity state={game} clubId={f.homeClubId} />
        </span>
      ),
    },
    {
      id: 'score',
      header: t('col.score'),
      align: 'center',
      class: 'fixtures-score',
      cell: (f) => {
        const r = game.results[f.id];
        if (!r) return <span class="u-faint">{t('notPlayed')}</span>;
        return (
          <strong class="u-num">
            <span class={r.winnerClubId === f.homeClubId ? 'u-accent' : undefined}>{r.score.home}</span>–
            <span class={r.winnerClubId === f.awayClubId ? 'u-accent' : undefined}>{r.score.away}</span>
          </strong>
        );
      },
    },
    {
      id: 'away',
      header: t('col.away'),
      fill: true,
      cell: (f) => (
        <span class="fixtures-side">
          <ClubEntity state={game} clubId={f.awayClubId} />
        </span>
      ),
    },
    {
      id: 'wing',
      header: t('col.wing'),
      class: 'col-mid',
      cell: (f) =>
        f.wing === 'cross' ? t('cross') : f.wing ? (content.leagues.wings.list.find((w) => w.id === f.wing)?.name ?? '') : f.stage !== 'league' ? weekLong(content, f.weekIndex, f.tierId) : '',
    },
    {
      id: 'report',
      header: <span class="u-sr-only">{t('col.report')}</span>,
      class: 'cell-tight',
      cell: (f) =>
        game.results[f.id] ? (
          <a class="btn btn--sm btn--ghost" href={href(`match/${encodeURIComponent(f.id)}`)} aria-label={t('reportAria', { match: `${clubShort(game, f.homeClubId)} v ${clubShort(game, f.awayClubId)}` })}>
            <Icon name="scroll" />
            {t('report')}
          </a>
        ) : null,
    },
  ];
  return (
    <Panel
      title={t('week.title')}
      icon="calendar-check"
      subtitle={current !== null ? t('week.subtitle', { week: weekLong(content, current, tierId), n: list.length, played: list.filter((f) => game.results[f.id]).length }) : undefined}
      testId="panel-week"
      body="flush"
      actions={
        <>
          <Segmented label={t('week.tier')} value={tierId} options={tiers.map((x) => ({ value: x.id as TierId, label: x.shortName }))} onChange={setTierId} />
          <div class="l-row fixtures-stepper">
            <button class="btn btn--sm btn--icon" type="button" aria-label={t('week.prev')} disabled={prev === null} onClick={() => prev !== null && setWeek(prev)}>
              <Icon name="chevron-left" />
            </button>
            <span class="select-wrap select-wrap--inline">
              <select
                class="select select--inline"
                aria-label={t('week.select')}
                value={current ?? ''}
                onChange={(e) => setWeek(Number((e.target as HTMLSelectElement).value))}
              >
                {weeks.map((w) => (
                  <option key={w} value={w}>
                    {weekTitle(content, w, tierId)}
                  </option>
                ))}
              </select>
            </span>
            <button class="btn btn--sm btn--icon" type="button" aria-label={t('week.next')} disabled={nextW === null} onClick={() => nextW !== null && setWeek(nextW)}>
              <Icon name="chevron-right" />
            </button>
          </div>
        </>
      }
      footer={<span>{t('week.hint')}</span>}
    >
      <DataTable
        label={current !== null ? weekLong(content, current, tierId) : t('week.title')}
        columns={columns}
        rows={list}
        rowKey={(f) => f.id}
        variant={['compact']}
        rowClass={(f) => (f.homeClubId === clubId || f.awayClubId === clubId ? 'is-us' : undefined)}
        onOpen={(f) => {
          if (game.results[f.id]) go(`match/${encodeURIComponent(f.id)}`);
        }}
        empty={<Empty icon="fixtures" title={t('week.empty')} text={t('week.emptyText')} compact />}
        testId="fixtures-week"
      />
    </Panel>
  );
}

function CalendarStrip({ game, content, clubId, fixtures }: { game: GameState; content: ContentDB; clubId: ClubId; fixtures: Fixture[] }) {
  const weeks = [...content.weeks.list].sort((a, b) => a.index - b.index);
  const grants = content.economy.income.grantInstallments;
  const tierId = game.clubs[clubId]!.tierId;
  const groups: { id: string; label: string; weeks: typeof weeks }[] = [
    { id: 'preseason', label: t('cal.preseason'), weeks: weeks.filter((w) => w.phase === 'preseason') },
    { id: 'regular', label: t('cal.regular'), weeks: weeks.filter((w) => w.phase === 'regular') },
    { id: 'tournament', label: content.tiers.get(tierId)?.tournamentName ?? t('cal.tournament'), weeks: weeks.filter((w) => w.phase === 'tournament') },
  ];
  const now = game.calendar.weekIndex;
  const last = weeks[weeks.length - 1];
  return (
    <Panel title={t('cal.title')} icon="fixtures" subtitle={t('cal.subtitle', { n: weeks.length, last: last?.id ?? '' })}>
      <div class="cal-strip" data-testid="fixtures-calendar">
        {groups.map((g) => (
          <div key={g.id}>
            <div class="panel-section__title">{g.label}</div>
            <ol class="cal-strip__weeks" role="list" style={{ '--cols': Math.min(8, g.weeks.length) }}>
              {g.weeks.map((w) => {
                const f = fixtures.find((x) => x.weekIndex === w.index);
                const r = f ? game.results[f.id] : undefined;
                const grant = grants.find((x) => x.atWeek === w.id);
                const markers: { icon: 'user-plus' | 'calendar-check' | 'coins' | 'contract'; tip: string }[] = [];
                if (w.label && w.index === 1) markers.push({ icon: 'user-plus', tip: t('cal.trials') });
                if (w.commit === 'kick_off') markers.push({ icon: 'calendar-check', tip: t('cal.kickoff') });
                if (grant) markers.push({ icon: 'coins', tip: t('cal.grant', { share: fmtPctBp(grant.shareBp) }) });
                if (w.index === last?.index) markers.push({ icon: 'contract', tip: t('cal.expiry') });
                const result = f && r ? (r.winnerClubId === clubId ? 'won' : 'lost') : undefined;
                const def = weekDefAt(content, w.index);
                return (
                  <li
                    key={w.id}
                    class={w.index < now ? 'cal-week is-past' : 'cal-week'}
                    aria-current={w.index === now ? 'date' : undefined}
                    data-result={result}
                    data-tip={w.label && w.index === 1 ? TRIALS.explain : weekLong(content, w.index, tierId)}
                    data-testid={`cal-${w.id}`}
                  >
                    <div class="cal-week__head">
                      <span class="cal-week__id">{w.id}</span>
                      {w.index === now && <span class="tag tag--accent">{t('cal.now')}</span>}
                      <span class="cal-week__marks">
                        {markers.map((m) => (
                          <span key={m.icon} data-tip={m.tip} aria-label={m.tip} role="img">
                            <Icon name={m.icon} size="sm" />
                          </span>
                        ))}
                        {def?.fixtureKind === 'cross_wing' && <span class="tag tag--outline">{t('cross')}</span>}
                      </span>
                    </div>
                    <div class="cal-week__label">{def?.label ?? (def?.matchweek ? '' : weekLong(content, w.index, tierId))}</div>
                    {f ? (
                      <a class="cal-week__match" href={r ? href(`match/${encodeURIComponent(f.id)}`) : undefined}>
                        {r && <FormStrip form={[r.winnerClubId === clubId ? 'W' : 'L']} />}
                        <span class="u-truncate">{f.homeClubId === clubId ? t('cal.vs', { club: clubShort(game, f.awayClubId) }) : t('cal.at', { club: clubShort(game, f.homeClubId) })}</span>
                      </a>
                    ) : (
                      <span class="cal-week__match u-faint">{w.phase === 'preseason' ? '' : t('cal.noFixture')}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
      <div class="legend cal-strip__legend">
        <span class="legend__item">
          <Icon name="user-plus" size="sm" />
          {t('cal.legendTrials')}
        </span>
        <span class="legend__item">
          <Icon name="calendar-check" size="sm" />
          {t('cal.legendKick')}
        </span>
        <span class="legend__item">
          <Icon name="coins" size="sm" />
          {t('cal.legendGrant')} ({grants.map((g) => g.atWeek).join(', ')})
        </span>
        <span class="legend__item">
          <Icon name="contract" size="sm" />
          {t('cal.legendContract')}
        </span>
      </div>
    </Panel>
  );
}
