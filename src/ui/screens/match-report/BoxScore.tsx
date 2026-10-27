/**
 * Box score (04 ui-report §4; AL-R002-T001): both sides, ours first and theirs dimmed. The columns are grouped
 * Offense (downs, damage done), Defense (downed, damage received) and Support (healing done, healing received,
 * shielding), then control seconds, rules fired, Freshness (before → after, ours) and XP; every column sorts and
 * every number has a breakdown tooltip. Each side ends with a team total row that is the sum of the rows above it.
 * Everyone who started a round has a row: a reserve who came in carries a "sub" mark with the round, so the side
 * totals add up. Our bench (and reserves who never entered) follows with the bench XP (⅓ of a lineup slot).
 * The toggle in the header (and the page's round tabs) switches from the whole match to one round: the same
 * counters for that round, how each fighter fell and the HP he had left, and Freshness across that round.
 * The less-needed columns wait for room (the panel's width): Row, Shielding, Class, Control, Rules, in that order.
 */
import type { RefObject } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ContentDB } from '../../../core/content';
import type { FighterId, GameState, MatchReport, MatchResult, SwapReason } from '../../../core/model';
import { clubName } from '../league/lib/club';
import { fmtInt, fmtSeconds1, fmtTicks } from '../league/lib/format';
import { sortBy, SortTh, useSort } from '../league/lib/sort';
import { ClassTag, Delta, FighterLink, Portrait, Segmented } from '../league/lib/ui';
import { FreshChange } from '../../m11/parts';
import { abilityName, benchXpOf, boxLine, freshAfter, name, startedRound, sumBoxLines, totals, type BoxLine, type FighterInfo, type Perspective } from './analysis';
import { weeksOutText } from '../../format/fighter';
import { t } from './text';

type Key = 'name' | 'downs' | 'downed' | 'damage' | 'taken' | 'healing' | 'received' | 'shield' | 'control' | 'rules' | 'fresh' | 'xp' | 'fell' | 'hp';
/** The columns a single round has (control, rules, XP and Downed are the match's). */
const ROUND_KEYS: Key[] = ['name', 'downs', 'damage', 'taken', 'healing', 'received', 'shield', 'fresh', 'fell', 'hp'];

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

/**
 * The box score's own width in rem (0 until it is measured, and where nothing can be measured: every column shows).
 * The lower-value columns are not drawn when the panel is too narrow for them, rather than hidden, so the group
 * headers and the spanning cells always count the columns shown. The panel, not the window, decides: the report is
 * two columns on a wide screen and one on a narrow one.
 */
function usePanelRem(): [RefObject<HTMLElement>, number] {
  const ref = useRef<HTMLElement>(null) as RefObject<HTMLElement>;
  const [rem, setRem] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const px = el.getBoundingClientRect().width;
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setRem(px > 0 ? px / root : 0);
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, rem];
}

/** Panel width (rem) from which each lower-value column is drawn (measured: the stat columns need 56 rem, each of these adds its own). */
const SHOW_ROW = 64;
const SHOW_SHIELD = 68;
const SHOW_CLASS = 80;
const SHOW_CONTROL = 88;
const SHOW_RULES = 94;

/** A count cell that stays quiet at zero (nothing done is not an event) and says "—" where core could not count it. */
function N({ col, v, tip, strong, bad, muted, extra }: { col?: string; v: number | null; tip?: string; strong?: boolean; bad?: boolean; muted?: boolean; extra?: string }) {
  const quiet = v === null || (muted && v === 0);
  const cls = ['cell-num', extra, strong ? 'cell-strong' : '', bad ? 'u-bad' : '', quiet ? 'cell-muted' : ''].filter(Boolean).join(' ');
  return (
    <td class={cls} data-tip={tip} data-col={col}>
      {v === null ? '—' : fmtInt(v)}
    </td>
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
  onRound,
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
  /** The per-round toggle in the panel header (the report's round tabs drive the same state). */
  onRound?: (round: number | null) => void;
  focusId: FighterId | null;
  onFocus: (id: FighterId | null) => void;
}) {
  const { sort, toggle } = useSort<Key>({ key: 'damage', dir: 'desc' });
  // Lower-value columns wait for room (the panel's width, see usePanelRem): Row, Shielding, Class, Control, Rules, in that order.
  const [panelRef, panelRem] = usePanelRem();
  const fits = (rem: number) => panelRem === 0 || panelRem >= rem;
  const showRow = fits(SHOW_ROW);
  const showShield = fits(SHOW_SHIELD);
  const showClass = fits(SHOW_CLASS);
  const showControl = fits(SHOW_CONTROL);
  const showRules = fits(SHOW_RULES);
  if (report.compacted) return <SummaryBoxScore state={state} content={content} report={report} infos={infos} persp={persp} />;
  const tickMs = content.combat.tick.tickMs;
  const groups = [persp.usSide, persp.usSide === 'home' ? 'away' : 'home'] as const;
  const roundResult = round !== null ? result?.rounds.find((r) => r.round === round) : undefined;
  const perRound = round !== null;

  const downsInRound = (id: FighterId) =>
    infos.reduce((n, f) => n + (f.recap?.stats.downs.filter((d) => d.round === round && d.byFighterId === id).length ?? 0), 0);
  const fellAt = (info: FighterInfo) => info.recap?.stats.downs.find((d) => d.round === round) ?? null;
  const hpLeft = (info: FighterInfo) => (round !== null ? roundResult?.finalHp[info.units.get(round) ?? -1] : undefined) ?? null;
  const lineOf = (f: FighterInfo) => boxLine(state, report, f, round);
  const downsOf = (f: FighterInfo) => (perRound ? (lineOf(f)?.downs ?? downsInRound(f.id)) : (lineOf(f)?.downs ?? 0));

  // Keys with no meaning for one round (control, rules, XP, Downed) fall back to damage done.
  const effectiveSort = perRound && !ROUND_KEYS.includes(sort.key) ? { key: 'damage' as Key, dir: 'desc' as const } : sort;
  const keyOf = (f: FighterInfo): number | string => {
    const l = lineOf(f);
    const s = f.recap?.stats;
    switch (effectiveSort.key) {
      case 'name':
        return name(state, f.id);
      case 'downs':
        return downsOf(f);
      case 'downed':
        return l?.downed ?? 0;
      case 'damage':
        return l?.damageDone ?? 0;
      case 'taken':
        return l?.damageReceived ?? 0;
      case 'healing':
        return l?.healingDone ?? 0;
      case 'received':
        return l?.healingReceived ?? -1;
      case 'shield':
        return l?.shieldingDone ?? 0;
      case 'control':
        return s?.ccAppliedTicks ?? 0;
      case 'rules':
        return s?.ruleFires.reduce((a, b) => a + b, 0) ?? 0;
      case 'fresh':
        return l?.freshAfter ?? l?.freshBefore ?? 0;
      case 'xp':
        return report.aftermath.xp[f.id] ?? 0;
      case 'fell':
        return fellAt(f)?.tick ?? 1e9;
      case 'hp':
        return hpLeft(f) ?? 0;
    }
  };
  // Whole match: every column is the match's; one round: the fighters who started it.
  // Columns shown: fighter, class and row when there is room, the stat columns, Freshness (and XP for the match).
  const nShield = showShield ? 1 : 0;
  const nStats = perRound ? 7 + nShield : 6 + nShield + (showControl ? 1 : 0) + (showRules ? 1 : 0);
  const cols = 1 + (showClass ? 1 : 0) + (showRow ? 1 : 0) + nStats + 1 + (perRound ? 0 : 1);
  // Bench rows: the note spans the stat columns and Freshness; XP stands alone.
  const benchSpan = nStats + 1;
  // Our bench: fighters who started no round (and the unused match reserves) with the XP they earned.
  const bench = round === null ? benchXpOf(report, persp, state) : [];
  // The report's own XP totals (the sum over everyone who played); else summed over the rows shown.
  const xpTotal = report.totals?.[persp.usSide]?.xp ?? infos.filter((f) => f.us && report.aftermath.xp[f.id] !== undefined).reduce((n, f) => n + (report.aftermath.xp[f.id] ?? 0), 0);
  const benchTotal = bench.reduce((n, b) => n + b.xp, 0);
  const th = (label: string, key: Key, o: { tip?: string; firstDir?: 'asc' | 'desc'; class?: string; rowSpan?: number } = {}) => (
    <SortTh label={label} sortKey={key} sort={effectiveSort} onSort={toggle} num firstDir={o.firstDir} tip={o.tip} class={o.class} rowSpan={o.rowSpan} />
  );
  const roundTabs: { value: string; label: string; tip?: string }[] = [
    { value: 'all', label: t('box.toggleMatch'), tip: t('box.toggleMatchTip') },
    ...report.rounds.map((r) => ({ value: String(r.round), label: t('box.toggleRound', { n: r.round }), tip: t('box.toggleRoundTip', { n: r.round }) })),
  ];

  return (
    <section class="panel report-box" aria-labelledby="h-box" data-testid="panel-box" ref={panelRef}>
      <header class="panel__header">
        <h2 class="panel__title" id="h-box">
          <span class="icon" data-icon="finances" aria-hidden="true" />
          {t('box.title')}
        </h2>
        <span class="panel__subtitle">{round === null ? t('box.subtitleMatch') : t('box.subtitleRound', { n: round })}</span>
        {onRound && report.rounds.length > 0 && (
          <div class="panel__actions" data-testid="box-toggle">
            <Segmented<string> label={t('box.toggleLabel')} value={round === null ? 'all' : String(round)} options={roundTabs} onChange={(v) => onRound(v === 'all' ? null : Number(v))} />
          </div>
        )}
      </header>
      <div class="table-wrap">
        <table class="data-table data-table--compact data-table--dense" data-testid="box-table">
          <thead>
            <tr class="box-groups">
              <SortTh label={t('col.fighter')} sortKey="name" sort={effectiveSort} onSort={toggle} firstDir="asc" rowSpan={2} />
              {showClass && (
                <th scope="col" rowSpan={2}>
                  {t('col.class')}
                </th>
              )}
              {showRow && (
                <th scope="col" rowSpan={2}>
                  {t('col.row')}
                </th>
              )}
              <th class="box-group" scope="colgroup" colSpan={2} data-tip={t('group.offenseTip')}>
                {t('group.offense')}
              </th>
              <th class="box-group" scope="colgroup" colSpan={perRound ? 3 : 2} data-tip={t('group.defenseTip')}>
                {t('group.defense')}
              </th>
              <th class="box-group" scope="colgroup" colSpan={2 + nShield} data-tip={t('group.supportTip')}>
                {t('group.support')}
              </th>
              {!perRound && showControl && th(t('col.control'), 'control', { tip: t('tip.control'), rowSpan: 2 })}
              {!perRound && showRules && th(t('col.rules'), 'rules', { tip: t('tip.rules'), rowSpan: 2 })}
              {th(t('col.fresh'), 'fresh', { tip: perRound ? t('tip.freshRound') : t('tip.fresh'), rowSpan: 2 })}
              {!perRound && th(t('col.xp'), 'xp', { tip: t('tip.xp'), rowSpan: 2 })}
            </tr>
            <tr class="box-subhead">
              {th(t('col.downs'), 'downs', { tip: t('tip.downs') })}
              {th(t('col.damageDone'), 'damage', { tip: t('tip.damageDone') })}
              {perRound ? th(t('col.fell'), 'fell', { firstDir: 'asc', tip: t('tip.fell') }) : th(t('col.downed'), 'downed', { tip: t('tip.downed') })}
              {th(t('col.damageReceived'), 'taken', { tip: t('tip.damageReceived') })}
              {perRound && th(t('col.hp'), 'hp', { tip: t('tip.hp') })}
              {th(t('col.healingDone'), 'healing', { tip: t('tip.healingDone') })}
              {th(t('col.healingReceived'), 'received', { tip: t('tip.healingReceived') })}
              {showShield && th(t('col.shielding'), 'shield', { tip: t('tip.shielding') })}
            </tr>
          </thead>
          <tbody>
            {groups.map((side) => {
              const clubId = report[side].clubId;
              const rows = sortBy(
                infos.filter((f) => f.side === side && (round === null || startedRound(f, round))),
                keyOf,
                effectiveSort.dir,
              );
              const ours = side === persp.usSide;
              const lines = rows.map(lineOf).filter((l): l is BoxLine => l !== null);
              const sums = sumBoxLines(lines);
              return [
                <tr class="row-group" key={`g-${side}`}>
                  <th colSpan={cols} scope="colgroup">
                    {clubName(state, clubId)}
                    {persp.involved && ours ? ' · you' : ''}
                  </th>
                </tr>,
                ...rows.map((f) => {
                  const s = f.recap?.stats;
                  const l = lineOf(f);
                  const cls = [ours || !persp.involved ? '' : 'is-dimmed', focusId === f.id ? 'is-focus' : ''].filter(Boolean).join(' ') || undefined;
                  const fname = name(state, f.id);
                  const fell = fellAt(f);
                  const downsList = infos
                    .flatMap((v) => (v.recap?.stats.downs ?? []).filter((d) => d.byFighterId === f.id).map((d) => `${name(state, v.id)} (R${d.round} ${fmtTicks(d.tick, tickMs)})`))
                    .join(', ');
                  // Cells that read the line (the match's, or the round's).
                  const missing = !l;
                  const offense = missing ? (
                    <>
                      <N col="downs" v={s ? downsOf(f) : null} strong={downsOf(f) > 0} />
                      <td class="cell-num cell-muted" data-tip={t(s ? 'cell.noRoundLine' : 'cell.notPlayed')}>
                        —
                      </td>
                    </>
                  ) : (
                    <>
                      <N col="downs" v={downsOf(f)} strong={downsOf(f) > 0} tip={!perRound && downsOf(f) > 0 ? t('tipcell.downs', { list: downsList }) : undefined} />
                      <N
                        col="damageDone"
                        v={l.damageDone}
                        tip={
                          s && !perRound
                            ? t('tipcell.damage', {
                                name: fname,
                                total: fmtInt(l.damageDone),
                                shields: fmtInt(s.damageToShields),
                                casts:
                                  Object.entries(s.casts)
                                    .map(([id, n]) => `${abilityName(content, id)} ×${n}`)
                                    .join(', ') || '—',
                              })
                            : t('tipcell.damageRound', { name: fname, total: fmtInt(l.damageDone) })
                        }
                      />
                    </>
                  );
                  const defense = perRound ? (
                    <>
                      <td class="cell-num">
                        {fell ? (
                          <span class="u-bad" data-tip={fell.byFighterId ? `by ${name(state, fell.byFighterId)}` : undefined}>
                            {fmtTicks(fell.tick, tickMs)}
                          </span>
                        ) : (
                          <span class="cell-muted">{t('cell.standing')}</span>
                        )}
                      </td>
                      {l ? <N col="damageReceived" v={l.damageReceived} tip={t('tipcell.taken', { name: fname, taken: fmtInt(l.damageReceived) })} /> : <td class="cell-num cell-muted">—</td>}
                      <td class="cell-num">{hpLeft(f) !== null ? fmtInt(hpLeft(f)!) : '—'}</td>
                    </>
                  ) : l ? (
                    <>
                      <N
                        col="downed"
                        v={l.downed}
                        bad={!!s && s.roundsPlayed > 0 && l.downed >= s.roundsPlayed}
                        tip={
                          s && s.downs.length
                            ? t('tipcell.downed', {
                                list: s.downs
                                  .map((d) => `R${d.round} ${fmtTicks(d.tick, tickMs)}${d.byFighterId ? ` by ${name(state, d.byFighterId)}` : ''}${d.abilityId ? ` (${abilityName(content, d.abilityId)})` : ''}`)
                                  .join(' · '),
                              })
                            : undefined
                        }
                      />
                      <N col="damageReceived" v={l.damageReceived} tip={t('tipcell.taken', { name: fname, taken: fmtInt(l.damageReceived) })} />
                    </>
                  ) : (
                    <td colSpan={2} class="cell-muted" />
                  );
                  const support = l ? (
                    <>
                      <N
                        col="healingDone"
                        v={l.healingDone}
                        muted
                        tip={t('tipcell.healed', { name: fname, healing: fmtInt(l.healingDone), shielding: fmtInt(l.shieldingDone), overheal: fmtInt(s?.overheal ?? 0) })}
                      />
                      <N col="healingReceived" v={l.healingReceived} muted tip={l.healingReceived === null ? t('tip.healingReceivedUnknown') : t('tipcell.healingReceived', { name: fname, received: fmtInt(l.healingReceived) })} />
                      {showShield && <N col="shielding" v={l.shieldingDone} muted tip={t('tipcell.shielding', { name: fname, shielding: fmtInt(l.shieldingDone) })} />}
                    </>
                  ) : (
                    <td colSpan={2 + nShield} class="cell-muted" />
                  );
                  const freshBefore = l?.freshBefore ?? (perRound ? null : f.freshBefore);
                  const freshCell = (
                    <td class="cell-num" data-testid="cell-fresh">
                      {freshBefore !== null && (f.us || !persp.involved) ? (
                        <FreshChange before={freshBefore} after={l ? l.freshAfter : perRound ? null : freshAfter(state, report, f.id)} content={content} />
                      ) : (
                        <span class="cell-muted">—</span>
                      )}
                    </td>
                  );
                  return (
                    <tr key={f.id} class={cls} aria-selected={focusId === f.id ? 'true' : undefined} onClick={() => onFocus(focusId === f.id ? null : f.id)}>
                      <td class="cell-fill">
                        <FighterCell state={state} content={content} report={report} info={f} />
                      </td>
                      {showClass && <td>{f.classId && <ClassTag content={content} classId={f.classId} />}</td>}
                      {showRow && (
                        <td>
                          <span class="row-mark" data-row={f.row}>
                            {f.row === 'front' ? t('row.front') : t('row.back')}
                          </span>
                        </td>
                      )}
                      {offense}
                      {defense}
                      {support}
                      {!perRound && showControl && (
                        <td
                          class={s && s.ccAppliedTicks > 0 ? 'cell-num' : 'cell-num cell-muted'}
                          data-tip={s ? t('tipcell.control', { applied: fmtSeconds1(s.ccAppliedTicks, tickMs), received: fmtSeconds1(s.ccReceivedTicks, tickMs) }) : undefined}
                        >
                          {s ? fmtSeconds1(s.ccAppliedTicks, tickMs) : '—'}
                        </td>
                      )}
                      {!perRound && showRules && (
                        <td
                          class="cell-num"
                          data-tip={s ? t('tipcell.rules', { list: s.ruleFires.map((n, i) => (i === s.ruleFires.length - 1 ? `Stance ${n}` : `R${i + 1} ${n}`)).join(' · ') }) : undefined}
                        >
                          {s ? s.ruleFires.reduce((a, b) => a + b, 0) : '—'}
                        </td>
                      )}
                      {freshCell}
                      {!perRound && (
                        <td class="cell-num">
                          {(ours || !persp.involved) && report.aftermath.xp[f.id] !== undefined ? <Delta value={report.aftermath.xp[f.id]!} /> : <span class="cell-muted">—</span>}
                        </td>
                      )}
                    </tr>
                  );
                }),
                // Team total: the sum of the rows above, column by column.
                rows.length > 0 && lines.length > 0 ? (
                  <tr class={`row-total${ours || !persp.involved ? '' : ' is-dimmed'}`} key={`t-${side}`} data-testid={`box-total-${ours ? 'us' : 'them'}`}>
                    <th class="cell-fill" scope="row">
                      {t('total.label')}
                    </th>
                    {showClass && <td />}
                    {showRow && <td />}
                    <td class="cell-num" data-col="downs">{fmtInt(sums.downs)}</td>
                    <td class="cell-num" data-col="damageDone">{fmtInt(sums.damageDone)}</td>
                    {perRound ? <td class="cell-num" /> : <td class="cell-num" data-col="downed">{fmtInt(sums.downed)}</td>}
                    <td class="cell-num" data-col="damageReceived">{fmtInt(sums.damageReceived)}</td>
                    {perRound && <td class="cell-num" />}
                    <td class="cell-num" data-col="healingDone" data-tip={t('total.healingTip')}>{fmtInt(sums.healingDone)}</td>
                    <td class="cell-num" data-col="healingReceived">{sums.healingReceived === null ? '—' : fmtInt(sums.healingReceived)}</td>
                    {showShield && <td class="cell-num" data-col="shielding">{fmtInt(sums.shieldingDone)}</td>}
                    {!perRound && showControl && <td class="cell-num">{fmtSeconds1(rows.reduce((n, f) => n + (f.recap?.stats.ccAppliedTicks ?? 0), 0), tickMs)}</td>}
                    {!perRound && showRules && <td class="cell-num">{rows.reduce((n, f) => n + (f.recap?.stats.ruleFires.reduce((a, b) => a + b, 0) ?? 0), 0)}</td>}
                    <td class="cell-num" />
                    {!perRound && (
                      <td class="cell-num" data-col="xp">
                        {ours || !persp.involved ? <Delta value={rows.reduce((n, f) => n + (report.aftermath.xp[f.id] ?? 0), 0)} /> : <span class="cell-muted">—</span>}
                      </td>
                    )}
                  </tr>
                ) : null,
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
                            {showClass && <td>{f && klass && <ClassTag content={content} classId={f.classId} />}</td>}
                            {showRow && <td />}
                            <td colSpan={benchSpan} class="cell-muted">
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
      {perRound && !infos.some((f) => startedRound(f, round!) && lineOf(f) !== null) && (
        <p class="report-box__note u-xs u-faint" data-testid="box-no-round">
          {t('box.noRoundCounters')}
        </p>
      )}
      {round === null && persp.involved && xpTotal + benchTotal > 0 && (
        <footer class="panel__footer">
          <span class="l-push" data-testid="xp-total">
            {bench.length > 0 ? t('xpTotal.bench', { starters: xpTotal, bench: benchTotal, total: xpTotal + benchTotal }) : t('xpTotal', { starters: xpTotal })}
          </span>
        </footer>
      )}
    </section>
  );
}
