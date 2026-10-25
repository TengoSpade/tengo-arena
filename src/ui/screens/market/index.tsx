/**
 * ui-market · Market (04 §6.3, mockup market.html; R6, O10, P-09): free
 * agents with filters, asks for our club at 1-3 seasons, signing cost,
 * rival-offer counts, the starter flag and willingness; the compare tray;
 * pending offers with Withdraw; renewals; trials-day rookies (P1 only) and
 * the shortlist. Every change goes through store.dispatch (commands).
 */
import { useMemo, useRef, useState } from 'preact/hooks';
import type { ScreenProps } from '../../app/routes';
import { useShortcuts } from '../../app/shortcuts';
import type { ContentDB } from '../../../core/content';
import type { Fighter, FighterId, GameState, Offer } from '../../../core/model';
import { DataTable, Icon, PageHeader, Panel, showToast, type Column } from '../../components';
import type { GameStore } from '../../store';
import { useWp7Engine, type Wp7Engine } from '../league/lib/engine';
import { fmtMoney } from '../league/lib/format';
import { formatInt } from '../../format';
import { rosterOf } from '../league/lib/season';
import { useCareer, type Career } from '../league/lib/store';
import { Callout, ClassTag, Empty, FighterLink, NoCareer, Portrait, RatingPill, Segmented, Stars, TraitDots, classRoles, roleNames } from '../league/lib/ui';
import { tryView } from '../league/lib/views';
import { CompareDialog } from './CompareDialog';
import { clubMarket, marketRow, termsCheck, willingLevel, type ClubMarket, type MarketRow } from './model';
import { OfferDialog, type OfferTarget } from './OfferDialog';
import { t } from './text';
import './market.css';

type View = 'agents' | 'pending' | 'renewals' | 'rookies' | 'shortlist';

export default function MarketScreen(_props: ScreenProps) {
  const career = useCareer();
  if (!career) return <NoCareer testId="screen-market" />;
  return <Market career={career} />;
}

interface Filters {
  search: string;
  roles: string[];
  classId: string;
  races: string[];
  ageMin: number;
  ageMax: number;
  minRating: number;
  fits: boolean;
  noNeg: boolean;
  starter: boolean;
  onlyNew: boolean;
}

function defaultFilters(content: ContentDB): Filters {
  return { search: '', roles: [], classId: '', races: content.races.list.map((r) => r.id), ageMin: 15, ageMax: 60, minRating: 1, fits: false, noNeg: false, starter: false, onlyNew: false };
}

function rowMatches(r: MarketRow, f: Filters, content: ContentDB, m: ClubMarket): boolean {
  const fighter = r.fighter;
  if (f.search) {
    const q = f.search.toLowerCase();
    const klass = content.classes.get(fighter.classId)?.name ?? '';
    const traits = fighter.traits.map((x) => content.traits.get(x.id)?.name ?? '').join(' ');
    if (!`${fighter.name.full} ${klass} ${traits}`.toLowerCase().includes(q)) return false;
  }
  // Hybrids match either of their roles (open-024).
  if (f.roles.length && !classRoles(content, fighter.classId).some((role) => f.roles.includes(role))) return false;
  if (f.classId && fighter.classId !== f.classId) return false;
  if (!f.races.includes(fighter.raceId)) return false;
  if (fighter.age < f.ageMin || fighter.age > f.ageMax) return false;
  if (r.rating < f.minRating) return false;
  if (f.fits && r.ask > m.wageRoom) return false;
  if (f.noNeg && r.negativeTraits > 0) return false;
  if (f.starter && !r.wouldStart) return false;
  if (f.onlyNew && !r.isNew) return false;
  return true;
}

function Market({ career }: { career: Career }) {
  const { store, game, content, club } = career;
  const engine = useWp7Engine();
  const [view, setView] = useState<View>('agents');
  const [filters, setFilters] = useState<Filters>(() => defaultFilters(content));
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<FighterId[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [offer, setOffer] = useState<OfferTarget | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const market = useMemo(() => clubMarket(engine, game, content, club.id), [engine, game, content, club.id]);
  const agentsList = useMemo(() => {
    const v = tryView(() => engine.freeAgents(game));
    return v.ok ? v.value : null;
  }, [engine, game]);
  const trials = game.market.trialsRookies[club.id] ?? [];
  const rows = useMemo(
    () => (agentsList ?? []).filter((f) => !trials.includes(f.id)).map((f) => marketRow(engine, game, content, market, f)),
    [agentsList, engine, game, content, market],
  );
  const shown = rows.filter((r) => rowMatches(r, filters, content, market));
  const shortlistRows = rows.filter((r) => r.shortlisted);
  const pending = game.market.offers.filter((o) => o.clubId === club.id);
  const season = game.calendar.season;
  const renewals = rosterOf(game, club.id).filter((f) => f.contract && f.contract.endSeason === season);
  const isP1 = game.calendar.weekIndex === 1 && game.calendar.phase === 'preseason';

  // 04 ui-market: / search, O offer on the selected row, C compare it.
  useShortcuts({
    '/': () => {
      searchRef.current?.focus();
    },
    o: () => (selected && view === 'agents' ? setOffer({ fighterId: selected as FighterId, kind: 'free-agent' }) : false),
    c: () => (selected && view === 'agents' ? toggleCompare(selected as FighterId) : false),
  });

  const toggleCompare = (id: FighterId) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]));

  const roomTip = {
    kicker: t('tip.room.kicker'),
    title: `${fmtMoney(market.wageRoom, content)} / wk`,
    rows: [
      { label: t('tip.room.budget'), value: fmtMoney(market.wageBudget, content) },
      { label: t('tip.room.bill'), value: fmtMoney(-market.wageBill, content) },
      { label: t('tip.room.pending'), value: fmtMoney(-market.pendingWages, content) },
      { label: t('tip.room.total'), value: fmtMoney(market.wageRoom, content), total: true },
    ],
    meta: t('tip.room.meta'),
  };

  return (
    <section class="page" data-testid="screen-market">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        meta={[
          t('meta.count', { n: rows.length }),
          <span data-tip={t('meta.rosterTip', { roster: market.roster, pending: market.pendingOffers, cap: market.cap })} tabIndex={0}>
            {t('meta.roster', { roster: market.roster, cap: market.cap, left: Math.max(0, market.placesLeft) })}
          </span>,
          <span data-tip-rich={JSON.stringify(roomTip)} tabIndex={0} data-testid="wage-room">
            {t('meta.room', { room: fmtMoney(market.wageRoom, content) })}
          </span>,
        ]}
        actions={
          <Segmented
            label={t('view.label')}
            value={view}
            onChange={setView}
            options={[
              { value: 'agents', label: t('view.agents') },
              { value: 'pending', label: <>{t('view.pending')} <span class="u-faint">{pending.length}</span></> },
              { value: 'renewals', label: <>{t('view.renewals')} <span class="u-faint">{renewals.length}</span></> },
              { value: 'rookies', label: <>{t('view.rookies')} {isP1 && <span class="u-faint">{trials.length}</span>}</> },
              { value: 'shortlist', label: <>{t('view.shortlist')} <span class="u-faint">{shortlistRows.length}</span></> },
            ]}
          />
        }
      />
      {market.embargo && (
        <div class="market-banner">
          <Callout kind="bad" title={t('embargo.title', { balance: fmtMoney(market.balance, content), min: fmtMoney(market.tierMinWage, content) })}>
            {t('embargo.text', { min: fmtMoney(market.tierMinWage, content) })}
          </Callout>
        </div>
      )}

      {!market.embargo && market.wageRoom <= 0 && (view === 'agents' || view === 'shortlist') && (
        <div class="market-banner">
          <Callout kind="warn" title={t('noRoom.title', { room: fmtMoney(market.wageRoom, content) })}>
            {t('noRoom.text')}
          </Callout>
        </div>
      )}

      {view === 'agents' && (
        <div class="l-split market-split">
          <FilterRail content={content} filters={filters} setFilters={setFilters} market={market} searchRef={searchRef} newCount={rows.filter((r) => r.isNew).length} />
          <div class="l-stack market-results">
            <Panel
              title={t('results.title')}
              icon="market"
              subtitle={t('results.subtitle', { shown: shown.length, total: rows.length })}
              body="none"
              testId="market-results"
            >
              {agentsList === null ? (
                <Empty compact icon="warning" title={t('results.empty')} text="core/game freeAgents" />
              ) : (
                <AgentsTable
                  rows={shown}
                  game={game}
                  content={content}
                  market={market}
                  selected={selected}
                  setSelected={setSelected}
                  compare={compare}
                  toggleCompare={toggleCompare}
                  onOffer={(id) => setOffer({ fighterId: id, kind: 'free-agent' })}
                  store={store}
                  onReset={() => setFilters(defaultFilters(content))}
                  testId="market-agents"
                />
              )}
              <CompareTray
                game={game}
                content={content}
                clubFighters={rosterOf(game, club.id)}
                compare={compare}
                onOpen={() => setCompareOpen(true)}
                engine={engine}
                rows={rows}
                compareOpen={compareOpen}
                onClose={() => setCompareOpen(false)}
              />
            </Panel>
          </div>
        </div>
      )}

      {view === 'shortlist' && (
        <Panel title={t('shortlist.title')} icon="pin" subtitle={t('shortlist.subtitle')} body="none" testId="market-shortlist">
          {shortlistRows.length === 0 ? (
            <Empty compact icon="pin" title={t('shortlist.empty')} text={t('shortlist.emptyText')} />
          ) : (
            <AgentsTable
              rows={shortlistRows}
              game={game}
              content={content}
              market={market}
              selected={selected}
              setSelected={setSelected}
              compare={compare}
              toggleCompare={toggleCompare}
              onOffer={(id) => setOffer({ fighterId: id, kind: 'free-agent' })}
              store={store}
              onReset={() => undefined}
              testId="market-shortlist-table"
            />
          )}
        </Panel>
      )}

      {view === 'pending' && (
        <PendingTable game={game} content={content} engine={engine} store={store} offers={pending} onChange={(o) => setOffer({ fighterId: o.fighterId, kind: 'free-agent', wage: o.wagePerWeek, seasons: o.seasons })} />
      )}

      {view === 'renewals' && (
        <RenewalsTable game={game} content={content} engine={engine} market={market} fighters={renewals} onRenew={(id) => setOffer({ fighterId: id, kind: 'renewal' })} />
      )}

      {view === 'rookies' &&
        (isP1 ? (
          <RookiesTable game={game} content={content} engine={engine} market={market} ids={trials} onSign={(id) => setOffer({ fighterId: id, kind: 'trials' })} />
        ) : (
          <Panel title={t('rookies.title')} icon="user-plus" testId="market-rookies">
            <Empty icon="user-plus" title={t('rookies.closed')} text={t('rookies.closedText')} />
          </Panel>
        ))}

      <OfferDialog target={offer} onClose={() => setOffer(null)} store={store} engine={engine} game={game} content={content} clubId={club.id} market={market} />
    </section>
  );
}

// ---- filters -----------------------------------------------------------------------------------------

function FilterRail({
  content,
  filters,
  setFilters,
  market,
  searchRef,
  newCount,
}: {
  content: ContentDB;
  filters: Filters;
  setFilters: (f: Filters) => void;
  market: ClubMarket;
  searchRef: { current: HTMLInputElement | null };
  newCount: number;
}) {
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const roles = content.vocabulary.roles;
  const classes = content.classes.list.filter((c) => !filters.roles.length || c.archetypes.some((r) => filters.roles.includes(r)));
  return (
    <aside class="panel market-filters" aria-labelledby="h-filters">
      <header class="panel__header">
        <h2 class="panel__title" id="h-filters">
          <Icon name="filter" />
          {t('filters.title')}
        </h2>
        <div class="panel__actions">
          <button class="btn btn--sm btn--ghost" type="button" onClick={() => setFilters(defaultFilters(content))}>
            {t('filters.reset')}
          </button>
        </div>
      </header>
      <div class="filters">
        <div class="filter-group">
          <span class="input-icon">
            <Icon name="search" />
            <input
              ref={searchRef}
              class="input input--sm"
              type="search"
              placeholder={t('filters.search')}
              aria-label={t('filters.searchAria')}
              value={filters.search}
              onInput={(e) => set({ search: (e.target as HTMLInputElement).value })}
            />
          </span>
        </div>
        <div class="filter-group">
          <span class="filter-group__label">
            <span>{t('filters.role')}</span>
            <span class="u-faint">{t('filters.roleHint')}</span>
          </span>
          <div class="l-cluster l-cluster--xs">
            {roles.map((r) => (
              <button
                key={r.id}
                class="role-toggle"
                type="button"
                data-role={r.id}
                aria-pressed={filters.roles.includes(r.id) ? 'true' : 'false'}
                onClick={() => set({ roles: filters.roles.includes(r.id) ? filters.roles.filter((x) => x !== r.id) : [...filters.roles, r.id], classId: '' })}
              >
                <i class="role-glyph" aria-hidden="true" />
                {r.name}
              </button>
            ))}
          </div>
        </div>
        <div class="filter-group">
          <label class="filter-group__label" for="market-class">
            {t('filters.class')}
          </label>
          <span class="select-wrap">
            <select id="market-class" class="select select--sm" value={filters.classId} onChange={(e) => set({ classId: (e.target as HTMLSelectElement).value })}>
              <option value="">{t('filters.anyClass')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.archetypes.length > 1 ? ` (${roleNames(content, c.archetypes).join(' / ')})` : ''}
                </option>
              ))}
            </select>
          </span>
        </div>
        <div class="filter-group">
          <span class="filter-group__label">{t('filters.race')}</span>
          <div class="l-cluster">
            {content.races.list.map((r) => (
              <label class="check" key={r.id}>
                <input
                  type="checkbox"
                  checked={filters.races.includes(r.id)}
                  onChange={(e) =>
                    set({ races: (e.target as HTMLInputElement).checked ? [...filters.races, r.id] : filters.races.filter((x) => x !== r.id) })
                  }
                />
                {r.name}
              </label>
            ))}
          </div>
        </div>
        <div class="filter-group">
          <span class="filter-group__label">
            <span>{t('filters.age')}</span>
            <span class="u-num">
              {filters.ageMin} – {filters.ageMax}
            </span>
          </span>
          <div class="l-row">
            <input class="input input--sm u-num market-age" aria-label={t('filters.ageMin')} value={filters.ageMin} onChange={(e) => set({ ageMin: Number((e.target as HTMLInputElement).value) || 0 })} />
            <span class="u-faint">to</span>
            <input class="input input--sm u-num market-age" aria-label={t('filters.ageMax')} value={filters.ageMax} onChange={(e) => set({ ageMax: Number((e.target as HTMLInputElement).value) || 99 })} />
          </div>
        </div>
        <div class="filter-group">
          <span class="filter-group__label">
            <span>{t('filters.rating')}</span>
            <strong class="u-num">{filters.minRating}</strong>
          </span>
          <input class="range" type="range" min={1} max={100} value={filters.minRating} aria-label={t('filters.rating')} onInput={(e) => set({ minRating: Number((e.target as HTMLInputElement).value) })} />
        </div>
        <div class="filter-group">
          <label class="l-row u-sm">
            <input class="switch" type="checkbox" role="switch" checked={filters.fits} onChange={(e) => set({ fits: (e.target as HTMLInputElement).checked })} />
            <span>{t('filters.fits')}</span>
            <span class="l-push u-faint u-num">≤ {fmtMoney(market.wageRoom, content)}</span>
          </label>
          <label class="l-row u-sm">
            <input class="switch" type="checkbox" role="switch" checked={filters.noNeg} onChange={(e) => set({ noNeg: (e.target as HTMLInputElement).checked })} />
            <span>{t('filters.noNeg')}</span>
          </label>
          <label class="l-row u-sm">
            <input class="switch" type="checkbox" role="switch" checked={filters.starter} onChange={(e) => set({ starter: (e.target as HTMLInputElement).checked })} />
            <span>{t('filters.starter')}</span>
          </label>
          <label class="l-row u-sm" data-tip={t('tip.new')}>
            <input class="switch" type="checkbox" role="switch" checked={filters.onlyNew} onChange={(e) => set({ onlyNew: (e.target as HTMLInputElement).checked })} />
            <span>{t('filters.onlyNew')}</span>
            <span class="l-push u-faint u-num">{newCount}</span>
          </label>
        </div>
      </div>
    </aside>
  );
}

// ---- free-agent table --------------------------------------------------------------------------------

function offerBlock(r: MarketRow, m: ClubMarket, content: ContentDB): string | null {
  if (r.patience <= 0) return t('disabled.patience');
  if (m.embargo && r.ask > m.tierMinWage) return t('disabled.embargo', { min: fmtMoney(m.tierMinWage, content) });
  if (!r.pending && m.placesLeft <= 0)
    return m.pendingOffers > 0 ? t('disabled.fullPending', { roster: m.roster, pending: m.pendingOffers, cap: m.cap }) : t('disabled.full', { roster: m.roster, cap: m.cap });
  const excess = r.ask - (m.wageRoom + (r.pending?.wagePerWeek ?? 0));
  if (excess > 0) return t('disabled.roomRoom', { n: fmtMoney(excess, content) });
  return null;
}

function AgentsTable({
  rows,
  game,
  content,
  market,
  selected,
  setSelected,
  compare,
  toggleCompare,
  onOffer,
  store,
  onReset,
  testId,
}: {
  rows: MarketRow[];
  game: GameState;
  content: ContentDB;
  market: ClubMarket;
  selected: string | null;
  setSelected: (k: string) => void;
  compare: FighterId[];
  toggleCompare: (id: FighterId) => void;
  onOffer: (id: FighterId) => void;
  store: GameStore;
  onReset: () => void;
  testId: string;
}) {
  const shortlist = (r: MarketRow) => {
    const name = r.fighter.name.full;
    const cmd = { type: 'shortlist.toggle' as const, clubId: market.clubId, fighterId: r.fighter.id };
    const res = store.dispatch(cmd);
    if (res.ok) {
      showToast({ kind: 'accent', title: r.shortlisted ? t('toast.unshortlisted', { name }) : t('toast.shortlisted', { name }), undo: () => store.dispatch(cmd) });
    }
  };
  // With no room at all the banner above the table says it once, instead of a tag on every row.
  const overRoomTag = (r: MarketRow) => {
    const excess = r.ask - (market.wageRoom + (r.pending?.wagePerWeek ?? 0));
    return excess > 0 && market.wageRoom > 0 ? (
      <span class="tag tag--warn" data-tip={t('disabled.roomRoom', { n: fmtMoney(excess, content) })}>
        {t('tag.overRoom', { n: formatInt(excess) })}
      </span>
    ) : null;
  };
  const columns: Column<MarketRow>[] = [
    {
      id: 'compare',
      header: <span class="u-sr-only">{t('col.compare')}</span>,
      class: 'cell-tight',
      cell: (r) => (
        <input
          type="checkbox"
          class="market-check"
          aria-label={`${t('col.compare')} ${r.fighter.name.full}`}
          checked={compare.includes(r.fighter.id)}
          disabled={!compare.includes(r.fighter.id) && compare.length >= 3}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleCompare(r.fighter.id)}
        />
      ),
    },
    {
      id: 'fighter',
      header: t('col.fighter'),
      fill: true,
      sortValue: (r) => r.fighter.name.full,
      firstDir: 'asc',
      cell: (r) => (
        <span class="entity">
          <Portrait content={content} fighter={r.fighter} size="xs" />
          <FighterLink state={game} id={r.fighter.id} />
          {r.isNew && (
            <span class="tag tag--info" data-tip={t('tip.new')}>
              {t('tag.new')}
            </span>
          )}
          {r.pending && <span class="tag tag--accent">{t('tag.pending')}</span>}
        </span>
      ),
    },
    {
      id: 'starter',
      header: <span data-tip={t('tip.starter')}>{t('col.starter')}</span>,
      headerLabel: t('tag.starter'),
      align: 'center',
      class: 'col-wide',
      sortValue: (r) => (r.wouldStart ? 1 : 0),
      cell: (r) =>
        r.wouldStart ? (
          <span class="u-good" data-tip={t('tip.starter')}>
            <Icon name="check" label={t('tag.starter')} />
          </span>
        ) : (
          <span class="u-faint">—</span>
        ),
    },
    {
      id: 'class',
      header: t('col.class'),
      sortValue: (r) => content.classes.get(r.fighter.classId)?.name ?? '',
      firstDir: 'asc',
      cell: (r) => <ClassTag content={content} classId={r.fighter.classId} />,
    },
    {
      id: 'raceAge',
      header: t('col.raceAge'),
      class: 'col-mid',
      sortValue: (r) => r.view?.humanAge ?? r.fighter.age,
      firstDir: 'asc',
      cell: (r) => (
        <span data-tip={r.view ? `Human-age ${r.view.humanAge}` : undefined}>
          {content.races.get(r.fighter.raceId)?.name ?? r.fighter.raceId} · {r.fighter.age}
        </span>
      ),
    },
    { id: 'rating', header: t('col.rating'), align: 'num', sortValue: (r) => r.rating, cell: (r) => <RatingPill value={r.rating} /> },
    { id: 'potential', header: t('col.potential'), sortValue: (r) => r.potential, cell: (r) => <Stars potential={r.potential} /> },
    // Traits need the room of a wide screen; below it they are one hover away in Compare and the profile.
    { id: 'traits', header: t('col.traits'), class: 'col-wide', cell: (r) => <TraitDots content={content} traitIds={r.fighter.traits.map((x) => x.id)} /> },
    {
      // Below 1800 px: the ask for his preferred length. At 1800 px and up the next column shows all three.
      id: 'ask',
      header: t('col.ask'),
      class: 'col-narrow',
      align: 'num',
      sortValue: (r) => r.ask,
      cellAttrs: (r) => ({ 'data-tip': t('tip.ask', { n: r.preferred }) }),
      cell: (r) => (
        <span class="market-ask">
          <span class="u-num">{fmtMoney(r.ask, content)}</span>
          {overRoomTag(r)}
        </span>
      ),
    },
    {
      id: 'asks',
      header: <span data-tip={t('tip.asksHead')}>{t('col.asks')}</span>,
      headerLabel: t('col.asks'),
      class: 'col-wide',
      align: 'num',
      sortValue: (r) => r.ask,
      cellAttrs: (r) => ({ 'data-tip': t('tip.asks', { list: r.asks.map((a) => `${a.seasons} s: ${fmtMoney(a.ask, content)}`).join(' · ') }) }),
      cell: (r) => (
        <span class="market-ask">
          <span class="u-num market-asks">
            {r.asks.map((a, i) => (
              <span key={a.seasons} class={a.seasons === r.preferred ? 'u-strong' : 'u-muted'}>
                {i > 0 ? ' · ' : ''}
                {a.seasons === r.preferred ? '▸' : ''}
                {formatInt(a.ask)}
              </span>
            ))}
          </span>
          {overRoomTag(r)}
        </span>
      ),
    },
    {
      id: 'signing',
      header: <span data-tip={t('tip.signing')}>{t('col.signing')}</span>,
      headerLabel: t('tip.signingLabel'),
      class: 'col-wide',
      align: 'num',
      sortValue: (r) => (r.check?.ok ? r.check.value.signingCost : Number.MAX_SAFE_INTEGER),
      cellAttrs: (r) => ({ 'data-tip': r.check && !r.check.ok ? t('tip.signingNa', { reason: r.check.error.message }) : t('tip.signing') }),
      cell: (r) => (r.check?.ok ? <span class="u-num">{fmtMoney(r.check.value.signingCost, content)}</span> : <span class="u-faint">—</span>),
    },
    {
      id: 'rivals',
      header: t('col.rivals'),
      align: 'num',
      sortValue: (r) => r.rivals,
      cellAttrs: () => ({ 'data-tip': t('tip.rivals') }),
      cell: (r) => (r.rivals > 0 ? <span class="u-num u-strong">{r.rivals}</span> : <span class="u-faint">0</span>),
    },
    {
      id: 'willing',
      header: t('col.willing'),
      sortValue: (r) => r.patience,
      cell: (r) => {
        const level = willingLevel(r.patience, r.maxPatience);
        return (
          <span class="willing" data-level={level} data-tip={t('tip.willing', { n: r.patience, max: r.maxPatience })}>
            <span class="willing__pips" aria-hidden="true">
              {Array.from({ length: 3 }, (_, i) => (
                <i key={i} class={i < level ? 'is-on' : undefined} />
              ))}
            </span>
            <span class="col-wide">{t(`willing.${level as 0 | 1 | 2 | 3}`)}</span>
          </span>
        );
      },
    },
    {
      id: 'action',
      header: <span class="u-sr-only">{t('col.action')}</span>,
      class: 'cell-tight cell-sticky',
      cell: (r) => {
        const blocked = offerBlock(r, market, content);
        return (
          <span class="l-row market-actions">
            <button
              class="icon-btn market-pin"
              type="button"
              aria-pressed={r.shortlisted ? 'true' : 'false'}
              aria-label={r.shortlisted ? t('action.unshortlist') : t('action.shortlist')}
              data-tip={r.shortlisted ? t('action.unshortlist') : t('action.shortlist')}
              onClick={(e) => {
                e.stopPropagation();
                shortlist(r);
              }}
            >
              <Icon name="pin" />
            </button>
            <button
              class="btn btn--sm"
              type="button"
              aria-disabled={blocked ? 'true' : undefined}
              data-tip={blocked ?? undefined}
              data-testid="offer-button"
              onClick={(e) => {
                e.stopPropagation();
                if (!blocked) onOffer(r.fighter.id);
              }}
            >
              {t('action.offer')}
            </button>
          </span>
        );
      },
    },
  ];
  return (
    <DataTable
      label={t('results.title')}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.fighter.id}
      variant={['dense']}
      selectedKey={selected}
      onSelect={(k) => setSelected(k)}
      onOpen={(r) => {
        if (!offerBlock(r, market, content)) onOffer(r.fighter.id);
      }}
      rowClass={(r) => (offerBlock(r, market, content) ? 'is-dimmed' : undefined)}
      sortKey="market.agents"
      empty={
        <Empty compact icon="filter" title={t('results.empty')}>
          <button class="btn btn--sm" type="button" onClick={onReset}>
            {t('results.reset')}
          </button>
        </Empty>
      }
      testId={testId}
    />
  );
}

function CompareTray({
  game,
  content,
  clubFighters,
  compare,
  onOpen,
  engine,
  rows,
  compareOpen,
  onClose,
}: {
  game: GameState;
  content: ContentDB;
  clubFighters: Fighter[];
  compare: FighterId[];
  onOpen: () => void;
  engine: Wp7Engine;
  rows: MarketRow[];
  compareOpen: boolean;
  onClose: () => void;
}) {
  const [ours, setOurs] = useState<FighterId | null>(null);
  const firstRoles = compare[0] ? classRoles(content, game.fighters[compare[0]]?.classId ?? '') : [];
  const sameRole = clubFighters.find((f) => classRoles(content, f.classId).some((r) => firstRoles.includes(r)));
  const chosen = ours ?? sameRole?.id ?? clubFighters[0]?.id ?? null;
  const oursView = chosen ? tryView(() => engine.fighterView(game, chosen, content)) : null;
  if (compare.length === 0) return null;
  return (
    <>
      <div class="compare-tray" data-testid="compare-tray">
        <Icon name="compare" />
        <span class="u-sm">
          <strong>{compare.length}</strong> {t('compare.tray')}
        </span>
        <span class="select-wrap select-wrap--inline">
          <select class="select select--inline" aria-label={t('compare.with')} value={chosen ?? ''} onChange={(e) => setOurs((e.target as HTMLSelectElement).value as FighterId)}>
            {clubFighters.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name.full} · {content.classes.get(f.classId)?.name ?? ''}
              </option>
            ))}
          </select>
        </span>
        <span class="l-push u-xs u-faint">{t('compare.limit')}</span>
        <button class="btn btn--sm" type="button" onClick={onOpen}>
          {t('compare.open')} <kbd>C</kbd>
        </button>
      </div>
      <CompareDialog
        open={compareOpen}
        onClose={onClose}
        game={game}
        content={content}
        ours={chosen}
        oursView={oursView?.ok ? oursView.value : null}
        rows={compare.map((id) => rows.find((r) => r.fighter.id === id)).filter((r): r is MarketRow => Boolean(r))}
      />
    </>
  );
}

// ---- pending, renewals, rookies ----------------------------------------------------------------------

function PendingTable({
  game,
  content,
  engine,
  store,
  offers,
  onChange,
}: {
  game: GameState;
  content: ContentDB;
  engine: Wp7Engine;
  store: GameStore;
  offers: Offer[];
  onChange: (o: Offer) => void;
}) {
  const withdraw = (o: Offer) => {
    const name = game.fighters[o.fighterId]?.name.full ?? o.fighterId;
    const r = store.dispatch({ type: 'offer.withdraw', clubId: o.clubId, fighterId: o.fighterId });
    if (r.ok) {
      showToast({
        kind: 'accent',
        title: t('toast.withdrawn', { name }),
        undo: () => store.dispatch({ type: 'offer.make', clubId: o.clubId, fighterId: o.fighterId, wagePerWeek: o.wagePerWeek, seasons: o.seasons, acceptCounter: o.isCounterAcceptance }),
      });
    }
  };
  const columns: Column<Offer>[] = [
    {
      id: 'fighter',
      header: t('col.fighter'),
      fill: true,
      cell: (o) => {
        const f = game.fighters[o.fighterId];
        return (
          <span class="entity">
            <Portrait content={content} fighter={f ?? null} size="xs" />
            <FighterLink state={game} id={o.fighterId} />
          </span>
        );
      },
    },
    { id: 'class', header: t('col.class'), cell: (o) => (game.fighters[o.fighterId] ? <ClassTag content={content} classId={game.fighters[o.fighterId]!.classId} /> : null) },
    { id: 'wage', header: t('col.wage'), align: 'num', sortValue: (o) => o.wagePerWeek, cell: (o) => <span class="u-num">{fmtMoney(o.wagePerWeek, content)}</span> },
    { id: 'seasons', header: t('col.seasons'), align: 'num', cell: (o) => (o.seasons === 1 ? t('season1') : t('seasonsLong', { n: o.seasons })) },
    {
      id: 'terms',
      header: t('col.terms'),
      cell: (o) => {
        const f = game.fighters[o.fighterId];
        const a = tryView(() => engine.ask(game, o.fighterId, o.clubId, o.seasons, content));
        if (!f || !a.ok) return <span class="u-faint">—</span>;
        const terms = termsCheck(content, f, o.wagePerWeek, a.value);
        return terms.verdict === 'acceptable' ? (
          <span class="tag tag--good">{t('pending.meets')}</span>
        ) : (
          <span class="tag tag--warn">{t('pending.below', { ask: fmtMoney(a.value, content) })}</span>
        );
      },
    },
    {
      id: 'rivals',
      header: t('col.rivals'),
      align: 'num',
      cellAttrs: () => ({ 'data-tip': t('tip.rivals') }),
      cell: (o) => game.market.offers.filter((x) => x.fighterId === o.fighterId && x.clubId !== o.clubId).length,
    },
    { id: 'answer', header: t('col.answer'), class: 'col-mid', cell: () => <span class="u-muted">{t('pending.answer')}</span> },
    {
      id: 'action',
      header: <span class="u-sr-only">{t('col.action')}</span>,
      class: 'cell-tight',
      cell: (o) => (
        <span class="l-row market-actions">
          <button class="btn btn--sm btn--ghost" type="button" onClick={() => onChange(o)}>
            {t('action.offer')}
          </button>
          <button class="btn btn--sm" type="button" onClick={() => withdraw(o)} data-testid="withdraw">
            {t('action.withdraw')}
          </button>
        </span>
      ),
    },
  ];
  return (
    <Panel title={t('pending.title')} icon="mail" subtitle={t('pending.subtitle')} body="none" testId="market-pending">
      <DataTable
        label={t('pending.title')}
        columns={columns}
        rows={offers}
        rowKey={(o) => o.fighterId}
        variant={['compact']}
        empty={<Empty compact icon="mail" title={t('pending.empty')} text={t('pending.emptyText')} />}
      />
    </Panel>
  );
}

function RenewalsTable({
  game,
  content,
  engine,
  market,
  fighters,
  onRenew,
}: {
  game: GameState;
  content: ContentDB;
  engine: Wp7Engine;
  market: ClubMarket;
  fighters: Fighter[];
  onRenew: (id: FighterId) => void;
}) {
  const rows = fighters.map((f) => marketRow(engine, game, content, market, f, 'renewal'));
  const columns: Column<MarketRow>[] = [
    {
      id: 'fighter',
      header: t('col.fighter'),
      fill: true,
      sortValue: (r) => r.fighter.name.full,
      cell: (r) => (
        <span class="entity">
          <Portrait content={content} fighter={r.fighter} size="xs" />
          <FighterLink state={game} id={r.fighter.id} />
        </span>
      ),
    },
    { id: 'class', header: t('col.class'), cell: (r) => <ClassTag content={content} classId={r.fighter.classId} /> },
    { id: 'age', header: t('col.raceAge'), class: 'col-mid', cell: (r) => `${content.races.get(r.fighter.raceId)?.name ?? ''} · ${r.fighter.age}` },
    { id: 'rating', header: t('col.rating'), align: 'num', sortValue: (r) => r.rating, cell: (r) => <RatingPill value={r.rating} /> },
    { id: 'wage', header: t('col.wage'), align: 'num', sortValue: (r) => r.fighter.contract?.wagePerWeek ?? 0, cell: (r) => <span class="u-num">{fmtMoney(r.fighter.contract?.wagePerWeek ?? 0, content)}</span> },
    { id: 'contract', header: t('col.contract'), cell: (r) => <span class="tag tag--warn">{t('renewals.ends', { n: r.fighter.contract?.endSeason ?? '' })}</span> },
    { id: 'ask', header: t('col.ask'), align: 'num', sortValue: (r) => r.ask, cellAttrs: (r) => ({ 'data-tip': t('tip.ask', { n: r.preferred }) }), cell: (r) => <span class="u-num">{fmtMoney(r.ask, content)}</span> },
    {
      id: 'patience',
      header: t('col.patience'),
      cell: (r) => {
        const level = willingLevel(r.patience, r.maxPatience);
        return (
          <span class="willing" data-level={level} data-tip={t('tip.willing', { n: r.patience, max: r.maxPatience })}>
            <span class="willing__pips" aria-hidden="true">
              {Array.from({ length: 3 }, (_, i) => (
                <i key={i} class={i < level ? 'is-on' : undefined} />
              ))}
            </span>
            <span>{r.patience}</span>
          </span>
        );
      },
    },
    {
      id: 'action',
      header: <span class="u-sr-only">{t('col.action')}</span>,
      class: 'cell-tight',
      cell: (r) => (
        <button class="btn btn--sm" type="button" aria-disabled={r.patience <= 0 ? 'true' : undefined} onClick={() => r.patience > 0 && onRenew(r.fighter.id)} data-testid="renew-button">
          {t('action.renew')}
        </button>
      ),
    },
  ];
  return (
    <Panel title={t('renewals.title')} icon="contract" subtitle={t('renewals.subtitle')} body="none" testId="market-renewals">
      <DataTable
        label={t('renewals.title')}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.fighter.id}
        variant={['compact']}
        empty={<Empty compact icon="contract" title={t('renewals.empty')} text={t('renewals.emptyText')} />}
      />
    </Panel>
  );
}

function RookiesTable({
  game,
  content,
  engine,
  market,
  ids,
  onSign,
}: {
  game: GameState;
  content: ContentDB;
  engine: Wp7Engine;
  market: ClubMarket;
  ids: FighterId[];
  onSign: (id: FighterId) => void;
}) {
  const rows = ids
    .map((id) => game.fighters[id])
    .filter((f): f is Fighter => Boolean(f))
    .map((f) => marketRow(engine, game, content, market, f, 'trials'));
  const columns: Column<MarketRow>[] = [
    {
      id: 'fighter',
      header: t('col.fighter'),
      fill: true,
      cell: (r) => (
        <span class="entity">
          <Portrait content={content} fighter={r.fighter} size="xs" />
          <FighterLink state={game} id={r.fighter.id} />
        </span>
      ),
    },
    { id: 'class', header: t('col.class'), cell: (r) => <ClassTag content={content} classId={r.fighter.classId} /> },
    { id: 'age', header: t('col.raceAge'), cell: (r) => `${content.races.get(r.fighter.raceId)?.name ?? ''} · ${r.fighter.age}` },
    { id: 'rating', header: t('col.rating'), align: 'num', sortValue: (r) => r.rating, cell: (r) => <RatingPill value={r.rating} /> },
    { id: 'potential', header: t('col.potential'), sortValue: (r) => r.potential, cell: (r) => <Stars potential={r.potential} /> },
    { id: 'traits', header: t('col.traits'), cell: (r) => <TraitDots content={content} traitIds={r.fighter.traits.map((x) => x.id)} /> },
    { id: 'ask', header: t('col.ask'), align: 'num', sortValue: (r) => r.ask, cell: (r) => <span class="u-num">{fmtMoney(r.ask, content)}</span> },
    {
      id: 'action',
      header: <span class="u-sr-only">{t('col.action')}</span>,
      class: 'cell-tight',
      cell: (r) => (
        <button class="btn btn--sm" type="button" onClick={() => onSign(r.fighter.id)} aria-disabled={market.embargo ? 'true' : undefined}>
          {t('action.sign')}
        </button>
      ),
    },
  ];
  return (
    <Panel title={t('rookies.title')} icon="user-plus" subtitle={t('rookies.subtitle', { week: game.calendar.weekId ?? 'P1' })} body="none" testId="market-rookies">
      <DataTable
        label={t('rookies.title')}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.fighter.id}
        variant={['compact']}
        empty={<Empty compact icon="user-plus" title={t('rookies.none')} />}
      />
    </Panel>
  );
}
