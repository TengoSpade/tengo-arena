/**
 * ui-home · Home, the matchweek hub (04 §6.3, mockup home.html): answers
 * "what needs me this week?" and starts the week in one press.
 * Main (8/12): the next fixture hero (or the preseason checklist) and the
 * digest. Side (4/12): club money and roster, availability, the wing table.
 * Keys: Space Continue (frame), L lineup, O opponent, 1-7 screens, Ctrl S.
 */
import { signal } from '@preact/signals';
import type { ContentDB } from '../../../core/content';
import type { Club, ClubId, Fighter, Fixture, GameState, StandingRow } from '../../../core/model';
import type { ScreenProps } from '../../app/routes';
import { navigate } from '../../app/router';
import { useShortcuts } from '../../app/shortcuts';
import {
  CapMeter,
  Crest,
  crestLetters,
  DataTable,
  Delta,
  Empty,
  FighterName,
  FormStrip,
  Icon,
  Meter,
  PageHeader,
  Panel,
  RoleGlyph,
  RowMark,
  Tabs,
  Tag,
  showToast,
  tipAttrs,
  type Column,
  type IconName,
} from '../../components';
import { formatInt, formatMoney, formatPercent, formatSigned, ordinal } from '../../format';
import { matchweeksLeft, weekCode, weekName } from '../../format/calendar';
import { contractEnds, injuryLabel, injuryTip, rolesOf } from '../../format/fighter';
import { slotName, useStore, type AppStore } from '../../store';
import { buildDigest, needsActionCount, type DigestItem, type DigestKind } from '../../store/digest';
import { safeView, useEngine, type GameEngine } from '../../store/engine';
import { fighterViewOf, usePlayerClub, type ClubContext } from '../../store/views';
import { format, t } from '../../text';
import { T } from './text';
import './home.css';

type DigestTab = 'all' | 'action' | 'results' | 'squad' | 'market';
const digestTab = signal<DigestTab>('all');
/** Items marked done this session but restored with Undo (no "mark unread" command in M1). */
const restored = signal<ReadonlySet<string>>(new Set());

export default function HomeScreen(_props: ScreenProps) {
  const store = useStore() as AppStore;
  const engine = useEngine();
  const ctx = usePlayerClub();

  useShortcuts({
    l: () => navigate('#/squad'),
    o: () => navigate('#/league'),
  });

  if (!ctx) {
    return (
      <section class="page" data-testid="screen-home">
        <Empty icon="home" title={t('continue.newCareer')} actions={<a class="btn btn--primary" href="#/new-game">{t('continue.newCareer')}</a>} />
      </section>
    );
  }
  const { state, content, club, tier, standing } = ctx;
  const cal = state.calendar;
  const qualifiers = content.leagues.tournament.qualifiersPerWing;
  const lastReport = latestResult(state, club.id);
  const meta =
    cal.phase === 'preseason'
      ? [T.metaPreseason]
      : [
          standing && ctx.wing
            ? format(T.metaStanding, { pos: ordinal(standing.position), size: ctx.wingRows.length, wing: ctx.wing.name, pts: standing.points, played: standing.played })
            : null,
          format(T.metaCut, { tournament: tier.tournamentName, n: qualifiers }),
          cal.phase === 'regular' ? format(T.metaLeft, { n: matchweeksLeft(content, cal) }) : null,
        ];

  return (
    <section class="page" data-testid="screen-home">
      <PageHeader
        eyebrow={format(T.eyebrow, { season: cal.season, tier: tier.name, wing: ctx.wing ? ` · ${ctx.wing.name}` : '' })}
        title={weekName(content, cal.weekIndex, tier)}
        meta={meta}
        actions={
          <>
            {lastReport && (
              <a class="btn btn--ghost" href={`#/match/${encodeURIComponent(lastReport.fixtureId)}`}>
                <Icon name="scroll" />
                {T.lastReport}
              </a>
            )}
            <button
              class="btn btn--ghost"
              type="button"
              onClick={async () => {
                const res = await store.quickSave?.();
                if (res?.ok) showToast({ title: t('save.saved', { slot: slotName(res.value.slotId) }), sub: res.value.label, kind: 'good' });
              }}
            >
              <Icon name="save" />
              {T.save} <kbd>Ctrl S</kbd>
            </button>
          </>
        }
      />
      <div class="l-grid">
        <div class="span-8 l-stack">
          {ctx.fixture ? <FixtureHero ctx={ctx} fixture={ctx.fixture} engine={engine} /> : <PreseasonHero ctx={ctx} store={store} />}
          <DigestPanel ctx={ctx} store={store} />
        </div>
        <div class="span-4 l-stack">
          <ClubPanel ctx={ctx} />
          <AvailabilityPanel ctx={ctx} />
          <WingTable ctx={ctx} />
        </div>
      </div>
    </section>
  );
}

// ---- Next fixture --------------------------------------------------------------------------------------------

function latestResult(state: GameState, clubId: ClubId) {
  return Object.values(state.results)
    .filter((r) => r.season === state.calendar.season && (r.homeClubId === clubId || r.awayClubId === clubId))
    .sort((a, b) => b.weekIndex - a.weekIndex)[0];
}

function lastFive(state: GameState, content: ContentDB, clubId: ClubId) {
  return Object.values(state.results)
    .filter((r) => r.season === state.calendar.season && (r.homeClubId === clubId || r.awayClubId === clubId))
    .sort((a, b) => a.weekIndex - b.weekIndex)
    .slice(-5)
    .map((r) => {
      const home = r.homeClubId === clubId;
      const other = state.clubs[home ? r.awayClubId : r.homeClubId];
      const won = r.winnerClubId === clubId;
      const score = home ? `${r.score.home}–${r.score.away}` : `${r.score.away}–${r.score.home}`;
      return {
        r: (won ? 'W' : 'L') as 'W' | 'L',
        tip: format(T.formTip, { week: weekCode(content, r.weekIndex), where: home ? T.vs : t('continue.at'), club: other?.name ?? '', result: won ? T.won : T.lost, score }),
      };
    });
}

function recordOf(row: StandingRow | null) {
  if (!row) return { text: T.recordNone, tip: T.recordNone };
  return {
    text: format(T.record, { pos: ordinal(row.position), w: row.matchWins, l: row.matchLosses, pts: row.points }),
    tip: format(T.recordTip, { p: row.played, w: row.matchWins, l: row.matchLosses, rw: row.roundsWon, rl: row.roundsLost }),
  };
}

function rowFor(state: GameState, content: ContentDB, engine: GameEngine, club: Club): StandingRow | null {
  const comp = safeView(() => engine.leagueCompetitionOf(state, state.calendar.season, club.tierId), null);
  if (!comp || !club.wingId) return null;
  return safeView(() => engine.standings(state, comp, club.wingId!, content), [] as StandingRow[]).find((r) => r.clubId === club.id) ?? null;
}

function FixtureHero({ ctx, fixture, engine }: { ctx: ClubContext; fixture: Fixture; engine: GameEngine }) {
  const { state, content, club, tier } = ctx;
  const home = fixture.homeClubId === club.id;
  const other = state.clubs[home ? fixture.awayClubId : fixture.homeClubId]!;
  const otherRow = rowFor(state, content, engine, other);
  const ours = recordOf(ctx.standing);
  const theirs = recordOf(otherRow);
  const otherTemplate = content.clubs.get(other.id);
  const venue = fixture.venueId
    ? format(T.venueNeutral, { venue: content.venues.get(fixture.venueId)?.name ?? fixture.venueId })
    : home
      ? format(T.venueHome, { arena: content.clubs.get(club.id)?.arena ?? '', city: content.clubs.get(club.id)?.city ?? '' })
      : format(T.venueAway, { arena: otherTemplate?.arena ?? '', city: otherTemplate?.city ?? '' });
  const stage = fixture.stage === 'league' ? T.league : weekName(content, fixture.weekIndex, tier);
  const upcoming = safeView(() => engine.clubSchedule(state, club.id), [] as Fixture[])
    .filter((f) => f.weekIndex > fixture.weekIndex)
    .slice(0, 3);

  return (
    <Panel
      hero
      title={T.nextFixture}
      icon="swords"
      subtitle={format(T.fixtureSub, { stage, n: fixture.bestOf })}
      subtitleTip={format(T.fixtureSubTip, { n: fixture.bestOf, win: Math.ceil(fixture.bestOf / 2) })}
      body="none"
      testId="next-fixture"
      actions={
        <>
          <a class="btn btn--sm" href="#/league">
            <Icon name="eye" />
            {T.opponent} <kbd>O</kbd>
          </a>
          <a class="btn btn--sm" href="#/squad">
            <Icon name="squad" />
            {T.lineup} <kbd>L</kbd>
          </a>
        </>
      }
      footer={
        upcoming.length > 0 ? (
          <>
            <Icon name="fixtures" />
            <span class="u-truncate">
              {format(T.then, {
                list: upcoming
                  .map((f) => {
                    const h = f.homeClubId === club.id;
                    const o = state.clubs[h ? f.awayClubId : f.homeClubId];
                    const pos = o ? rowFor(state, content, engine, o)?.position : undefined;
                    return `${weekCode(content, f.weekIndex)} ${h ? T.vs : t('continue.at')} ${o?.name ?? ''}${pos ? ` (${ordinal(pos)})` : ''}`;
                  })
                  .join(' · '),
              })}
            </span>
            <a class="l-push u-nowrap" href="#/fixtures">
              {T.allFixtures}
            </a>
          </>
        ) : undefined
      }
    >
      <div class="fixture">
        <div class="fixture__side">
          <Crest primary={club.colors.primary} secondary={club.colors.secondary} code={crestLetters(club)} size="xl" />
          <div class="fixture__club">
            <span class="fixture__name">{club.name}</span>
            <span class="fixture__record" tabIndex={0} {...tipAttrs(ours.tip)}>
              {ours.text}
            </span>
            <FormStrip results={lastFive(state, content, club.id)} label={format(T.formLabel, { list: lastFive(state, content, club.id).map((x) => x.r).join(', ') })} />
          </div>
        </div>
        <div class="fixture__center">
          <span class="fixture__kind">{weekName(content, fixture.weekIndex, tier)}</span>
          <span class="fixture__vs">{T.vs}</span>
          <span class="fixture__venue">{venue}</span>
        </div>
        <div class="fixture__side fixture__side--away">
          <Crest primary={other.colors.primary} secondary={other.colors.secondary} code={crestLetters(other)} size="xl" />
          <div class="fixture__club">
            <span class="fixture__name">{other.name}</span>
            <span class="fixture__record" tabIndex={0} {...tipAttrs(theirs.tip)}>
              {theirs.text}
            </span>
            <FormStrip results={lastFive(state, content, other.id)} label={format(T.formLabel, { list: lastFive(state, content, other.id).map((x) => x.r).join(', ') })} />
          </div>
        </div>
      </div>
      <div class="panel-section panel__body panel__body--tight">
        <div class="tile-row home-tiles">
          <LineupTile ctx={ctx} club={club} label={T.ourLineup} ours />
          <LineupTile ctx={ctx} club={other} label={T.theirLineup} />
          <StyleTile ctx={ctx} club={other} />
        </div>
      </div>
    </Panel>
  );
}

function lineupFighters(state: GameState, club: Club): { f: Fighter; row: 'front' | 'back' }[] {
  const last = latestResult(state, club.id);
  const side = last ? (last.homeClubId === club.id ? last.input.home : last.input.away) : null;
  if (side && side.fighters.length > 0) {
    return side.fighters.map((x) => ({ f: state.fighters[x.fighterId]!, row: x.row })).filter((x) => !!x.f);
  }
  return club.lineup.fighters.map((e) => ({ f: state.fighters[e.fighterId]!, row: e.row })).filter((x) => !!x.f);
}

function LineupTile({ ctx, club, label, ours }: { ctx: ClubContext; club: Club; label: string; ours?: boolean }) {
  const { state, content, engine } = ctx;
  const list = ours ? club.lineup.fighters.map((e) => ({ f: state.fighters[e.fighterId]!, row: e.row })).filter((x) => !!x.f) : lineupFighters(state, club);
  const front = list.filter((x) => x.row === 'front');
  const back = list.filter((x) => x.row === 'back');
  const glyph = (x: { f: Fighter }) => {
    const k = content.classes.require(x.f.classId);
    const v = fighterViewOf(engine, state, content, x.f.id);
    const roleName = content.combat.archetypes.find((a) => a.id === k.archetypes[0])?.name ?? '';
    const cap = club.captainId === x.f.id ? ` · ${t('fighter.captain')}` : '';
    return <RoleGlyph key={x.f.id} role={rolesOf(k)[0]!} size="lg" tip={`${x.f.name.full} · ${k.name} (${roleName})${v ? ` · ${v.rating}` : ''}${cap}`} />;
  };
  const ratings = list.map((x) => fighterViewOf(engine, state, content, x.f.id)?.rating).filter((v): v is number => v !== undefined);
  const mean = ratings.length ? Math.round(ratings.reduce((s, v) => s + v, 0) / ratings.length) : null;
  const hasHealer = list.some((x) => content.classes.require(x.f.classId).archetypes.includes('healer'));
  const blockers = ours ? safeView(() => engine.getBlockers(state, content), []).filter((b) => b.code.startsWith('lineup') || b.code.startsWith('captain')) : [];
  const injuredReserve = ours ? Object.values(state.fighters).find((f) => f.clubId === club.id && f.injury && f.injury.weeksOut > 0) : undefined;
  return (
    <div class="stat-tile">
      <span class="stat-tile__label">{label}</span>
      <span class="l-cluster l-cluster--xs l-cluster--nowrap" aria-label={`${T.front}: ${front.length}. ${T.back}: ${back.length}.`}>
        <RowMark row="front" />
        {front.map(glyph)}
        <span class="home-row-gap" />
        <RowMark row="back" />
        {back.map(glyph)}
      </span>
      {ours ? (
        <span class="stat-tile__sub">
          {blockers.length === 0 ? <span class="u-good">{T.ready}</span> : <span class="u-warn">{T.notReady}</span>}
          {injuredReserve
            ? ` · ${format(T.outInjured, { name: injuredReserve.name.full, injury: injuryLabel(injuredReserve.injury!, content).toLowerCase(), n: injuredReserve.injury!.weeksOut })}`
            : ''}
        </span>
      ) : (
        <span class="stat-tile__sub" {...tipAttrs(T.theirLineupTip)}>
          {[hasHealer ? null : T.noHealer, mean !== null ? format(T.meanRating, { n: mean }) : null].filter(Boolean).join(' · ')}
        </span>
      )}
    </div>
  );
}

function StyleTile({ ctx, club }: { ctx: ClubContext; club: Club }) {
  const { state, content, engine } = ctx;
  const personality = content.aiPersonalities.get(club.aiPersonalityId);
  const list = lineupFighters(state, club);
  const best = list
    .map((x) => ({ x, v: fighterViewOf(engine, state, content, x.f.id) }))
    .filter((y) => y.v)
    .sort((a, b) => b.v!.rating - a.v!.rating)[0];
  const styleWord = club.tacticsStyle.charAt(0).toUpperCase() + club.tacticsStyle.slice(1);
  return (
    <div class="stat-tile">
      <span class="stat-tile__label">{T.theirStyle}</span>
      <span class="l-cluster l-cluster--xs">
        <Tag kind="info" tip={T.styleTip}>
          {styleWord}
        </Tag>
        {personality && (
          <Tag kind="outline" tip={format(T.personalityTip, { text: personality.description })}>
            {personality.label}
          </Tag>
        )}
      </span>
      {best && (
        <span class="stat-tile__sub" {...tipAttrs(T.threatTip)}>
          {format(T.threat, { name: best.x.f.name.full, klass: content.classes.require(best.x.f.classId).name, rating: best.v!.rating })}
        </span>
      )}
    </div>
  );
}

// ---- Preseason (no fixture this week) ---------------------------------------------------------------

function PreseasonHero({ ctx, store }: { ctx: ClubContext; store: AppStore }) {
  const { state, content, tier, roster } = ctx;
  // Integrator (WP5): during the season-end step weekIndex is W + 1 (core/model calendar), which has no week def.
  const week = content.weeks.list.find((w) => w.index === state.calendar.weekIndex) ?? content.weekByIndex(content.weeks.list.length);
  const over = roster.length - ctx.rosterCap;
  const ending = roster.filter((f) => contractEnds(f.contract, state.calendar.season).final).length;
  const lineupOk = store.blockers.value.filter((b) => b.code.startsWith('lineup') || b.code.startsWith('captain')).length === 0;
  const bill = ctx.finance?.wageBill ?? ctx.wageBill ?? 0;
  const budget = ctx.finance?.wageBudgetPerWeek ?? 0;
  return (
    <Panel
      hero
      title={state.calendar.phase === 'preseason' ? T.preseasonTitle : T.weekChecklistTitle}
      icon="calendar-check"
      subtitle={format(T.preseasonSub, { week: weekName(content, week.index, tier) })}
      testId="preseason-checklist"
    >
      <ul class="checklist" role="list">
        <li data-state={budget > 0 && bill > budget ? 'bad' : undefined}>
          {format(T.checkBudget, { bill: formatMoney(bill, { perWeek: true }), budget: formatMoney(budget, { perWeek: true }) })}
        </li>
        <li data-state={over > 0 ? 'bad' : undefined}>
          {over > 0 ? format(T.checkRosterOver, { n: roster.length, cap: ctx.rosterCap, over }) : format(T.checkRoster, { n: roster.length, cap: ctx.rosterCap })}
        </li>
        {week.index === 1 && <li data-state="warn">{T.checkTrials}</li>}
        <li data-state={ending > 0 ? 'warn' : undefined}>{format(T.checkContracts, { n: ending })}</li>
        <li data-state={lineupOk ? undefined : 'warn'}>{lineupOk ? T.checkLineup : T.checkLineupMissing}</li>
      </ul>
    </Panel>
  );
}

// ---- Digest ------------------------------------------------------------------------------------------------------

const KIND_ICON: Record<DigestKind, IconName> = {
  medical: 'injury',
  contract: 'contract',
  result: 'swords',
  market: 'market',
  league: 'league',
  development: 'level-up',
};

function inTab(d: DigestItem, tab: DigestTab): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'action':
      return d.needsAction;
    case 'results':
      return d.kind === 'result';
    case 'squad':
      return d.kind === 'medical' || d.kind === 'contract' || d.kind === 'development';
    case 'market':
      return d.kind === 'market';
  }
}

function DigestPanel({ ctx, store }: { ctx: ClubContext; store: AppStore }) {
  const { state, content, club } = ctx;
  const items = withAwaySummary(buildDigest(state, content, club.id, store.blockers.value), ctx, store);
  const tab = digestTab.value;
  const shown = items.filter((d) => inTab(d, tab));
  const action = needsActionCount(items);
  const isDone = (d: DigestItem) => d.newsIds.length > 0 && !d.unread && !restored.value.has(d.id);
  const markDone = (d: DigestItem) => {
    if (d.newsIds.length === 0) return;
    const res = store.dispatch({ type: 'news.markRead', newsIds: d.newsIds });
    if (!res.ok) return;
    const next = new Set(restored.value);
    next.delete(d.id);
    restored.value = next;
    showToast({
      title: T.markedDone,
      sub: d.title,
      kind: 'good',
      // TODO(m1/fix-perf): core adds a news read flag with Undo (a "news.markUnread" or equivalent
      // command). When it lands, dispatch it here and drop the session-only `restored` set above.
      undo: () => {
        restored.value = new Set([...restored.value, d.id]);
      },
    });
  };
  const unreadIds = items.filter((d) => d.unread).flatMap((d) => d.newsIds);
  return (
    <Panel
      title={T.digest}
      icon="mail"
      subtitle={format(T.digestSub, { n: items.length, a: action })}
      subtitleTip={T.digestBudgetTip}
      body="none"
      testId="digest"
      actions={
        <button
          class="btn btn--sm btn--ghost"
          type="button"
          aria-disabled={unreadIds.length === 0 ? 'true' : undefined}
          onClick={() => unreadIds.length > 0 && store.dispatch({ type: 'news.markRead', newsIds: unreadIds })}
        >
          {T.markAllRead}
        </button>
      }
    >
      <Tabs<DigestTab>
        idPrefix="digest"
        label={T.digestFilter}
        inset
        selected={tab}
        onSelect={(id) => (digestTab.value = id)}
        tabs={[
          { id: 'all', label: T.tabAll, count: items.length },
          { id: 'action', label: T.tabAction, count: action },
          { id: 'results', label: T.tabResults },
          { id: 'squad', label: T.tabSquad },
          { id: 'market', label: T.tabMarket },
        ]}
      />
      <div id={`digest-panel-${tab}`} role="tabpanel" aria-labelledby={`digest-tab-${tab}`}>
        {shown.length === 0 ? (
          <Empty compact icon="check" title={items.length === 0 ? T.emptyDigest : T.emptyFilter} text={items.length === 0 ? T.emptyDigestText : undefined} />
        ) : (
          <ul class="digest" role="list">
            {shown.map((d) => (
              <li key={d.id} class={`digest__item${isDone(d) ? ' is-done' : ''}`} data-kind={d.kind} data-unread={d.unread && !isDone(d) ? '' : undefined}>
                <span class="digest__icon">
                  <Icon name={KIND_ICON[d.kind]} />
                </span>
                <div class="digest__main">
                  <div class="digest__title">
                    <span {...tipAttrs(d.title)}>{d.title}</span>
                    {d.needsAction && <Tag kind={d.kind === 'medical' ? 'bad' : 'warn'}>{T.needsAction}</Tag>}
                  </div>
                  {d.text && (
                    <div class="digest__text" {...tipAttrs(d.text)}>
                      {d.text}
                    </div>
                  )}
                </div>
                <div class="digest__actions">
                  {d.action && (
                    <a class={`btn btn--sm${d.needsAction ? '' : ' btn--ghost'}`} href={d.action.href}>
                      {d.action.label}
                    </a>
                  )}
                  {!d.needsAction && d.newsIds.length > 0 && !isDone(d) && (
                    <button class="btn btn--sm btn--ghost btn--icon" type="button" aria-label={T.markDone} {...tipAttrs(T.markDone)} onClick={() => markDone(d)}>
                      <Icon name="check" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

/** 02 §7 "since you were away": after a load, the first item summarises the last results, standing, decisions and money. */
function withAwaySummary(items: DigestItem[], ctx: ClubContext, store: AppStore): DigestItem[] {
  const justLoaded = store.dirty?.value === false && store.lastWeekReport.value === null && ctx.state.calendar.weekIndex > 1;
  if (!justLoaded) return items;
  const results = lastFive(ctx.state, ctx.content, ctx.club.id).slice(-3).map((x) => x.r).join(' ');
  const summary: DigestItem = {
    id: 'away-summary',
    kind: 'league',
    title: T.awayTitle,
    text: format(T.awayText, {
      results: results || '—',
      standing: ctx.standing && ctx.wing ? `${ordinal(ctx.standing.position)} in the ${ctx.wing.name}` : '—',
      pending: items.filter((d) => d.needsAction).length,
      balance: ctx.finance ? formatMoney(ctx.finance.balance) : '—',
    }),
    needsAction: false,
    unread: true,
    newsIds: [],
  };
  return [summary, ...items].slice(0, 6);
}

// ---- Side column -------------------------------------------------------------------------------------------------

function ClubPanel({ ctx }: { ctx: ClubContext }) {
  const { state, finance, roster, tier } = ctx;
  const lastWeek = state.calendar.weekIndex - 1;
  const lastWeekNet = state.ledger.entries.filter((e) => e.clubId === ctx.club.id && e.weekIndex === lastWeek).reduce((s, e) => s + e.amount, 0);
  const bill = finance?.wageBill ?? ctx.wageBill ?? 0;
  const budget = finance?.wageBudgetPerWeek ?? 0;
  const pending = finance?.pendingWages ?? 0;
  const room = budget - bill - pending;
  const share = budget > 0 ? bill / budget : 0;
  const free = ctx.rosterCap - roster.length;
  return (
    <Panel
      title={T.club}
      icon="coins"
      testId="club-panel"
      actions={
        <a class="btn btn--sm btn--ghost" href="#/finances">
          {T.finances} <kbd>6</kbd>
        </a>
      }
      bodyClass="l-stack"
    >
      <div class="tile-row" style={{ '--tiles': 2 }}>
        <div class="stat-tile" tabIndex={0} {...tipAttrs({ kicker: T.balance, title: finance ? formatMoney(finance.balance) : '—', body: t('topbar.balanceTip'), meta: t('topbar.balanceMeta') })}>
          <span class="stat-tile__label">{T.balance}</span>
          <span class="stat-tile__value">
            {finance ? formatInt(finance.balance) : '—'} <small>{currencyUnit()}</small>
          </span>
          <span class="stat-tile__sub">
            {lastWeekNet !== 0 ? (
              <>
                <Delta value={lastWeekNet} format={(n) => formatMoney(n)} /> {T.lastWeek}
              </>
            ) : (
              `${formatMoney(0)} ${T.lastWeek}`
            )}
          </span>
        </div>
        <div class="stat-tile" tabIndex={0} {...tipAttrs(T.projectedTip)}>
          <span class="stat-tile__label">{T.projected}</span>
          <span class="stat-tile__value">
            {finance ? formatInt(finance.projectedSeasonEndBalance) : '—'} <small>{currencyUnit()}</small>
          </span>
          <span class="stat-tile__sub">{T.projectedSub}</span>
        </div>
      </div>
      <div class="l-stack l-stack--xs" tabIndex={0} {...tipAttrs(T.wageRoomTip)}>
        <div class="l-row u-sm">
          <span class="u-muted">{T.wageBill}</span>
          <span class="l-push u-num">
            <strong>{formatInt(bill)}</strong> <span class="u-muted">/ {formatMoney(budget)} {T.perWeek}</span>
          </span>
        </div>
        <Meter value={share} mark={1} state={share > 1 ? 'bad' : share > 0.9 ? 'warn' : 'good'} />
        <div class="u-xs u-faint">{format(T.wageRoom, { pct: formatPercent(share), room: formatMoney(room, { perWeek: true }) })}</div>
      </div>
      <div class="l-row u-sm" tabIndex={0} {...tipAttrs(format(T.rosterTip, { n: roster.length, cap: ctx.rosterCap, tier: tier.name }))}>
        <span class="u-muted">{T.roster}</span>
        <CapMeter used={roster.length} cap={ctx.rosterCap} />
        <span class="l-push u-num">
          <strong>{roster.length}</strong> <span class="u-muted">/ {ctx.rosterCap} · {format(T.rosterFree, { n: Math.max(0, free) })}</span>
        </span>
      </div>
    </Panel>
  );
}

function currencyUnit(): string {
  return formatMoney(0).replace(/^0\s*/, '');
}

function AvailabilityPanel({ ctx }: { ctx: ClubContext }) {
  const { state, content, roster, engine } = ctx;
  const out = (f: Fighter) => !!f.injury && f.injury.weeksOut > 0;
  const injured = roster.filter(out);
  const ending = roster.filter((f) => !injured.includes(f) && contractEnds(f.contract, state.calendar.season).final);
  const list = [...injured, ...ending];
  const role = (f: Fighter) => rolesOf(content.classes.require(f.classId))[0];
  return (
    <Panel
      title={T.availability}
      icon="injury"
      subtitle={format(T.availabilitySub, { fit: roster.length - injured.length, inj: injured.length })}
      subtitleTip={T.availabilityTip}
      body="flush"
      testId="availability"
    >
      {list.length === 0 ? (
        <Empty compact icon="check" title={T.allFit} />
      ) : (
        <table class="data-table data-table--compact" aria-label={T.availability}>
          <tbody>
            {list.map((f) => (
              <tr key={f.id}>
                <td class="cell-fill">
                  {/* The status sits under the name so the side column never truncates both. */}
                  <FighterName
                    name={f.name.full}
                    href={`#/fighter/${f.id}`}
                    role={role(f)}
                    race={f.raceId}
                    injured={out(f)}
                    sub={
                      f.injury && out(f) ? (
                        <span class="u-bad" {...tipAttrs(injuryTip(f.injury, content))}>
                          <Icon name="injury" size="sm" /> {injuryLabel(f.injury, content)}
                        </span>
                      ) : (
                        <span class="u-warn" {...tipAttrs(T.expiresTip)}>
                          <Icon name="contract" size="sm" /> {format(T.expires, { season: f.contract?.endSeason ?? state.calendar.season })}
                        </span>
                      )
                    }
                  />
                </td>
                <td class={`cell-num${out(f) ? '' : ' u-muted'}`}>
                  {f.injury && out(f) ? (
                    <span {...tipAttrs(format(T.backFor, { n: f.injury.weeksOut }))}>{formatInt(f.injury.weeksOut)} wk</span>
                  ) : (
                    <span {...tipAttrs(fighterViewOf(engine, state, content, f.id) ? `Wage ${formatMoney(f.contract?.wagePerWeek ?? 0, { perWeek: true })}` : null)}>
                      {formatMoney(f.contract?.wagePerWeek ?? 0)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function WingTable({ ctx }: { ctx: ClubContext }) {
  const { state, content, club, tier, wingRows, wing } = ctx;
  const qualifiers = content.leagues.tournament.qualifiersPerWing;
  const relegate = content.leagues.promotionRelegation.relegatePerWing;
  const size = wingRows.length;
  const nextId = ctx.fixture ? (ctx.fixture.homeClubId === club.id ? ctx.fixture.awayClubId : ctx.fixture.homeClubId) : null;
  const points = content.leagues.standings.pointsByResult as Record<string, number>;
  const ptsTip = `Points: ${Object.entries(points)
    .map(([k, v]) => `${v} for ${k.replace('-', '–')}`)
    .join(', ')}`;
  const columns: Column<StandingRow>[] = [
    { id: 'pos', header: '#', headerLabel: T.colPos, class: 'cell-tight', cell: (r) => <span {...tipAttrs(format(T.posTip, { pos: ordinal(r.position), wing: wing?.name ?? tier.name }))}>{r.position}</span> },
    {
      id: 'club',
      header: T.colClub,
      fill: true,
      cell: (r) => {
        const c = state.clubs[r.clubId];
        return (
          <span class="entity">
            {c && <Crest primary={c.colors.primary} secondary={c.colors.secondary} />}
            <span class="entity__name" {...tipAttrs(c?.name ?? r.clubId)}>
              {c?.name ?? r.clubId}
            </span>
            {r.clubId === nextId && <Tag kind="accent">{T.next}</Tag>}
          </span>
        );
      },
    },
    { id: 'p', header: T.colP, headerTip: T.colPTip, align: 'num', cell: (r) => <span {...tipAttrs(format(T.recordTip, { p: r.played, w: r.matchWins, l: r.matchLosses, rw: r.roundsWon, rl: r.roundsLost }))}>{r.played}</span> },
    {
      id: 'rd',
      header: T.colRD,
      headerTip: T.colRDTip,
      align: 'num',
      cell: (r) => <span {...tipAttrs(`Rounds ${r.roundsWon} won, ${r.roundsLost} lost`)}>{formatSigned(r.roundsWon - r.roundsLost)}</span>,
    },
    { id: 'pts', header: T.colPts, headerTip: ptsTip, align: 'num', class: 'cell-strong', cell: (r) => <span {...tipAttrs(ptsTip)}>{r.points}</span> },
  ];
  return (
    <Panel
      title={wing?.name ?? tier.name}
      icon="league"
      body="flush"
      testId="wing-table"
      actions={
        <a class="btn btn--sm btn--ghost" href="#/league">
          {T.fullTable} <kbd>4</kbd>
        </a>
      }
      footer={
        size > 0 ? (
          <>
            <span class="legend__item">
              <span class="legend__swatch" style={{ '--swatch': 'var(--c-accent)' }} />
              {format(T.tableTop, { n: qualifiers, tournament: tier.tournamentName })}
            </span>
            {tier.level < content.leagues.tiers.length && (
              <span class="legend__item">
                <span class="legend__swatch legend__swatch--hatch" />
                {format(T.tableRelegated, { n: size })}
              </span>
            )}
          </>
        ) : undefined
      }
    >
      {size === 0 ? (
        <Empty compact icon="league" title={T.noTable} />
      ) : (
        <DataTable<StandingRow>
          label={wing?.name ?? tier.name}
          variant={['compact']}
          columns={columns}
          rows={wingRows}
          rowKey={(r) => r.clubId}
          rowClass={(r) =>
            [r.clubId === club.id ? 'is-us' : '', r.position === qualifiers ? 'is-cut' : '', r.position === size - relegate && tier.level < content.leagues.tiers.length ? 'is-cut--bad' : '']
              .filter(Boolean)
              .join(' ') || undefined
          }
          rowAttrs={(r) => (r.position <= qualifiers ? { 'data-zone': 'qualify' } : r.position > size - relegate && tier.level < content.leagues.tiers.length ? { 'data-zone': 'relegate' } : {})}
          onOpen={() => navigate('#/league')}
        />
      )}
    </Panel>
  );
}

