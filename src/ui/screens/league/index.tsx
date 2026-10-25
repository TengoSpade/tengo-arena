/**
 * ui-league · League: standings and the Reckoning (04 §6.3, mockup
 * league.html). Wing and tier tables with zone lines, a tier switch, and the
 * bracket: projection from MW13, live during the Reckoning, last season's
 * result on request. Reads core/league standings; never computes points.
 */
import { useEffect, useState } from 'preact/hooks';
import type { ScreenProps } from '../../app/routes';
import type { ContentDB } from '../../../core/content';
import type { ClubId, GameState, StandingRow, TierId, WingId } from '../../../core/model';
import { BracketView, projectedBracket, storedBracket, type BracketModel } from './Bracket';
import { StandingsTable, type Zones } from './StandingsTable';
import { matchweeksPlayed, weekDefAt } from './lib/calendar';
import { clubShort } from './lib/club';
import { fmtMoney } from './lib/format';
import { PROVISIONAL_PROJECTION_FROM_MATCHWEEK, projectSeeds } from './lib/reckoning';
import { leagueCompetition, nextFixture, opponentOf, reckoningCompetition } from './lib/season';
import { useCareer, type Career } from './lib/store';
import { Callout, Empty, NoCareer, Segmented, Unavailable } from './lib/ui';
import { tryView } from './lib/views';
import { useWp7Engine, type Wp7Engine } from './lib/engine';
import { t } from './text';
import './league.css';

export default function LeagueScreen(_props: ScreenProps) {
  const career = useCareer();
  if (!career) return <NoCareer testId="screen-league" />;
  return <League career={career} />;
}

interface Tables {
  wings: { wingId: WingId; name: string; rows: StandingRow[] }[];
  tier: StandingRow[];
}

function wingName(content: ContentDB, wingId: WingId): string {
  return content.leagues.wings.list.find((w) => w.id === wingId)?.name ?? String(wingId);
}

function computeTables(engine: Wp7Engine, game: GameState, content: ContentDB, season: number, tierId: TierId) {
  const league = leagueCompetition(game, season, tierId);
  if (!league) return null;
  return tryView<Tables>(() => ({
    wings: league.wings.map((w) => ({ wingId: w.wingId, name: wingName(content, w.wingId), rows: engine.standings(game, league.id, w.wingId, content) })),
    tier: engine.standings(game, league.id, 'tier', content),
  }));
}

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function League({ career }: { career: Career }) {
  const { game, content, club } = career;
  const season = game.calendar.season;
  const [tierId, setTierId] = useState<TierId>(club.tierId);
  const [view, setView] = useState<'wings' | 'tier'>('wings');
  const [bracketView, setBracketView] = useState<'current' | 'last'>('current');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'w' || e.key === 'W') setView('wings');
      else if (e.key === 't' || e.key === 'T') setView('tier');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tier = content.tiers.get(tierId);
  const tiers = [...content.tiers.list].sort((a, b) => a.level - b.level);
  const lowest = tiers[tiers.length - 1]?.level ?? 1;
  const engine = useWp7Engine();
  const tables = computeTables(engine, game, content, season, tierId);
  const total = content.leagues.regularSeason.matchesPerClub;
  const played = matchweeksPlayed(content, game.calendar);
  const phase = game.calendar.phase;
  const eyebrow =
    phase === 'preseason'
      ? t('eyebrow.preseason', { season })
      : phase === 'regular'
        ? t('eyebrow.regular', { season, played, total })
        : phase === 'tournament'
          ? t('eyebrow.tournament', { season })
          : t('eyebrow.over', { season });
  const p = content.leagues.standings.pointsByResult;
  const usId = club.id;
  const next = nextFixture(game, usId);
  const nextOpponentId: ClubId | null = next && next.tierId === tierId ? opponentOf(next, usId) : null;
  const wingSize = content.leagues.wings.size;
  const relegatePerWing = content.leagues.promotionRelegation.relegatePerWing;
  const level = tier?.level ?? 1;
  const zones: Zones = {
    qualifiers: content.leagues.tournament.qualifiersPerWing,
    relegateFrom: level < lowest && relegatePerWing > 0 ? wingSize - relegatePerWing + 1 : null,
    shieldLeaderId: tables?.ok ? (tables.value.tier[0]?.clubId ?? null) : null,
    shieldPromotes: level > 1,
  };
  const seeds = tables?.ok ? projectSeeds(content, tables.value.wings, tables.value.tier) : [];
  const seedMap = new Map(seeds.map((c, i) => [c, i + 1]));
  const wingOf = new Map<ClubId, string>();
  if (tables?.ok) for (const w of tables.value.wings) for (const r of w.rows) wingOf.set(r.clubId, w.name.replace(/ Wing$/, ''));

  return (
    <section class="page" data-testid="screen-league">
      <header class="page-header">
        <div class="page-header__text">
          <span class="page-header__eyebrow">{eyebrow}</span>
          <h1 class="page-header__title">{tier?.name ?? tierId}</h1>
          <div class="page-header__meta">
            <span>
              {t('meta.structure', {
                level,
                tiers: tiers.length,
                clubs: tier?.clubCount ?? 16,
                matches: total,
              })}
            </span>
            <span class="sep-dot" />
            <span data-tip={t('tip.points', { p20: p['2-0'], p21: p['2-1'], p12: p['1-2'], p02: p['0-2'] })} tabIndex={0}>
              {t('meta.points', { p20: p['2-0'], p21: p['2-1'], p12: p['1-2'], p02: p['0-2'] })}
            </span>
          </div>
        </div>
        <div class="page-header__actions">
          <Segmented
            label={t('tier.group')}
            value={tierId}
            options={tiers.map((x) => ({ value: x.id as TierId, label: t('tier.label', { level: x.level, name: x.shortName }) }))}
            onChange={(v) => {
              setTierId(v);
              setBracketView('current');
            }}
          />
        </div>
      </header>

      <div class="l-grid">
        <section class="panel span-12 span-6@wide" aria-labelledby="h-standings" data-testid="panel-standings">
          <header class="panel__header">
            <h2 class="panel__title" id="h-standings">
              <span class="icon" data-icon="league" aria-hidden="true" />
              {t('standings.title')}
            </h2>
            <span class="panel__subtitle">{t('standings.subtitle')}</span>
            <div class="panel__actions">
              <Segmented
                label={t('standings.view')}
                value={view}
                options={[
                  { value: 'wings', label: t('standings.wings'), tip: 'W' },
                  { value: 'tier', label: t('standings.tier'), tip: 'T' },
                ]}
                onChange={setView}
              />
            </div>
          </header>
          <div class="panel__body">
            {!tables ? (
              <Empty compact icon="league" title={t('standings.none')} text={t('standings.noneText')} />
            ) : !tables.ok ? (
              <Unavailable what="core/league standings" />
            ) : view === 'wings' ? (
              <div class="l-grid league-wings">
                {tables.value.wings.map((w) => (
                  <div class="span-6 span-12@wide league-wing" key={w.wingId}>
                    <div class="panel-section__title league-wing__title">{w.name}</div>
                    <StandingsTable
                      state={game}
                      content={content}
                      rows={w.rows}
                      variant="wing"
                      zones={zones}
                      usId={usId}
                      nextOpponentId={nextOpponentId}
                      caption={t('standings.wingCaption', { wing: w.name })}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <StandingsTable
                state={game}
                content={content}
                rows={tables.value.tier}
                variant="tier"
                zones={zones}
                usId={usId}
                nextOpponentId={nextOpponentId}
                seeds={seedMap}
                wingOf={wingOf}
                caption={t('standings.tierCaption', { tier: tier?.name ?? '' })}
              />
            )}
          </div>
          <footer class="panel__footer league-legend">
            <span class="legend__item">
              <span class="legend__swatch" style={{ '--swatch': 'var(--c-accent)' }} />
              {t('legend.qualify', { n: zones.qualifiers })}
            </span>
            <span class="legend__item">
              <span class="zone-mark zone-mark--up" aria-hidden="true" />
              {zones.shieldPromotes ? t('legend.shieldPromotes') : t('legend.shield')}
            </span>
            {zones.relegateFrom !== null && (
              <span class="legend__item">
                <span class="legend__swatch legend__swatch--hatch" />
                <span class="zone-mark zone-mark--down" aria-hidden="true" />
                {t('legend.relegate', { n: zones.relegateFrom })}
              </span>
            )}
          </footer>
        </section>

        <ReckoningPanel
          game={game}
          content={content}
          tierId={tierId}
          usId={usId}
          seeds={seeds}
          tablesReady={Boolean(tables?.ok)}
          bracketView={bracketView}
          setBracketView={setBracketView}
        />
      </div>
    </section>
  );
}

function ReckoningPanel({
  game,
  content,
  tierId,
  usId,
  seeds,
  tablesReady,
  bracketView,
  setBracketView,
}: {
  game: GameState;
  content: ContentDB;
  tierId: TierId;
  usId: ClubId;
  seeds: ClubId[];
  tablesReady: boolean;
  bracketView: 'current' | 'last';
  setBracketView: (v: 'current' | 'last') => void;
}) {
  const season = game.calendar.season;
  const rk = reckoningCompetition(game, season, tierId);
  const prev = reckoningCompetition(game, season - 1, tierId);
  const prevRecord = game.history.find((h) => h.season === season - 1)?.tiers.find((x) => x.tierId === tierId) ?? null;
  const hasLast = Boolean(prev?.bracket) || Boolean(prevRecord?.reckoningChampionId);
  const currentMw = weekDefAt(content, game.calendar.weekIndex)?.matchweek ?? null;
  const from = PROVISIONAL_PROJECTION_FROM_MATCHWEEK;
  const lastMw = content.leagues.regularSeason.matchesPerClub;
  const stored = rk ? storedBracket(game, content, rk) : null;
  const projecting = !stored && game.calendar.phase === 'regular' && currentMw !== null && currentMw >= from && tablesReady && seeds.length > 0;
  const rounds = content.leagues.tournament.rounds;
  const level = content.tiers.get(tierId)?.level ?? 1;
  const prize = content.tierProfile(level).tournamentPrize;
  const qualifiers = content.leagues.tournament.qualifiersPerWing;
  const clubsIn = qualifiers * content.leagues.wings.list.length;

  let body;
  if (bracketView === 'last' && hasLast) {
    const lastModel: BracketModel | null = prev ? storedBracket(game, content, prev) : null;
    body = lastModel ? (
      <BracketView state={game} content={content} model={lastModel} usId={usId} tierId={tierId} />
    ) : (
      <Callout title={t('bracket.lastChampion', { club: clubShort(game, prevRecord?.reckoningChampionId), season: season - 1 })} />
    );
  } else if (stored) {
    body = <BracketView state={game} content={content} model={stored} usId={usId} tierId={tierId} />;
  } else if (projecting) {
    const model = projectedBracket(content, seeds);
    const idx = seeds.indexOf(usId);
    let usLine: string | null = null;
    if (game.clubs[usId]?.tierId === tierId) {
      if (idx < 0) usLine = t('bracket.projectionOut', { n: qualifiers });
      else {
        const qf = rounds[0]?.pairs ?? [];
        const pair = qf.find((x) => Number(x[0]) === idx + 1 || Number(x[1]) === idx + 1);
        const other = pair ? (Number(pair[0]) === idx + 1 ? Number(pair[1]) : Number(pair[0])) : null;
        if (other) usLine = t('bracket.projectionUs', { opponent: clubShort(game, seeds[other - 1]) });
      }
    }
    body = (
      <>
        <div class="league-callout">
          <Callout title={t('bracket.projectionTitle')}>
            {t('bracket.projectionText')} {usLine}
          </Callout>
        </div>
        <BracketView state={game} content={content} model={model} usId={usId} tierId={tierId} />
      </>
    );
  } else {
    body = (
      <>
        <div class="league-callout">
          <Callout title={t('bracket.notYet', { from, last: lastMw })}>{t('bracket.notYetText', { n: qualifiers })}</Callout>
        </div>
        <BracketView
          state={game}
          content={content}
          model={projectedBracket(content, [])}
          usId={usId}
          tierId={tierId}
        />
      </>
    );
  }

  const live = stored && !stored.championId;
  return (
    <section class="panel span-12 span-6@wide" aria-labelledby="h-bracket" data-testid="panel-bracket">
      <header class="panel__header">
        <h2 class="panel__title" id="h-bracket">
          <span class="icon" data-icon="swords" aria-hidden="true" />
          {content.tiers.get(tierId)?.tournamentName ?? t('bracket.title')}
        </h2>
        <span class="panel__subtitle">{t('bracket.subtitle', { n: clubsIn })}</span>
        <div class="panel__actions">
          {stored ? (
            <span class={live ? 'tag tag--accent' : 'tag'}>{live ? t('bracket.live') : t('bracket.final')}</span>
          ) : hasLast ? (
            <Segmented
              label={t('bracket.view')}
              value={bracketView}
              options={[
                { value: 'current', label: t('bracket.projection') },
                { value: 'last', label: t('bracket.last', { season: season - 1 }) },
              ]}
              onChange={setBracketView}
            />
          ) : null}
        </div>
      </header>
      <div class="panel__body league-bracket-body">{body}</div>
      <footer class="panel__footer">
        <span>
          {t('bracket.footer', {
            from: rounds[0]?.week ?? '',
            to: rounds[rounds.length - 1]?.week ?? '',
            last: lastMw,
          })}
        </span>
        <span
          class="l-push u-accent"
          tabIndex={0}
          data-tip={t('bracket.prizeTip', {
            qf: fmtMoney(prize.quarterfinal, content),
            sf: fmtMoney(prize.semifinal, content),
            f: fmtMoney(prize.finalist, content),
            c: fmtMoney(prize.champion, content),
          })}
        >
          {t('bracket.prizeTable')}
        </span>
      </footer>
    </section>
  );
}
