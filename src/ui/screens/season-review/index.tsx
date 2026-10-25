/**
 * ui-season-end · Season-end review (04 §6.3, not mocked; flow-state-007):
 * everything the season-end step did, in order and read-only: final
 * standings, the Reckoning, money and prestige, aging and development,
 * retirements and contracts, next season. Begin next season returns to Home.
 * Before the step has run (phase season-end) it offers the binding commit.
 */
import { useState } from 'preact/hooks';
import type { ScreenProps } from '../../app/routes';
import { useShortcuts } from '../../app/shortcuts';
import type { ContentDB } from '../../../core/content';
import type { ClubId, Fighter, FighterSeasonRow, GameState, SeasonEndReport, SeasonRecord, TierId, TierSeasonRecord } from '../../../core/model';
import { ConfirmButton, DataTable, PageHeader, Panel, type Column } from '../../components';
import { BracketView, storedBracket } from '../league/Bracket';
import { StandingsTable, type Zones } from '../league/StandingsTable';
import { clubName } from '../league/lib/club';
import { useWp7Engine } from '../league/lib/engine';
import { fmtMoney, fmtPctBp, ordinal } from '../league/lib/format';
import { reckoningCompetition, rosterOf } from '../league/lib/season';
import { go, href, useCareer, type Career } from '../league/lib/store';
import { Callout, Delta, Empty, FighterLink, NoCareer, Portrait, RatingPill, Stars, Tabs } from '../league/lib/ui';
import { tryView } from '../league/lib/views';
import { t } from './text';
import './season-review.css';

type Step = 'standings' | 'reckoning' | 'money' | 'development' | 'contracts' | 'next';
const STEPS: Step[] = ['standings', 'reckoning', 'money', 'development', 'contracts', 'next'];

export default function SeasonReviewScreen(_props: ScreenProps) {
  const career = useCareer();
  if (!career) return <NoCareer testId="screen-season-review" />;
  return <Review career={career} />;
}

/** The finished season: the store's last report, else the newest archived season. */
function reviewSource(game: GameState, clubId: ClubId, report: SeasonEndReport | null): { record: SeasonRecord; report: SeasonEndReport | null } | null {
  if (report) return { record: report.record, report };
  const record = game.history[game.history.length - 1];
  if (!record) return null;
  void clubId;
  return { record, report: null };
}

function Review({ career }: { career: Career }) {
  const { store, game, club } = career;
  const report = store.lastSeasonEndReport.value;
  const source = reviewSource(game, club.id, report);
  if (!source) {
    if (game.calendar.phase === 'season-end') return <PendingSeasonEnd career={career} />;
    return (
      <section class="page" data-testid="screen-season-review">
        <Empty icon="league" title={t('none.title')} text={t('none.text')} />
      </section>
    );
  }
  return <ReviewSteps career={career} record={source.record} report={source.report} />;
}

function PendingSeasonEnd({ career }: { career: Career }) {
  const { store, game } = career;
  return (
    <section class="page" data-testid="screen-season-review">
      <PageHeader eyebrow={t('eyebrow', { season: game.calendar.season })} title={t('pending.title')} />
      <Panel>
        <div class="l-stack review-pending">
          <p class="u-sm u-muted">{t('pending.text')}</p>
          <div>
            <ConfirmButton
              variant="primary"
              title={t('pending.confirmTitle')}
              confirmLabel={t('pending.confirm')}
              warning={t('pending.warn')}
              consequences={[
                { label: t('pending.c1'), value: t('pending.c1v') },
                { label: t('pending.c2'), value: t('pending.c2v') },
                { label: t('pending.c3'), value: t('pending.c3v') },
                { label: t('pending.c4'), value: t('pending.c4v') },
              ]}
              onConfirm={() => store.finishSeason()}
              disabled={store.busy.value}
              testId="run-season-end"
            >
              {t('pending.button')}
            </ConfirmButton>
          </div>
        </div>
      </Panel>
    </section>
  );
}

function tierRecordOf(record: SeasonRecord, clubId: ClubId): TierSeasonRecord | null {
  return record.tiers.find((x) => x.tierTable.some((r) => r.clubId === clubId)) ?? null;
}

function ReviewSteps({ career, record, report }: { career: Career; record: SeasonRecord; report: SeasonEndReport | null }) {
  const { game, content, club } = career;
  const [step, setStep] = useState<Step>('standings');
  const i = STEPS.indexOf(step);
  const begin = () => go('home');

  // 04 ui-season-end: ← → steps, Enter begins the next season on the last step.
  useShortcuts({
    ArrowRight: () => (i < STEPS.length - 1 ? setStep(STEPS[i + 1]!) : false),
    ArrowLeft: () => (i > 0 ? setStep(STEPS[i - 1]!) : false),
    Enter: () => (i === STEPS.length - 1 ? begin() : false),
  });

  const tierRec = tierRecordOf(record, club.id);
  return (
    <section class="page" data-testid="screen-season-review">
      <PageHeader eyebrow={t('eyebrow', { season: record.season })} title={t('title', { season: record.season })} meta={[t('meta')]} />
      <Tabs
        label={t('steps')}
        idPrefix="review"
        value={step}
        onChange={setStep}
        tabs={STEPS.map((s, n) => ({ value: s, label: `${n + 1} · ${t(`step.${s}`)}` }))}
      />
      <div class="review-body" data-testid={`review-step-${step}`}>
        {step === 'standings' && <StandingsStep game={game} content={content} record={record} tierRec={tierRec} clubId={club.id} />}
        {step === 'reckoning' && <ReckoningStep game={game} content={content} record={record} tierRec={tierRec} clubId={club.id} />}
        {step === 'money' && <MoneyStep game={game} content={content} record={record} report={report} career={career} />}
        {step === 'development' && <DevelopmentStep game={game} content={content} record={record} clubId={club.id} />}
        {step === 'contracts' && <ContractsStep game={game} content={content} record={record} report={report} clubId={club.id} />}
        {step === 'next' && <NextStep game={game} content={content} career={career} />}
      </div>
      <div class="l-row review-nav">
        <button class="btn" type="button" disabled={i === 0} onClick={() => setStep(STEPS[i - 1]!)}>
          <span class="icon" data-icon="chevron-left" aria-hidden="true" />
          {t('back')}
        </button>
        <span class="u-xs u-faint">{t('hint')}</span>
        <span class="l-push" />
        {i < STEPS.length - 1 ? (
          <button class="btn btn--primary" type="button" onClick={() => setStep(STEPS[i + 1]!)} data-testid="review-next">
            {t('next')}
            <span class="icon" data-icon="chevron-right" aria-hidden="true" />
          </button>
        ) : (
          <a class="btn btn--primary btn--lg" href={href('home')} data-testid="review-begin">
            {t('begin')} <kbd>Enter</kbd>
          </a>
        )}
      </div>
    </section>
  );
}

// ---- steps ----------------------------------------------------------------------------------

function movement(content: ContentDB, game: GameState, record: SeasonRecord, clubId: ClubId): { kind: 'promoted' | 'relegated' | 'stayed'; tierName: string } {
  const rec = tierRecordOf(record, clubId);
  const club = game.clubs[clubId];
  const nowTier = club ? content.tiers.get(club.tierId) : undefined;
  if (rec?.promotedIds.includes(clubId)) return { kind: 'promoted', tierName: nowTier?.name ?? '' };
  if (rec?.relegatedIds.includes(clubId)) return { kind: 'relegated', tierName: nowTier?.name ?? '' };
  return { kind: 'stayed', tierName: content.tiers.get(rec?.tierId ?? club?.tierId ?? '')?.name ?? '' };
}

function StandingsStep({ game, content, record, tierRec, clubId }: { game: GameState; content: ContentDB; record: SeasonRecord; tierRec: TierSeasonRecord | null; clubId: ClubId }) {
  if (!tierRec) return <Empty icon="league" title={t('none.title')} />;
  const tier = content.tiers.get(tierRec.tierId);
  const tiers = [...content.tiers.list].sort((a, b) => a.level - b.level);
  const lowest = tiers[tiers.length - 1]?.level ?? 1;
  const level = tier?.level ?? 1;
  const move = movement(content, game, record, clubId);
  const wing = tierRec.wingTables.find((w) => w.rows.some((r) => r.clubId === clubId));
  const wingRow = wing?.rows.find((r) => r.clubId === clubId);
  const tierRow = tierRec.tierTable.find((r) => r.clubId === clubId);
  const zones: Zones = {
    qualifiers: content.leagues.tournament.qualifiersPerWing,
    relegateFrom: level < lowest ? content.leagues.wings.size - content.leagues.promotionRelegation.relegatePerWing + 1 : null,
    shieldLeaderId: tierRec.shieldWinnerId,
    shieldPromotes: level > 1,
  };
  const wingName = (id: string) => content.leagues.wings.list.find((w) => w.id === id)?.name ?? id;
  const isChampion = tierRec.reckoningChampionId === clubId;
  return (
    <div class="l-stack">
      <section class={`panel panel--hero review-move review-move--${move.kind}`} data-testid="review-move">
        <div class="review-move__body">
          <span class="review-move__icon" aria-hidden="true">
            <span class="icon icon--lg" data-icon={move.kind === 'promoted' ? 'arrow-up' : move.kind === 'relegated' ? 'arrow-down' : 'shield'} />
          </span>
          <div>
            <div class="review-move__title u-display">
              {move.kind === 'promoted' ? t('move.promoted', { tier: move.tierName }) : move.kind === 'relegated' ? t('move.relegated', { tier: move.tierName }) : t('move.stayed', { tier: move.tierName })}
            </div>
            {wingRow && tierRow && (
              <div class="u-sm u-muted">
                {t('move.finish', { wingPos: ordinal(wingRow.position), wing: wing ? wingName(wing.wingId) : '', tierPos: ordinal(tierRow.position), points: tierRow.points })}
                {isChampion && ` · ${t('move.champion', { tier: tier?.tournamentName ?? '' })}`}
              </div>
            )}
          </div>
        </div>
      </section>
      <div class="l-grid">
        <Panel title={t('standings.wings', { tier: tier?.name ?? '' })} icon="league" class="span-8" testId="review-tables">
          <div class="l-grid review-wings">
            {tierRec.wingTables.map((w) => (
              <div class="span-6" key={w.wingId}>
                <div class="panel-section__title">{wingName(w.wingId)}</div>
                <StandingsTable state={game} content={content} rows={w.rows} variant="wing" zones={zones} usId={clubId} caption={wingName(w.wingId)} showForm={false} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={t('standings.honours')} icon="crown" class="span-4" testId="review-honours">
          <dl class="kv">
            <div>
              <dt>{tier?.shieldName ?? t('standings.shield')}</dt>
              <dd>{tierRec.shieldWinnerId ? clubName(game, tierRec.shieldWinnerId) : t('standings.none')}</dd>
            </div>
            <div>
              <dt>{t('standings.champion')}</dt>
              <dd>{tierRec.reckoningChampionId ? clubName(game, tierRec.reckoningChampionId) : t('standings.none')}</dd>
            </div>
            <div>
              <dt>{t('standings.runnerUp')}</dt>
              <dd>{tierRec.reckoningRunnerUpId ? clubName(game, tierRec.reckoningRunnerUpId) : t('standings.none')}</dd>
            </div>
          </dl>
          {record.tiers.map((tr) => {
            const tname = content.tiers.get(tr.tierId)?.shortName ?? tr.tierId;
            return (
              <dl class="kv review-moves" key={tr.tierId}>
                {tr.promotedIds.length > 0 && (
                  <div>
                    <dt>{t('standings.promoted', { tier: tname })}</dt>
                    <dd class="review-names">{tr.promotedIds.map((id) => clubName(game, id)).join(', ')}</dd>
                  </div>
                )}
                {tr.relegatedIds.length > 0 && (
                  <div>
                    <dt>{t('standings.relegated', { tier: tname })}</dt>
                    <dd class="review-names">{tr.relegatedIds.map((id) => clubName(game, id)).join(', ')}</dd>
                  </div>
                )}
              </dl>
            );
          })}
        </Panel>
      </div>
    </div>
  );
}

function ReckoningStep({ game, content, record, tierRec, clubId }: { game: GameState; content: ContentDB; record: SeasonRecord; tierRec: TierSeasonRecord | null; clubId: ClubId }) {
  const tierId = (tierRec?.tierId ?? game.clubs[clubId]?.tierId) as TierId;
  const tier = content.tiers.get(tierId);
  const comp = reckoningCompetition(game, record.season, tierId);
  const model = comp ? storedBracket(game, content, comp) : null;
  const row = game.clubs[clubId]?.history.find((h) => h.season === record.season);
  const stage = row?.reckoning ?? null;
  const prize = content.tierProfile(tier?.level ?? 1).tournamentPrize;
  return (
    <div class="l-grid">
      <Panel title={t('reckoning.title', { tournament: tier?.tournamentName ?? '', season: record.season })} icon="swords" class="span-9" testId="review-bracket">
        {model ? (
          <div class="league-bracket-body">
            <BracketView state={game} content={content} model={model} usId={clubId} tierId={tierId} />
          </div>
        ) : (
          <Callout title={t('reckoning.noBracket')}>{tierRec?.reckoningChampionId ? clubName(game, tierRec.reckoningChampionId) : ''}</Callout>
        )}
      </Panel>
      <Panel title={t('reckoning.ours')} icon="target" class="span-3">
        <div class="review-stage u-display">{stage ? t(`reckoning.stage.${stage}`) : t('reckoning.stage.none')}</div>
        <div class="panel-section__title u-mt-4">{t('reckoning.prizes')}</div>
        <dl class="kv">
          <div class={stage === 'quarterfinal' ? 'review-hit' : undefined}>
            <dt>{t('reckoning.stage.quarterfinal')}</dt>
            <dd>{fmtMoney(prize.quarterfinal, content)}</dd>
          </div>
          <div class={stage === 'semifinal' ? 'review-hit' : undefined}>
            <dt>{t('reckoning.stage.semifinal')}</dt>
            <dd>{fmtMoney(prize.semifinal, content)}</dd>
          </div>
          <div class={stage === 'final' ? 'review-hit' : undefined}>
            <dt>{t('reckoning.stage.final')}</dt>
            <dd>{fmtMoney(prize.finalist, content)}</dd>
          </div>
          <div class={stage === 'champion' ? 'review-hit' : undefined}>
            <dt>{t('reckoning.stage.champion')}</dt>
            <dd>{fmtMoney(prize.champion, content)}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}

function MoneyStep({ game, content, record, report, career }: { game: GameState; content: ContentDB; record: SeasonRecord; report: SeasonEndReport | null; career: Career }) {
  const club = career.club;
  const row = club.history.find((h) => h.season === record.season);
  const prev = club.history.find((h) => h.season === record.season - 1);
  const prestigeDelta = row && prev ? row.prestigeEnd - prev.prestigeEnd : null;
  return (
    <div class="l-grid">
      <Panel title={t('money.title')} icon="coins" class="span-6" testId="review-money">
        <dl class="kv">
          <div>
            <dt>{t('money.prizes')}</dt>
            <dd>{report?.playerClub ? fmtMoney(report.playerClub.prizes, content, { signed: true }) : '—'}</dd>
          </div>
          <div>
            <dt>{t('money.income')}</dt>
            <dd>{row ? fmtMoney(row.income, content) : '—'}</dd>
          </div>
          <div>
            <dt>{t('money.costs')}</dt>
            <dd>{row ? fmtMoney(-Math.abs(row.costs), content) : '—'}</dd>
          </div>
          <div class="review-total">
            <dt>{t('money.end')}</dt>
            <dd>{row ? fmtMoney(row.endBalance, content) : '—'}</dd>
          </div>
        </dl>
      </Panel>
      <Panel title={t('money.next')} icon="finances" class="span-6">
        <dl class="kv">
          <div>
            <dt>{t('money.sb')}</dt>
            <dd>{fmtMoney(club.finance.seasonBudget, content)}</dd>
          </div>
          <div>
            <dt>{t('money.wb')}</dt>
            <dd>{fmtMoney(club.finance.wageBudgetPerWeek, content)}</dd>
          </div>
          <div>
            <dt>
              <span class="term" tabIndex={0} data-tip={t('money.prestigeTip')}>
                {t('money.prestigeNow')}
              </span>
            </dt>
            <dd>
              {row ? row.prestigeEnd : club.prestige} {prestigeDelta !== null && <Delta value={prestigeDelta} />}
            </dd>
          </div>
        </dl>
      </Panel>
      <p class="span-12 u-xs u-faint">{game.calendar.season > record.season ? t('next.drawn') : ''}</p>
    </div>
  );
}

interface DevRow {
  fighter: Fighter;
  rating: number | null;
  potential: number | null;
  humanAge: number | null;
  trend: string | null;
  row: FighterSeasonRow | null;
  prev: FighterSeasonRow | null;
}

function DevelopmentStep({ game, content, record, clubId }: { game: GameState; content: ContentDB; record: SeasonRecord; clubId: ClubId }) {
  const engine = useWp7Engine();
  const roster = rosterOf(game, clubId);
  const rows: DevRow[] = roster.map((f) => {
    const v = tryView(() => engine.fighterView(game, f.id, content));
    return {
      fighter: f,
      rating: v.ok ? v.value.rating : null,
      potential: v.ok ? v.value.potential : null,
      humanAge: v.ok ? v.value.humanAge : null,
      trend: v.ok ? v.value.trend : null,
      row: f.history.find((h) => h.season === record.season) ?? null,
      prev: f.history.find((h) => h.season === record.season - 1) ?? null,
    };
  });
  const statName = (id: string) => content.stats.get(id)?.name ?? id;
  const columns: Column<DevRow>[] = [
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
        </span>
      ),
    },
    {
      id: 'age',
      header: t('col.age'),
      sortValue: (r) => r.humanAge ?? r.fighter.age,
      cellAttrs: (r): Record<string, string> => (r.humanAge !== null ? { 'data-tip': t('ageTip', { human: r.humanAge }) } : {}),
      cell: (r) => (
        <span>
          {t('age', { race: content.races.get(r.fighter.raceId)?.name ?? '', age: r.fighter.age })} <Delta value={1} />
        </span>
      ),
    },
    {
      id: 'rating',
      header: t('col.rating'),
      align: 'num',
      sortValue: (r) => r.row?.rating ?? r.rating ?? 0,
      cell: (r) => (r.row?.rating ?? r.rating) !== null ? <RatingPill value={(r.row?.rating ?? r.rating)!} /> : '—',
    },
    {
      id: 'change',
      header: t('col.change'),
      align: 'num',
      sortValue: (r) => (r.row && r.prev ? r.row.rating - r.prev.rating : 0),
      cell: (r) => (r.row && r.prev ? <Delta value={r.row.rating - r.prev.rating} /> : <span class="u-faint">—</span>),
    },
    {
      id: 'attributes',
      header: t('col.attributes'),
      class: 'col-mid',
      cell: (r) => {
        if (!r.row || !r.prev) return <span class="u-faint">—</span>;
        const changes = Object.entries(r.row.stats)
          .map(([id, v]) => ({ id, d: v - (r.prev!.stats[id as never] ?? v) }))
          .filter((c) => c.d !== 0);
        const up = changes.filter((c) => c.d > 0).length;
        const down = changes.filter((c) => c.d < 0).length;
        const list = changes.map((c) => `${statName(c.id)} ${c.d > 0 ? '▲' : '▼'}${Math.abs(c.d)}`).join(' · ');
        return (
          <span data-tip={list || t('attr.none')} class="review-attrs">
            {up > 0 && <Delta value={up} />} {down > 0 && <Delta value={-down} />}
            {up === 0 && down === 0 && <span class="u-faint">{t('attr.none')}</span>}
          </span>
        );
      },
    },
    { id: 'potential', header: t('col.potential'), class: 'col-mid', sortValue: (r) => r.potential ?? 0, cell: (r) => (r.potential !== null ? <Stars potential={r.potential} /> : '—') },
    {
      id: 'trend',
      header: t('col.trend'),
      cell: (r) => content.development.trend.levels.find((l) => l.id === r.trend)?.label ?? r.trend ?? '—',
    },
    { id: 'xp', header: t('col.xp'), align: 'num', sortValue: (r) => r.row?.xp ?? 0, cellAttrs: () => ({ 'data-tip': t('xp.tip') }), cell: (r) => r.row?.xp ?? '—' },
    { id: 'usage', header: t('col.usage'), align: 'num', class: 'col-mid', sortValue: (r) => r.row?.usageBp ?? 0, cell: (r) => (r.row ? fmtPctBp(r.row.usageBp) : '—') },
  ];
  return (
    <Panel title={t('dev.title')} icon="trend" subtitle={t('dev.subtitle')} body="flush" testId="review-development">
      <DataTable label={t('dev.title')} columns={columns} rows={rows} rowKey={(r) => r.fighter.id} variant={['compact']} defaultSort={{ column: 'change', dir: 'desc' }} empty={<Empty compact icon="squad" title={t('dev.empty')} />} />
    </Panel>
  );
}

function ContractsStep({ game, content, record, report, clubId }: { game: GameState; content: ContentDB; record: SeasonRecord; report: SeasonEndReport | null; clubId: ClubId }) {
  const retired = record.retirements.filter((r) => r.lastClubId === clubId);
  const expiredIds = report?.playerClub?.expiredIds ?? Object.values(game.fighters).filter((f) => f.freeAgency?.formerClubId === clubId && f.status === 'free-agent').map((f) => f.id);
  return (
    <div class="l-grid">
      <Panel title={t('retired.title')} icon="user-minus" class="span-6" testId="review-retired">
        {retired.length === 0 ? (
          <p class="u-sm u-muted">{t('retired.none')}</p>
        ) : (
          <ul class="review-list" role="list">
            {retired.map((r) => {
              const f = game.fighters[r.fighterId];
              return (
                <li key={r.fighterId}>
                  <span class="entity">
                    <Portrait content={content} fighter={f ?? null} size="sm" />
                    <span class="entity__stack">
                      <FighterLink state={game} id={r.fighterId} />
                      <span class="entity__sub">
                        {t('retired.line', { age: r.age, seasons: r.proSeasons, peak: r.peakRating })} · {t(`retired.cause.${r.cause}`)}
                      </span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <Panel title={t('expired.title')} icon="contract" class="span-6" testId="review-expired" actions={expiredIds.length > 0 ? <a class="btn btn--sm btn--ghost" href={href('market')}>{t('expired.market')}</a> : undefined}>
        {expiredIds.length === 0 ? (
          <p class="u-sm u-muted">{t('expired.none')}</p>
        ) : (
          <ul class="review-list" role="list">
            {expiredIds.map((id) => {
              const f = game.fighters[id];
              return (
                <li key={id}>
                  <span class="entity">
                    <Portrait content={content} fighter={f ?? null} size="sm" />
                    <span class="entity__stack">
                      <FighterLink state={game} id={id} />
                      <span class="entity__sub">{t('expired.line')}</span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function NextStep({ game, content, career }: { game: GameState; content: ContentDB; career: Career }) {
  const club = career.club;
  const tier = content.tiers.get(club.tierId);
  const wing = club.wingId ? content.leagues.wings.list.find((w) => w.id === club.wingId) : undefined;
  const roster = rosterOf(game, club.id).length;
  const cap = tier?.rosterCap ?? 0;
  const over = roster - cap;
  const rookies = game.market.trialsRookies[club.id]?.length ?? 0;
  return (
    <Panel title={t('next.title', { season: game.calendar.season })} icon="calendar-check" testId="review-next-season">
      <div class="tile-row review-next" style={{ '--tiles': 4 }}>
        <div class="stat-tile">
          <span class="stat-tile__label">{t('next.tier')}</span>
          <span class="stat-tile__value">{tier?.name ?? club.tierId}</span>
          <span class="stat-tile__sub">{wing ? `${t('next.wing')}: ${wing.name}` : ''}</span>
        </div>
        <div class="stat-tile">
          <span class="stat-tile__label">{t('next.roster')}</span>
          <span class={over > 0 ? 'stat-tile__value u-bad' : 'stat-tile__value'}>{t('next.rosterOf', { roster, cap })}</span>
          {over > 0 && <span class="stat-tile__sub u-bad">{t('next.overCap', { n: over })}</span>}
        </div>
        <div class="stat-tile">
          <span class="stat-tile__label">{t('next.budget')}</span>
          <span class="stat-tile__value">{fmtMoney(club.finance.seasonBudget, content)}</span>
          <span class="stat-tile__sub">
            {t('next.wb')}: {fmtMoney(club.finance.wageBudgetPerWeek, content)}
          </span>
        </div>
        <div class="stat-tile">
          <span class="stat-tile__label">{t('next.rookies')}</span>
          <span class="stat-tile__value">{rookies}</span>
          <span class="stat-tile__sub">{t('next.rookiesValue', { n: rookies })}</span>
        </div>
      </div>
    </Panel>
  );
}
