/**
 * ui-finances · Finances (04 §6.3, not mocked; O10, 03 sys-finance): can we
 * afford the season, and where does the money go? Tiles, status with its
 * reason, the season budget and its parts, the wage bill, money by week,
 * the balance with its projection, and the ledger. Values come from
 * core/economy financeView and the ledger; nothing is computed as a rule.
 */
import { useState } from 'preact/hooks';
import type { ScreenProps } from '../../app/routes';
import type { ContentDB } from '../../../core/content';
import type { FinanceView } from '../../../core/economy';
import { LEDGER_CATEGORIES, type Fighter, type GameState, type LedgerCategory, type LedgerEntry } from '../../../core/model';
import { DataTable, Meter, PageHeader, Panel, Tag, type Column } from '../../components';
import { weekShort } from '../league/lib/calendar';
import { clubShort } from '../league/lib/club';
import { useWp7Engine } from '../league/lib/engine';
import { fmtMoney, fmtPctBp } from '../league/lib/format';
import { rosterOf } from '../league/lib/season';
import { useCareer, type Career } from '../league/lib/store';
import { Callout, Empty, FighterLink, NoCareer, Portrait, Segmented, Unavailable } from '../league/lib/ui';
import { tryView } from '../league/lib/views';
import { BalanceChart, WeeklyChart, type WeekMoney } from './Charts';
import { t } from './text';
import './finances.css';

export default function FinancesScreen(_props: ScreenProps) {
  const career = useCareer();
  if (!career) return <NoCareer testId="screen-finances" />;
  return <Finances career={career} />;
}

function categoryName(c: LedgerCategory): string {
  return t(`category.${c}`);
}

function Finances({ career }: { career: Career }) {
  const { game, content, club } = career;
  const engine = useWp7Engine();
  const view = tryView(() => engine.financeView(game, club.id, content));
  const tier = content.tiers.get(club.tierId);
  const season = game.calendar.season;
  const entries = game.ledger.entries.filter((e) => e.clubId === club.id && e.season === season);
  const opening = game.ledger.openingBalances[club.id] ?? club.finance.balance - entries.reduce((s, e) => s + e.amount, 0);

  // Money by week and the running balance (display arithmetic over the ledger).
  const weeks: WeekMoney[] = [];
  let running = opening;
  const processedTo = Math.max(0, ...entries.map((e) => e.weekIndex));
  for (const w of [...content.weeks.list].sort((a, b) => a.index - b.index)) {
    const list = entries.filter((e) => e.weekIndex === w.index);
    const income = list.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const costs = list.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);
    running += income + costs;
    weeks.push({ weekIndex: w.index, id: w.id, income, costs, balanceAfter: w.index <= processedTo ? running : null });
  }
  const lastWeek = [...weeks].reverse().find((w) => w.balanceAfter !== null) ?? null;

  return (
    <section class="page" data-testid="screen-finances">
      <PageHeader
        eyebrow={t('eyebrow', { season, tier: tier?.name ?? '' })}
        title={t('title')}
        meta={[
          view.ok ? (
            <Tag kind={view.value.status === 'healthy' ? 'good' : view.value.status === 'watch' ? 'warn' : 'bad'} tip={view.value.status === 'healthy' ? t('status.healthyTip') : (view.value.statusReason ?? undefined)}>
              {t(`status.${view.value.status}`)}
            </Tag>
          ) : null,
        ]}
      />
      {!view.ok ? (
        <Panel>
          <Unavailable what={t('unavailable')} compact={false} />
        </Panel>
      ) : (
        <FinanceBody game={game} content={content} career={career} view={view.value} weeks={weeks} lastWeek={lastWeek} opening={opening} entries={entries} />
      )}
    </section>
  );
}

function FinanceBody({
  game,
  content,
  career,
  view,
  weeks,
  lastWeek,
  opening,
  entries,
}: {
  game: GameState;
  content: ContentDB;
  career: Career;
  view: FinanceView;
  weeks: WeekMoney[];
  lastWeek: WeekMoney | null;
  opening: number;
  entries: LedgerEntry[];
}) {
  const { club } = career;
  const tierMin = content.tierProfile(content.tiers.get(club.tierId)?.level ?? 1).tierMinWage;
  const paidWeeks = content.weeks.list.length;
  const room = view.wageBudgetPerWeek - view.wageBill - view.pendingWages;
  const share = view.wageBudgetPerWeek > 0 ? (view.wageBill + view.pendingWages) / view.wageBudgetPerWeek : 1;
  const sbTotal = view.seasonBudgetParts.reduce((s, p) => s + p.amount, 0);
  const grantMarkers = content.economy.income.grantInstallments
    .map((g) => ({ weekIndex: content.weeks.list.find((w) => w.id === g.atWeek)?.index ?? -1, label: t('chart.grant') }))
    .filter((m) => m.weekIndex > 0);
  const reckoningWeek = content.weeks.list.find((w) => w.phase === 'tournament');
  const markers = [...grantMarkers, ...(reckoningWeek ? [{ weekIndex: reckoningWeek.index, label: t('chart.reckoning') }] : [])];
  const byCat = Object.entries(view.byCategory) as [LedgerCategory, number][];
  const incomeCats = byCat.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const costCats = byCat.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  const net = byCat.reduce((s, [, v]) => s + v, 0);

  return (
    <div class="l-stack finance">
      {view.status === 'watch' && (
        <Callout kind="warn" title={t('status.watchTitle')}>
          {t('status.watchText', { reason: view.statusReason ?? '' })}
        </Callout>
      )}
      {view.status === 'embargo' && (
        <Callout kind="bad" title={t('status.embargoTitle', { balance: fmtMoney(view.balance, content), min: fmtMoney(tierMin, content) })}>
          {t('status.embargoText', { reason: view.statusReason ?? '', weeks: content.economy.finance.registryAdvance.consecutiveWeeksInDebt })}
        </Callout>
      )}
      {view.registryDebt > 0 && (
        <Callout kind="warn" title={t('registry.title', { debt: fmtMoney(view.registryDebt, content) })}>
          {t('registry.text', { cap: fmtPctBp(content.economy.finance.registryAdvance.deductionCapBpOfGrant) })}
        </Callout>
      )}

      <Panel testId="finance-tiles">
        <div class="tile-row finance-tiles" style={{ '--tiles': 4 }}>
          <div class="stat-tile" data-tip={t('tip.balance')} tabIndex={0}>
            <span class="stat-tile__label">{t('tile.balance')}</span>
            <span class={view.balance < 0 ? 'stat-tile__value u-bad' : 'stat-tile__value'} data-testid="tile-balance">
              {fmtMoney(view.balance, content)}
            </span>
            <span class="stat-tile__sub">{t('tile.balanceSub', { delta: fmtMoney(view.balance - opening, content, { signed: true }) })}</span>
          </div>
          <div class="stat-tile">
            <span class="stat-tile__label">{t('tile.lastWeek')}</span>
            {lastWeek ? (
              <>
                <span class="stat-tile__value">{fmtMoney(lastWeek.income + lastWeek.costs, content, { signed: true })}</span>
                <span class="stat-tile__sub">
                  {t('tile.lastWeekSub', { week: lastWeek.id, income: fmtMoney(lastWeek.income, content), costs: fmtMoney(-lastWeek.costs, content) })}
                </span>
              </>
            ) : (
              <span class="stat-tile__sub">{t('tile.lastWeekNone')}</span>
            )}
          </div>
          <div class="stat-tile">
            <span class="stat-tile__label">{t('tile.wages')}</span>
            <span class="stat-tile__value">
              {fmtMoney(view.wageBill, content)} <small>/ wk</small>
            </span>
            <Meter value={share} mark={1} state={share > 1 ? 'bad' : share > 0.9 ? 'warn' : 'good'} thin />
            <span class="stat-tile__sub">
              {t('tile.wagesSub', { pending: fmtMoney(view.pendingWages, content), budget: fmtMoney(view.wageBudgetPerWeek, content) })}
            </span>
          </div>
          <div class="stat-tile" data-tip={t('tip.projected')} tabIndex={0}>
            <span class="stat-tile__label">{t('tile.projected')}</span>
            <span class={view.projectedSeasonEndBalance < 0 ? 'stat-tile__value u-bad' : 'stat-tile__value'}>{fmtMoney(view.projectedSeasonEndBalance, content)}</span>
            <span class="stat-tile__sub">{t('tile.projectedSub')}</span>
          </div>
        </div>
      </Panel>

      <div class="l-grid">
        <Panel title={t('budget.title')} icon="coins" subtitle={t('budget.subtitle')} class="span-6 span-4@wide" testId="finance-budget">
          <dl class="kv">
            {view.seasonBudgetParts.map((p) => (
              <div key={p.label}>
                <dt>{p.label}</dt>
                <dd>{fmtMoney(p.amount, content)}</dd>
              </div>
            ))}
            <div class="finance-total">
              <dt>{t('budget.total')}</dt>
              <dd>{fmtMoney(view.seasonBudget || sbTotal, content)}</dd>
            </div>
            <div>
              <dt>
                <span class="term" tabIndex={0} data-tip={t('budget.wbTip', { weeks: paidWeeks })}>
                  {t('budget.wb')}
                </span>
              </dt>
              <dd>{fmtMoney(view.wageBudgetPerWeek, content)}</dd>
            </div>
            <div>
              <dt>
                <span class="term" tabIndex={0} data-tip={t('budget.roomTip')}>
                  {t('budget.room')}
                </span>
              </dt>
              <dd class={room < 0 ? 'u-bad' : undefined}>{fmtMoney(room, content)}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title={t('cat.title')} icon="finances" subtitle={t('cat.subtitle')} class="span-6 span-4@wide" testId="finance-categories">
          {byCat.length === 0 ? (
            <p class="u-sm u-muted">{t('cat.none')}</p>
          ) : (
            <div class="l-stack l-stack--sm">
              <div class="panel-section__title">{t('cat.income')}</div>
              <dl class="kv">
                {incomeCats.map(([c, v]) => (
                  <div key={c}>
                    <dt>{categoryName(c)}</dt>
                    <dd>{fmtMoney(v, content, { signed: true })}</dd>
                  </div>
                ))}
              </dl>
              <div class="panel-section__title">{t('cat.costs')}</div>
              <dl class="kv">
                {costCats.map(([c, v]) => (
                  <div key={c}>
                    <dt>{categoryName(c)}</dt>
                    <dd>{fmtMoney(v, content)}</dd>
                  </div>
                ))}
                <div class="finance-total">
                  <dt>{t('cat.net')}</dt>
                  <dd class={net < 0 ? 'u-bad' : undefined}>{fmtMoney(net, content, { signed: true })}</dd>
                </div>
              </dl>
            </div>
          )}
        </Panel>

        <WageTable game={game} content={content} career={career} wageBudget={view.wageBudgetPerWeek} />

        <Panel title={t('chart.weekly')} icon="finances" subtitle={t('chart.weeklySub')} class="span-6" testId="finance-weekly"
          footer={
            <span class="legend">
              <span class="legend__item">
                <span class="legend__swatch" style={{ '--swatch': 'var(--c-accent)' }} />
                {t('chart.income')}
              </span>
              <span class="legend__item">
                <span class="legend__swatch" style={{ '--swatch': 'var(--c-text-muted)' }} />
                {t('chart.costs')}
              </span>
            </span>
          }
        >
          <WeeklyChart content={content} weeks={weeks} />
        </Panel>
        <Panel title={t('chart.balance')} icon="trend" subtitle={t('chart.balanceSub')} class="span-6" testId="finance-balance"
          footer={
            <span class="legend">
              <span class="legend__item">
                <span class="legend__swatch" style={{ '--swatch': 'var(--c-chart-line)' }} />
                {t('chart.booked')}
              </span>
              <span class="legend__item">
                <span class="legend__swatch finance-swatch--dashed" />
                {t('chart.projected')}
              </span>
              <span class="legend__item">
                <span class="legend__swatch" style={{ '--swatch': 'var(--c-accent)' }} />
                {t('chart.grant')} · {t('chart.reckoning')}
              </span>
            </span>
          }
        >
          <BalanceChart content={content} weeks={weeks} opening={opening} projected={view.projectedSeasonEndBalance} markers={markers} />
        </Panel>

        <Ledger game={game} content={content} entries={entries} opening={opening} />
      </div>
    </div>
  );
}

function WageTable({ game, content, career, wageBudget }: { game: GameState; content: ContentDB; career: Career; wageBudget: number }) {
  const fighters = rosterOf(game, career.club.id).filter((f) => f.contract);
  const season = game.calendar.season;
  const columns: Column<Fighter>[] = [
    {
      id: 'fighter',
      header: t('col.fighter'),
      fill: true,
      sortValue: (f) => f.name.full,
      firstDir: 'asc',
      cell: (f) => (
        <span class="entity">
          <Portrait content={content} fighter={f} size="xs" />
          <FighterLink state={game} id={f.id} />
        </span>
      ),
    },
    { id: 'wage', header: t('col.wage'), align: 'num', sortValue: (f) => f.contract!.wagePerWeek, cell: (f) => <span class="u-num">{fmtMoney(f.contract!.wagePerWeek, content)}</span> },
    {
      id: 'ends',
      header: t('col.ends'),
      sortValue: (f) => f.contract!.endSeason,
      firstDir: 'asc',
      cell: (f) =>
        f.contract!.endSeason === season ? <span class="tag tag--warn">{t('endsFinal', { n: f.contract!.endSeason })}</span> : <span class="u-muted">{t('ends', { n: f.contract!.endSeason })}</span>,
    },
    {
      id: 'share',
      header: t('col.share'),
      class: 'col-mid',
      sortValue: (f) => f.contract!.wagePerWeek,
      cell: (f) => {
        const v = wageBudget > 0 ? f.contract!.wagePerWeek / wageBudget : 0;
        return (
          <span class="finance-share" data-tip={`${Math.round(v * 100)}%`}>
            <Meter value={v * 4} thin />
            <span class="u-num u-xs u-muted">{Math.round(v * 100)}%</span>
          </span>
        );
      },
    },
  ];
  return (
    <Panel title={t('wages.title')} icon="contract" subtitle={t('wages.subtitle', { n: fighters.length })} class="span-12 span-4@wide" body="flush" testId="finance-wages">
      <DataTable
        label={t('wages.title')}
        columns={columns}
        rows={fighters}
        rowKey={(f) => f.id}
        variant={['compact']}
        defaultSort={{ column: 'wage', dir: 'desc' }}
        maxHeight="22rem"
        empty={<Empty compact icon="contract" title={t('wages.empty')} />}
      />
    </Panel>
  );
}

type LedgerFilter = 'all' | 'income' | 'costs';

function Ledger({ game, content, entries, opening }: { game: GameState; content: ContentDB; entries: LedgerEntry[]; opening: number }) {
  const [filter, setFilter] = useState<LedgerFilter>('all');
  const [category, setCategory] = useState<string>('');
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  const after = new Map<number, number>();
  let run = opening;
  for (const e of sorted) {
    run += e.amount;
    after.set(e.seq, run);
  }
  const rows = sorted
    .filter((e) => (filter === 'income' ? e.amount > 0 : filter === 'costs' ? e.amount < 0 : true))
    .filter((e) => !category || e.category === category)
    .reverse();
  const used = LEDGER_CATEGORIES.filter((c) => entries.some((e) => e.category === c));
  const itemOf = (e: LedgerEntry) => {
    const parts: string[] = [categoryName(e.category)];
    if (e.fighterId) parts.push(game.fighters[e.fighterId]?.name.full ?? e.fighterId);
    if (e.fixtureId) {
      const f = game.fixtures[e.fixtureId];
      if (f) parts.push(t('ledger.vs', { club: clubShort(game, f.homeClubId === e.clubId ? f.awayClubId : f.homeClubId) }));
    }
    return parts.join(' · ');
  };
  const columns: Column<LedgerEntry>[] = [
    { id: 'week', header: t('col.week'), class: 'cell-tight', sortValue: (e) => e.seq, cell: (e) => weekShort(content, e.weekIndex) },
    { id: 'item', header: t('col.item'), fill: true, sortValue: (e) => categoryName(e.category), firstDir: 'asc', cell: (e) => <span class="u-truncate">{itemOf(e)}</span> },
    {
      id: 'amount',
      header: t('col.amount'),
      align: 'num',
      sortValue: (e) => e.amount,
      cell: (e) => <span class={e.amount < 0 ? 'u-num' : 'u-num u-good'}>{fmtMoney(e.amount, content, { signed: true })}</span>,
    },
    { id: 'balance', header: t('col.balance'), align: 'num', cell: (e) => <span class="u-num u-muted">{fmtMoney(after.get(e.seq) ?? 0, content)}</span> },
  ];
  return (
    <Panel
      title={t('ledger.title')}
      icon="scroll"
      subtitle={t('ledger.subtitle', { n: entries.length })}
      class="span-12"
      body="flush"
      testId="finance-ledger"
      actions={
        <>
          <Segmented
            label={t('ledger.filter')}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('ledger.all') },
              { value: 'income', label: t('ledger.income') },
              { value: 'costs', label: t('ledger.costs') },
            ]}
          />
          <span class="select-wrap select-wrap--inline">
            <select class="select select--inline" aria-label={t('ledger.category')} value={category} onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}>
              <option value="">{t('ledger.anyCategory')}</option>
              {used.map((c) => (
                <option key={c} value={c}>
                  {categoryName(c)}
                </option>
              ))}
            </select>
          </span>
        </>
      }
      footer={
        <span>
          {t('ledger.opening')}: {fmtMoney(opening, content)}
        </span>
      }
    >
      <DataTable
        label={t('ledger.title')}
        columns={columns}
        rows={rows}
        rowKey={(e) => String(e.seq)}
        variant={['compact']}
        maxHeight="26rem"
        empty={<Empty compact icon="scroll" title={t('ledger.empty')} text={t('ledger.emptyText')} />}
        testId="ledger-table"
      />
    </Panel>
  );
}
