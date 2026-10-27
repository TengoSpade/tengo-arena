/**
 * Box score (04 ui-report §4): both sides, ours first and theirs dimmed;
 * downs, downed, damage, taken, healed, control seconds, rules fired, Freshness
 * (before → after, ours), XP; sortable; every number has a breakdown tooltip.
 * Everyone who started a round has a row: a reserve who came in carries a "sub"
 * mark with the round, so the side totals add up. Our bench (and reserves who
 * never entered) follows with the bench XP (⅓ of a lineup slot). A round tab
 * switches to a round recap (downs that round, when each fighter fell, HP left).
 */
import type { ContentDB } from '../../../core/content';
import type { FighterId, GameState, MatchReport, MatchResult, SwapReason } from '../../../core/model';
import { clubName } from '../league/lib/club';
import { fmtInt, fmtSeconds1, fmtTicks } from '../league/lib/format';
import { sortBy, SortTh, useSort } from '../league/lib/sort';
import { ClassTag, Delta, FighterLink, Portrait } from '../league/lib/ui';
import { FreshChange } from '../../m11/parts';
import { abilityName, benchXpOf, freshAfter, name, startedRound, totals, type FighterInfo, type Perspective } from './analysis';
import { weeksOutText } from '../../format/fighter';
import { t } from './text';

type Key = 'name' | 'downs' | 'downed' | 'damage' | 'taken' | 'healed' | 'control' | 'rules' | 'fresh' | 'xp' | 'fell' | 'hp';

function FighterCell({
  state,
  content,
  report,
  info,
}: {
  state: GameState;
  content: ContentDB;
  report: MatchReport;
  info: FighterInfo;
}) {
  const f = state.fighters[info.id];
  const injured = f?.injury?.fixtureId === report.fixtureId;
  const injury = report.aftermath.injuries.find((i) => i.fighterId === info.id);
  return (
    <span class="entity">
      <Portrait content={content} fighter={f ?? null} size="xs" injured={injured} />
      <FighterLink state={state} id={info.id} />
      {report.mvpFighterId === info.id && <span class="tag tag--accent">{t('mvp')}</span>}
      {info.isCaptain && (
        <span class="captain-mark" data-tip="Captain">
          <span class="u-sr-only">Captain</span>
        </span>
      )}
      {(injured || injury) && (
        <span class="tag tag--bad" data-tip={injury ? `${injury.severity} · out ${weeksOutText(injury)}` : 'Injured'}>
          <span class="icon" data-icon="injury" aria-hidden="true" />
          <span class="u-sr-only">Injured</span>
        </span>
      )}
      {info.hiredBlade && <span class="tag tag--outline">{t('hired')}</span>}
      {info.role !== 'starter' && <SubMark state={state} info={info} />}
    </span>
  );
}

const ENTRY_HOW: Record<SwapReason, string> = { player: 'your swap', auto: 'auto-swap', injury: 'forced by an injury', emergency: 'emergency entrant' };

/** "sub R2": came in from the reserves for round 2 (who he replaced and how, in the tooltip); "sub" when the round is not recorded. */
export function SubMark({ state, info }: { state: GameState; info: FighterInfo }) {
  const out = info.entry?.out;
  const how = ENTRY_HOW[info.entry?.reason ?? (info.role === 'emergency' ? 'emergency' : 'auto')];
  return (
    <span
      class="tag tag--info report-sub"
      data-testid="sub-mark"
      data-tip={
        info.enteredRound !== null
          ? t('tip.sub', { round: info.enteredRound, out: out ? name(state, out) : t('tip.subNobody'), how })
          : t(info.role === 'emergency' ? 'tip.subEmergency' : 'tip.subNoRound')
      }
    >
      {info.enteredRound !== null ? t('sub', { round: info.enteredRound }) : t('sub.noRound')}
    </span>
  );
}

/**
 * Older matches between other clubs are compacted (core keeps only each fighter's rounds, downs, damage
 * and healing): a short box score of what survives, the reserves who came on included.
 */
function SummaryBoxScore({ state, content, report, infos, persp }: { state: GameState; content: ContentDB; report: MatchReport; infos: FighterInfo[]; persp: Perspective }) {
  const groups = [persp.usSide, persp.usSide === 'home' ? 'away' : 'home'] as const;
  const tot = totals(infos, report);
  return (
    <section class="panel" aria-labelledby="h-box" data-testid="panel-box">
      <header class="panel__header">
        <h2 class="panel__title" id="h-box">
          <span class="icon" data-icon="finances" aria-hidden="true" />
          {t('box.title')}
        </h2>
        <span class="panel__subtitle">{t('box.subtitleSummary')}</span>
      </header>
      <div class="table-wrap">
        <table class="data-table data-table--compact data-table--dense" data-testid="box-table">
          <thead>
            <tr>
              <th scope="col">{t('col.fighter')}</th>
              <th class="report-col-1900" scope="col">
                {t('col.class')}
              </th>
              <th class="cell-num" scope="col">
                {t('col.rounds')}
              </th>
              <th class="cell-num" scope="col">
                {t('col.downs')}
              </th>
              <th class="cell-num" scope="col">
                {t('col.downed')}
              </th>
              <th class="cell-num" scope="col">
                {t('col.damage')}
              </th>
              <th class="cell-num" scope="col">
                {t('col.healed')}
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((side) => {
              const rows = infos.filter((f) => f.side === side).sort((a, b) => (b.recap?.stats.damageDealt ?? 0) - (a.recap?.stats.damageDealt ?? 0));
              return [
                <tr class="row-group" key={`g-${side}`}>
                  <th colSpan={7} scope="colgroup">
                    {clubName(state, report[side].clubId)}
                    {persp.involved && side === persp.usSide ? ' · you' : ''}
                  </th>
                </tr>,
                ...rows.map((f) => {
                  const s = f.recap?.stats;
                  const classId = f.classId || state.fighters[f.id]?.classId || '';
                  return (
                    <tr key={f.id}>
                      <td class="cell-fill">
                        <FighterCell state={state} content={content} report={report} info={f} />
                      </td>
                      <td class="report-col-1900">{classId && <ClassTag content={content} classId={classId} />}</td>
                      <td class="cell-num">{s?.roundsPlayed ?? '—'}</td>
                      <td class="cell-num">{s?.downsInflicted ?? '—'}</td>
                      <td class="cell-num">{s?.downsSuffered ?? '—'}</td>
                      <td class="cell-num">{s ? fmtInt(s.damageDealt) : '—'}</td>
                      <td class="cell-num">{s ? fmtInt(s.healingDone) : '—'}</td>
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </div>
      <footer class="panel__footer">
        <span>
          {t('totals', {
            us: persp.involved ? 'us' : clubName(state, report[persp.usSide].clubId),
            usDowns: tot[persp.usSide].downs,
            usDamage: fmtInt(tot[persp.usSide].damage),
            usHeal: fmtInt(tot[persp.usSide].healing),
            them: persp.involved ? 'them' : clubName(state, report[persp.usSide === 'home' ? 'away' : 'home'].clubId),
            themDowns: tot[persp.usSide === 'home' ? 'away' : 'home'].downs,
            themDamage: fmtInt(tot[persp.usSide === 'home' ? 'away' : 'home'].damage),
            themHeal: fmtInt(tot[persp.usSide === 'home' ? 'away' : 'home'].healing),
          })}
        </span>
      </footer>
    </section>
  );
}

export function BoxScore({
  state,
  content,
  report,
  result,
  infos,
  persp,
  round,
  focusId,
  onFocus,
}: {
  state: GameState;
  content: ContentDB;
  report: MatchReport;
  result: MatchResult | null;
  infos: FighterInfo[];
  persp: Perspective;
  round: number | null;
  focusId: FighterId | null;
  onFocus: (id: FighterId | null) => void;
}) {
  const { sort, toggle } = useSort<Key>({ key: 'damage', dir: 'desc' });
  if (report.compacted) return <SummaryBoxScore state={state} content={content} report={report} infos={infos} persp={persp} />;
  const tickMs = content.combat.tick.tickMs;
  const groups = [persp.usSide, persp.usSide === 'home' ? 'away' : 'home'] as const;
  const roundResult = round !== null ? result?.rounds.find((r) => r.round === round) : undefined;

  const downsInRound = (id: FighterId) =>
    infos.reduce((n, f) => n + (f.recap?.stats.downs.filter((d) => d.round === round && d.byFighterId === id).length ?? 0), 0);
  const fellAt = (info: FighterInfo) => info.recap?.stats.downs.find((d) => d.round === round) ?? null;
  const hpLeft = (info: FighterInfo) => (round !== null ? roundResult?.finalHp[info.units.get(round) ?? -1] : undefined) ?? null;

  const keyOf = (f: FighterInfo): number | string => {
    const s = f.recap?.stats;
    switch (sort.key) {
      case 'name':
        return name(state, f.id);
      case 'downs':
        return round !== null ? downsInRound(f.id) : (s?.downsInflicted ?? 0);
      case 'downed':
        return s?.downsSuffered ?? 0;
      case 'damage':
        return s?.damageDealt ?? 0;
      case 'taken':
        return s?.damageTaken ?? 0;
      case 'healed':
        return (s?.healingDone ?? 0) + (s?.shieldingDone ?? 0);
      case 'control':
        return s?.ccAppliedTicks ?? 0;
      case 'rules':
        return s?.ruleFires.reduce((a, b) => a + b, 0) ?? 0;
      case 'fresh':
        return freshAfter(state, report, f.id) ?? f.freshBefore ?? 0;
      case 'xp':
        return report.aftermath.xp[f.id] ?? 0;
      case 'fell':
        return fellAt(f)?.tick ?? 1e9;
      case 'hp':
        return hpLeft(f) ?? 0;
    }
  };
  const effectiveSort = round !== null && !['name', 'downs', 'fell', 'hp'].includes(sort.key) ? { key: 'hp' as Key, dir: 'desc' as const } : sort;
  const sortKeyFn = (f: FighterInfo) => {
    if (effectiveSort.key !== sort.key) return hpLeft(f) ?? 0;
    return keyOf(f);
  };
  const tot = totals(infos, report);
  const cols = round === null ? 12 : 6;
  // Our bench: fighters who started no round (and the unused match reserves) with the XP they earned.
  const bench = round === null ? benchXpOf(report, persp, state) : [];
  const showFresh = (f: FighterInfo) => f.freshBefore !== null && (f.us || !persp.involved);
  // The report's own XP totals (the sum over everyone who played); else summed over the rows shown.
  const xpTotal = report.totals?.[persp.usSide]?.xp ?? infos.filter((f) => f.us && report.aftermath.xp[f.id] !== undefined).reduce((n, f) => n + (report.aftermath.xp[f.id] ?? 0), 0);
  const benchTotal = bench.reduce((n, b) => n + b.xp, 0);

  return (
    <section class="panel" aria-labelledby="h-box" data-testid="panel-box">
      <header class="panel__header">
        <h2 class="panel__title" id="h-box">
          <span class="icon" data-icon="finances" aria-hidden="true" />
          {t('box.title')}
        </h2>
        <span class="panel__subtitle">{round === null ? t('box.subtitleMatch') : t('box.subtitleRound', { n: round })}</span>
      </header>
      <div class="table-wrap">
        <table class="data-table data-table--compact data-table--dense" data-testid="box-table">
          <thead>
            <tr>
              <SortTh label={t('col.fighter')} sortKey="name" sort={effectiveSort} onSort={toggle} firstDir="asc" />
              <th class="report-col-1900" scope="col">
                {t('col.class')}
              </th>
              <th class="report-col-1440" scope="col">
                {t('col.row')}
              </th>
              <SortTh label={t('col.downs')} sortKey="downs" sort={effectiveSort} onSort={toggle} num tip={t('tip.downs')} />
              {round === null ? (
                <>
                  <SortTh label={t('col.downed')} sortKey="downed" sort={effectiveSort} onSort={toggle} num tip={t('tip.downed')} />
                  <SortTh label={t('col.damage')} sortKey="damage" sort={effectiveSort} onSort={toggle} num />
                  <SortTh label={t('col.taken')} sortKey="taken" sort={effectiveSort} onSort={toggle} num />
                  <SortTh label={t('col.healed')} sortKey="healed" sort={effectiveSort} onSort={toggle} num />
                  <SortTh label={t('col.control')} sortKey="control" sort={effectiveSort} onSort={toggle} num tip={t('tip.control')} class="report-col-2000" />
                  <SortTh label={t('col.rules')} sortKey="rules" sort={effectiveSort} onSort={toggle} num tip={t('tip.rules')} class="report-col-2100" />
                  <SortTh label={t('col.fresh')} sortKey="fresh" sort={effectiveSort} onSort={toggle} num tip={t('tip.fresh')} />
                  <SortTh label={t('col.xp')} sortKey="xp" sort={effectiveSort} onSort={toggle} num tip={t('tip.xp')} />
                </>
              ) : (
                <>
                  <SortTh label={t('col.fell')} sortKey="fell" sort={effectiveSort} onSort={toggle} num firstDir="asc" />
                  <SortTh label={t('col.hp')} sortKey="hp" sort={effectiveSort} onSort={toggle} num tip={t('tip.hp')} />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {groups.map((side) => {
              const clubId = report[side].clubId;
              const rows = sortBy(
                infos.filter((f) => f.side === side && (round === null || startedRound(f, round))),
                sortKeyFn,
                effectiveSort.dir,
              );
              const ours = side === persp.usSide;
              return [
                <tr class="row-group" key={`g-${side}`}>
                  <th colSpan={cols} scope="colgroup">
                    {clubName(state, clubId)}
                    {persp.involved && ours ? ' · you' : ''}
                  </th>
                </tr>,
                ...rows.map((f) => {
                  const s = f.recap?.stats;
                  const cls = [ours || !persp.involved ? '' : 'is-dimmed', focusId === f.id ? 'is-focus' : ''].filter(Boolean).join(' ') || undefined;
                  const fname = name(state, f.id);
                  const rowCells =
                    round === null ? (
                      s ? (
                        <>
                          <td
                            class={s.downsInflicted > 0 ? 'cell-num cell-strong' : 'cell-num'}
                            data-tip={
                              s.downsInflicted > 0
                                ? t('tipcell.downs', {
                                    list: infos
                                      .flatMap((v) => (v.recap?.stats.downs ?? []).filter((d) => d.byFighterId === f.id).map((d) => `${name(state, v.id)} (R${d.round} ${fmtTicks(d.tick, tickMs)})`))
                                      .join(', '),
                                  })
                                : undefined
                            }
                          >
                            {s.downsInflicted}
                          </td>
                          <td
                            class={s.downsSuffered >= s.roundsPlayed && s.roundsPlayed > 0 ? 'cell-num u-bad' : 'cell-num'}
                            data-tip={
                              s.downs.length
                                ? t('tipcell.downed', {
                                    list: s.downs
                                      .map((d) => `R${d.round} ${fmtTicks(d.tick, tickMs)}${d.byFighterId ? ` by ${name(state, d.byFighterId)}` : ''}${d.abilityId ? ` (${abilityName(content, d.abilityId)})` : ''}`)
                                      .join(' · '),
                                  })
                                : undefined
                            }
                          >
                            {s.downsSuffered}
                          </td>
                          <td
                            class="cell-num"
                            data-tip={t('tipcell.damage', {
                              name: fname,
                              total: fmtInt(s.damageDealt),
                              shields: fmtInt(s.damageToShields),
                              casts:
                                Object.entries(s.casts)
                                  .map(([id, n]) => `${abilityName(content, id)} ×${n}`)
                                  .join(', ') || '—',
                            })}
                          >
                            {fmtInt(s.damageDealt)}
                          </td>
                          <td class="cell-num" data-tip={t('tipcell.taken', { name: fname, taken: fmtInt(s.damageTaken) })}>
                            {fmtInt(s.damageTaken)}
                          </td>
                          <td
                            class={s.healingDone + s.shieldingDone > 0 ? 'cell-num' : 'cell-num cell-muted'}
                            data-tip={t('tipcell.healed', {
                              name: fname,
                              healing: fmtInt(s.healingDone),
                              shielding: fmtInt(s.shieldingDone),
                              overheal: fmtInt(s.overheal),
                            })}
                          >
                            {fmtInt(s.healingDone + s.shieldingDone)}
                          </td>
                          <td
                            class={s.ccAppliedTicks > 0 ? 'cell-num report-col-2000' : 'cell-num report-col-2000 cell-muted'}
                            data-tip={t('tipcell.control', { applied: fmtSeconds1(s.ccAppliedTicks, tickMs), received: fmtSeconds1(s.ccReceivedTicks, tickMs) })}
                          >
                            {fmtSeconds1(s.ccAppliedTicks, tickMs)}
                          </td>
                          <td
                            class="cell-num report-col-2100"
                            data-tip={t('tipcell.rules', {
                              list: s.ruleFires.map((n, i) => (i === s.ruleFires.length - 1 ? `Stance ${n}` : `R${i + 1} ${n}`)).join(' · '),
                            })}
                          >
                            {s.ruleFires.reduce((a, b) => a + b, 0)}
                          </td>
                          <td class="cell-num" data-testid="cell-fresh">
                            {showFresh(f) ? <FreshChange before={f.freshBefore!} after={freshAfter(state, report, f.id)} content={content} /> : <span class="cell-muted">—</span>}
                          </td>
                          <td class="cell-num">
                            {ours || !persp.involved ? (
                              report.aftermath.xp[f.id] !== undefined ? (
                                <Delta value={report.aftermath.xp[f.id]!} />
                              ) : (
                                <span class="cell-muted">—</span>
                              )
                            ) : (
                              <span class="cell-muted">—</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <td colSpan={9} class="cell-muted">
                          {t('cell.notPlayed')}
                        </td>
                      )
                    ) : (
                      <>
                        <td class={downsInRound(f.id) > 0 ? 'cell-num cell-strong' : 'cell-num'}>{downsInRound(f.id)}</td>
                        <td class="cell-num">
                          {fellAt(f) ? (
                            <span class="u-bad" data-tip={fellAt(f)!.byFighterId ? `by ${name(state, fellAt(f)!.byFighterId)}` : undefined}>
                              {fmtTicks(fellAt(f)!.tick, tickMs)}
                            </span>
                          ) : (
                            <span class="cell-muted">{t('cell.standing')}</span>
                          )}
                        </td>
                        <td class="cell-num">{hpLeft(f) !== null ? fmtInt(hpLeft(f)!) : '—'}</td>
                      </>
                    );
                  return (
                    <tr key={f.id} class={cls} aria-selected={focusId === f.id ? 'true' : undefined} onClick={() => onFocus(focusId === f.id ? null : f.id)}>
                      <td class="cell-fill">
                        <FighterCell state={state} content={content} report={report} info={f} />
                      </td>
                      <td class="report-col-1900">{f.classId && <ClassTag content={content} classId={f.classId} />}</td>
                      <td class="report-col-1440">
                        <span class="row-mark" data-row={f.row}>
                          {f.row === 'front' ? t('row.front') : t('row.back')}
                        </span>
                      </td>
                      {rowCells}
                    </tr>
                  );
                }),
                ...(ours && bench.length > 0
                  ? [
                      <tr class="row-group" key="g-bench">
                        <th colSpan={cols} scope="colgroup" data-tip={t('tip.bench')}>
                          {t('bench.title')}
                        </th>
                      </tr>,
                      ...bench.map((b) => {
                        const f = state.fighters[b.id];
                        const klass = f ? content.classes.get(f.classId) : undefined;
                        return (
                          <tr key={`b-${b.id}`} class="is-bench" data-testid="bench-row">
                            <td class="cell-fill">
                              <span class="entity">
                                <Portrait content={content} fighter={f ?? null} size="xs" />
                                <FighterLink state={state} id={b.id} />
                              </span>
                            </td>
                            <td class="report-col-1900">{f && klass && <ClassTag content={content} classId={f.classId} />}</td>
                            <td class="report-col-1440" />
                            <td colSpan={8} class="cell-muted">
                              <span class="tag tag--info report-bench" data-tip={t('tip.bench')}>
                                {t('bench.tag')}
                              </span>
                              {b.reserve ? t('cell.reserveUnused') : t('cell.notPlayed')}
                            </td>
                            <td class="cell-num" data-testid="bench-xp">
                              <Delta value={b.xp} tip={t('tip.bench')} />
                            </td>
                          </tr>
                        );
                      }),
                    ]
                  : []),
              ];
            })}
          </tbody>
        </table>
      </div>
      {round === null && (
        <footer class="panel__footer">
          <span>
            {t('totals', {
              us: persp.involved ? 'us' : clubName(state, report[persp.usSide].clubId),
              usDowns: tot[persp.usSide].downs,
              usDamage: fmtInt(tot[persp.usSide].damage),
              usHeal: fmtInt(tot[persp.usSide].healing),
              them: persp.involved ? 'them' : clubName(state, report[persp.usSide === 'home' ? 'away' : 'home'].clubId),
              themDowns: tot[persp.usSide === 'home' ? 'away' : 'home'].downs,
              themDamage: fmtInt(tot[persp.usSide === 'home' ? 'away' : 'home'].damage),
              themHeal: fmtInt(tot[persp.usSide === 'home' ? 'away' : 'home'].healing),
            })}
          </span>
          {persp.involved && xpTotal + benchTotal > 0 && (
            <span class="l-push" data-testid="xp-total">
              {bench.length > 0 ? t('xpTotal.bench', { starters: xpTotal, bench: benchTotal, total: xpTotal + benchTotal }) : t('xpTotal', { starters: xpTotal })}
            </span>
          )}
        </footer>
      )}
    </section>
  );
}
