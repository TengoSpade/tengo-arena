/**
 * Box score (04 ui-report §4): both sides, ours first and theirs dimmed;
 * downs, downed, damage, taken, healed, control seconds, rules fired, XP;
 * sortable; every number has a breakdown tooltip. A round tab switches to a
 * round recap (downs that round, when each fighter fell, HP left).
 */
import type { ContentDB } from '../../../core/content';
import type { FighterId, GameState, MatchReport, MatchResult } from '../../../core/model';
import { clubName } from '../league/lib/club';
import { fmtInt, fmtSeconds1, fmtTicks } from '../league/lib/format';
import { sortBy, SortTh, useSort } from '../league/lib/sort';
import { overflowTipAttrs } from '../../components';
import { href } from '../league/lib/store';
import { ClassTag, Delta, Portrait } from '../league/lib/ui';
import { abilityName, name, totals, type FighterInfo, type Perspective } from './analysis';
import { t } from './text';

type Key = 'name' | 'downs' | 'downed' | 'damage' | 'taken' | 'healed' | 'control' | 'rules' | 'xp' | 'fell' | 'hp';

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
      <a class="entity__name" href={href(`fighter/${encodeURIComponent(info.id)}`)} {...overflowTipAttrs(f?.name.full)}>
        {f?.name.full ?? info.id}
      </a>
      {report.mvpFighterId === info.id && <span class="tag tag--accent">{t('mvp')}</span>}
      {info.isCaptain && (
        <span class="captain-mark" data-tip="Captain">
          <span class="u-sr-only">Captain</span>
        </span>
      )}
      {(injured || injury) && (
        <span class="tag tag--bad" data-tip={injury ? `${injury.severity} · out ${injury.weeksOut} wk` : 'Injured'}>
          <span class="icon" data-icon="injury" aria-hidden="true" />
          <span class="u-sr-only">Injured</span>
        </span>
      )}
      {info.hiredBlade && <span class="tag tag--outline">{t('hired')}</span>}
    </span>
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
  const tickMs = content.combat.tick.tickMs;
  const groups = [persp.usSide, persp.usSide === 'home' ? 'away' : 'home'] as const;
  const roundResult = round !== null ? result?.rounds.find((r) => r.round === round) : undefined;

  const downsInRound = (id: FighterId) =>
    infos.reduce((n, f) => n + (f.recap?.stats.downs.filter((d) => d.round === round && d.byFighterId === id).length ?? 0), 0);
  const fellAt = (info: FighterInfo) => info.recap?.stats.downs.find((d) => d.round === round) ?? null;
  const hpLeft = (info: FighterInfo) => roundResult?.finalHp[info.unit] ?? null;

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
  const tot = totals(infos);
  const cols = round === null ? 11 : 6;

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
              <th class="col-wide" scope="col">
                {t('col.class')}
              </th>
              <th class="col-mid" scope="col">
                {t('col.row')}
              </th>
              <SortTh label={t('col.downs')} sortKey="downs" sort={effectiveSort} onSort={toggle} num tip={t('tip.downs')} />
              {round === null ? (
                <>
                  <SortTh label={t('col.downed')} sortKey="downed" sort={effectiveSort} onSort={toggle} num tip={t('tip.downed')} />
                  <SortTh label={t('col.damage')} sortKey="damage" sort={effectiveSort} onSort={toggle} num />
                  <SortTh label={t('col.taken')} sortKey="taken" sort={effectiveSort} onSort={toggle} num />
                  <SortTh label={t('col.healed')} sortKey="healed" sort={effectiveSort} onSort={toggle} num />
                  <SortTh label={t('col.control')} sortKey="control" sort={effectiveSort} onSort={toggle} num tip={t('tip.control')} class="col-mid" />
                  <SortTh label={t('col.rules')} sortKey="rules" sort={effectiveSort} onSort={toggle} num tip={t('tip.rules')} class="col-wide" />
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
                infos.filter((f) => f.side === side),
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
                            class={s.ccAppliedTicks > 0 ? 'cell-num col-mid' : 'cell-num col-mid cell-muted'}
                            data-tip={t('tipcell.control', { applied: fmtSeconds1(s.ccAppliedTicks, tickMs), received: fmtSeconds1(s.ccReceivedTicks, tickMs) })}
                          >
                            {fmtSeconds1(s.ccAppliedTicks, tickMs)}
                          </td>
                          <td
                            class="cell-num col-wide"
                            data-tip={t('tipcell.rules', {
                              list: s.ruleFires.map((n, i) => (i === s.ruleFires.length - 1 ? `Stance ${n}` : `R${i + 1} ${n}`)).join(' · '),
                            })}
                          >
                            {s.ruleFires.reduce((a, b) => a + b, 0)}
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
                        <td colSpan={8} class="cell-muted">
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
                      <td class="col-wide">{f.classId && <ClassTag content={content} classId={f.classId} />}</td>
                      <td class="col-mid">
                        <span class="row-mark" data-row={f.row}>
                          {f.row === 'front' ? t('row.front') : t('row.back')}
                        </span>
                      </td>
                      {rowCells}
                    </tr>
                  );
                }),
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
        </footer>
      )}
    </section>
  );
}
