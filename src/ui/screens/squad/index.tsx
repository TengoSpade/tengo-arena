/**
 * ui-squad · Squad: lineup and roster (04 §6.3, mockup squad.html). Also the
 * lineup screen of 02 step 6 when opened by Continue (flow-state-004).
 * - Lineup board: Back row and Front row zones sized by their fighters
 *   (front faces the enemy), one card per starter with portrait, name, C /
 *   VC, class, race and age, a preset select, rating, injury risk, season XP
 *   bar and trend; a validation strip with chemistry, mean rating vs the
 *   opponent's last lineup and lineup wages.
 * - Roster table with the cap meter, filter chips, name filter and four
 *   views (Overview, Attributes, Contracts, Season stats).
 * Keys: F / B / R front, back, reserve; C / V captain, vice-captain; P cycle
 * preset; E cycle training emphasis; Enter profile; ↑ ↓ rows. Every change
 * applies at once with Undo (D-M); core validates every command.
 */
import { signal } from '@preact/signals';
import { useMemo, useState } from 'preact/hooks';
import type { ClassDef, ContentDB } from '../../../core/content';
import type { FighterView } from '../../../core/game';
import type { Club, Fighter, FighterId, GameState, LineupEntry, StatId } from '../../../core/model';
import type { ScreenProps } from '../../app/routes';
import { navigate } from '../../app/router';
import { levelUpRequest } from '../../app/intents';
import { useShortcuts } from '../../app/shortcuts';
import {
  CapMeter,
  ClassTag,
  DataTable,
  Empty,
  FighterName,
  Icon,
  Kbd,
  Panel,
  PageHeader,
  Portrait,
  Rating,
  RowMark,
  Segmented,
  Chip,
  Stars,
  Tag,
  TraitDots,
  CaptainMark,
  ViceCaptainTag,
  tipAttrs,
  type Column,
} from '../../components';
import { attributeBand, formatInt, formatMoney } from '../../format';
import { weekName } from '../../format/calendar';
import {
  weeksOutText,
  captaincyConsequences,
  contractEnds,
  fighterTraits,
  injuryRiskText,
  injuryTip,
  potentialTip,
  presetTip,
  presetsOf,
  raceName,
  ratingTip,
  roleNames,
  rolesOf,
  trainingOptions,
  wageTip,
} from '../../format/fighter';
import { useStore, type GameStore } from '../../store';
import { clubActions } from '../../store/actions';
import { safeView, useEngine, type GameEngine } from '../../store/engine';
import { fighterViewOf, lastPlayedLineup, usePlayerClub, type ClubContext } from '../../store/views';
import { format, t } from '../../text';
import { freshInfo, levelInfo } from '../../m11/model';
import { FreshMeter, LevelChip, freshTip } from '../../m11/parts';
import { ReservesZone, RotationStrip, rotationTips, toggleReserve } from './MatchSquad';
import { T } from './text';
import './squad.css';

type View = 'overview' | 'attributes' | 'contracts' | 'season';
type Filter = 'all' | 'lineup' | 'reserves' | 'injured' | 'contract';

/** Selection survives leaving and returning to the screen (04 §6.2 tables). */
export const squadSelection = signal<FighterId | null>(null);
const squadView = signal<View>('overview');

interface Row {
  f: Fighter;
  view: FighterView | null;
  klass: ClassDef;
  entry: LineupEntry | null;
  slot: number;
}

function buildRows(ctx: ClubContext, engine: GameEngine): Row[] {
  const { state, content, club, roster } = ctx;
  return roster.map((f) => {
    const slot = club.lineup.fighters.findIndex((e) => e.fighterId === f.id);
    return {
      f,
      view: fighterViewOf(engine, state, content, f.id),
      klass: content.classes.require(f.classId),
      entry: slot >= 0 ? club.lineup.fighters[slot]! : null,
      slot,
    };
  });
}

export default function SquadScreen(_props: ScreenProps) {
  const store = useStore();
  const engine = useEngine();
  const ctx = usePlayerClub();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [dragId, setDragId] = useState<FighterId | null>(null);

  const rows = useMemo(() => (ctx ? buildRows(ctx, engine) : []), [ctx?.state, engine]);
  const selected = squadSelection.value;

  const actions = ctx
    ? clubActions(store, ctx.state, ctx.content, ctx.club, {
        front: T.toastFront,
        back: T.toastBack,
        reserve: T.toastReserve,
        replace: T.toastReplace,
        captain: T.toastCaptain,
        vice: T.toastVice,
        captainSub: T.toastCaptainSub,
        preset: T.toastPreset,
        emphasis: T.toastEmphasis,
      }, (c, v) => captaincyConsequences(safeView(() => engine.captaincyPreview(ctx.state, ctx.club.id, c, v, ctx.content), null), ctx.state, ctx.content))
    : null;

  useShortcuts({
    f: () => (selected && actions ? void actions.moveTo(selected, 'front') : false),
    b: () => (selected && actions ? void actions.moveTo(selected, 'back') : false),
    r: () => (selected && actions ? void actions.moveTo(selected, 'reserve') : false),
    m: () => (selected && ctx ? void toggleReserve(store, ctx.state, ctx.club, selected) : false),
    c: () => (selected && actions ? void actions.setCaptain(selected) : false),
    v: () => (selected && actions ? void actions.setVice(selected) : false),
    p: () => (selected && actions ? void actions.cyclePreset(selected) : false),
    e: () => (selected && actions ? void actions.cycleEmphasis(selected) : false),
  });

  if (!ctx || !actions) {
    return (
      <section class="page" data-testid="screen-squad">
        <Empty icon="squad" title={T.noClub} />
      </section>
    );
  }

  const { state, content, club, tier } = ctx;
  const counts = {
    all: rows.length,
    lineup: rows.filter((r) => r.entry).length,
    reserves: rows.filter((r) => !r.entry).length,
    injured: rows.filter((r) => r.f.injury && r.f.injury.weeksOut > 0).length,
    contract: rows.filter((r) => contractEnds(r.f.contract, state.calendar.season).final).length,
  };
  const needle = query.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (filter === 'lineup' && !r.entry) return false;
    if (filter === 'reserves' && r.entry) return false;
    if (filter === 'injured' && !(r.f.injury && r.f.injury.weeksOut > 0)) return false;
    if (filter === 'contract' && !contractEnds(r.f.contract, state.calendar.season).final) return false;
    if (needle && !r.f.name.full.toLowerCase().includes(needle) && !r.klass.name.toLowerCase().includes(needle)) return false;
    return true;
  });

  const fixture = ctx.fixture;
  const opponentId = fixture ? (fixture.homeClubId === club.id ? fixture.awayClubId : fixture.homeClubId) : null;
  const opponent = opponentId ? state.clubs[opponentId] : null;
  const eyebrow =
    fixture && opponent
      ? format(T.eyebrowMatch, {
          week: weekName(content, state.calendar.weekIndex, tier),
          where: fixture.homeClubId === club.id ? t('continue.vs') : t('continue.at'),
          club: opponent.name,
          venue: fixture.homeClubId === club.id ? T.home : T.away,
        })
      : weekName(content, state.calendar.weekIndex, tier);

  const onDropRow = (target: 'front' | 'back' | 'reserve', swapWith?: FighterId) => {
    if (dragId) actions.moveTo(dragId, target, swapWith ?? null);
    setDragId(null);
  };

  return (
    <section class="page" data-testid="screen-squad">
      <PageHeader
        eyebrow={eyebrow}
        title={T.title}
        meta={[T.metaDraft, T.metaFree]}
        actions={
          <Segmented<View>
            label={T.viewLabel}
            value={squadView.value}
            onChange={(v) => (squadView.value = v)}
            options={[
              { id: 'overview', label: T.viewOverview },
              { id: 'attributes', label: T.viewAttributes },
              { id: 'contracts', label: T.viewContracts },
              { id: 'season', label: T.viewSeason },
            ]}
          />
        }
      />
      <div class="l-grid">
        <LineupBoard
          ctx={ctx}
          store={store}
          rows={rows}
          engine={engine}
          selected={selected}
          onSelect={(id) => (squadSelection.value = id)}
          actions={actions}
          dragId={dragId}
          setDragId={setDragId}
          onDropRow={onDropRow}
          opponent={opponent ?? null}
          onAuto={() => {
            const cmd = safeView(() => engine.suggestLineup(state, club.id, content), null);
            if (cmd && cmd.type === 'lineup.set') actions.setLineup(cmd.fighters, T.toastAuto);
          }}
          onLast={(entries) => actions.setLineup(entries, T.toastLast)}
        />
        <Panel
          span={12}
          title={T.roster}
          icon="fighter"
          testId="roster-panel"
          body="none"
          headerExtra={
            <>
              <span class="l-row u-sm" tabIndex={0} {...tipAttrs(format(T.rosterTip, { tier: tier.name, cap: ctx.rosterCap }))}>
                <CapMeter used={rows.length} cap={ctx.rosterCap} />
                <span class="u-num">
                  <strong>{rows.length}</strong>
                  <span class="u-muted"> / {ctx.rosterCap}</span>
                </span>
              </span>
              <div class="l-cluster squad-chips">
                <Chip pressed={filter === 'all'} onClick={() => setFilter('all')} count={counts.all}>
                  {T.filterAll}
                </Chip>
                <Chip pressed={filter === 'lineup'} onClick={() => setFilter('lineup')} count={counts.lineup}>
                  {T.filterLineup}
                </Chip>
                <Chip pressed={filter === 'reserves'} onClick={() => setFilter('reserves')} count={counts.reserves}>
                  {T.filterReserves}
                </Chip>
                <Chip pressed={filter === 'injured'} onClick={() => setFilter('injured')} count={counts.injured}>
                  {T.filterInjured}
                </Chip>
                <Chip pressed={filter === 'contract'} onClick={() => setFilter('contract')} count={counts.contract}>
                  {format(T.filterContract, { season: state.calendar.season })}
                </Chip>
              </div>
            </>
          }
          actions={
            <>
              <span class="input-icon">
                <Icon name="search" />
                <input
                  class="input input--sm squad-filter"
                  type="search"
                  placeholder={T.filterName}
                  aria-label={T.filterName}
                  value={query}
                  onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                />
              </span>
              <a class="btn btn--sm" href="#/market">
                <Icon name="user-plus" />
                {T.sign}
              </a>
            </>
          }
          footer={
            <>
              <span>{T.footerKeys}</span>
              <span class="l-push">
                {format(T.footerWages, {
                  bill: ctx.wageBill !== null ? formatInt(ctx.wageBill) : '—',
                  budget: ctx.finance ? formatMoney(ctx.finance.wageBudgetPerWeek) : '—',
                })}
              </span>
            </>
          }
        >
          <div
            onDragOver={(e) => {
              if (dragId) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDropRow('reserve');
            }}
          >
            <DataTable<Row>
              label={T.roster}
              testId="roster-table"
              variant={['dense']}
              columns={columnsFor(squadView.value, ctx, actions, engine)}
              rows={visible}
              rowKey={(r) => r.f.id}
              sortKey={`squad.${squadView.value}`}
              defaultSort={{ column: 'slot', dir: 'asc' }}
              selectedKey={selected}
              onSelect={(key) => (squadSelection.value = key as FighterId)}
              onOpen={(r) => navigate(`#/fighter/${r.f.id}`)}
              rowClass={(r) => (r.f.injury && r.f.injury.weeksOut > 0 ? 'is-dimmed' : undefined)}
              rowAttrs={(r) => ({
                draggable: true,
                'data-fighter': r.f.id,
                onDragStart: (e: DragEvent) => {
                  e.dataTransfer?.setData('text/plain', r.f.id);
                  setDragId(r.f.id);
                },
                onDragEnd: () => setDragId(null),
              })}
              empty={
                <Empty
                  compact
                  title={T.emptyFilter}
                  actions={
                    <button
                      class="btn btn--sm"
                      type="button"
                      onClick={() => {
                        setFilter('all');
                        setQuery('');
                      }}
                    >
                      {T.filterAll}
                    </button>
                  }
                />
              }
            />
          </div>
        </Panel>
      </div>
    </section>
  );
}

// ---- Lineup board ---------------------------------------------------------------------------------------------

interface BoardProps {
  ctx: ClubContext;
  store: GameStore;
  rows: Row[];
  engine: GameEngine;
  selected: FighterId | null;
  onSelect: (id: FighterId) => void;
  actions: ReturnType<typeof clubActions>;
  dragId: FighterId | null;
  setDragId: (id: FighterId | null) => void;
  onDropRow: (target: 'front' | 'back' | 'reserve', swapWith?: FighterId) => void;
  opponent: Club | null;
  onAuto: () => void;
  onLast: (entries: LineupEntry[]) => void;
}

function LineupBoard(props: BoardProps) {
  const { ctx, rows, selected, engine } = props;
  const { state, content, club } = ctx;
  const byId = new Map(rows.map((r) => [r.f.id, r]));
  const entries = club.lineup.fighters;
  const back = entries.filter((e) => e.row === 'back');
  const front = entries.filter((e) => e.row === 'front');
  const fitOnRoster = rows.filter((r) => engineFit(engine, r.f)).length;
  const lineupRows = entries.map((e) => byId.get(e.fighterId)).filter((r): r is Row => !!r);
  const ratings = lineupRows.map((r) => r.view?.rating ?? null).filter((v): v is number => v !== null);
  const mean = ratings.length ? ratings.reduce((s, v) => s + v, 0) / ratings.length : null;
  const opponentMean = props.opponent ? opponentLineupMean(state, props.opponent) : null;
  const wages = lineupRows.reduce((s, r) => s + (r.f.contract?.wagePerWeek ?? 0), 0);
  const chemistry = safeView<number | null>(
    () => engine.lineupChemistry(state, club.id, entries.map((e) => e.fighterId), club.captainId, content),
    null,
  );
  const last = lastLineup(state, club);

  const emptySlots = Math.max(0, 5 - entries.length);
  const hiredBlade = fitOnRoster < 5;
  const missingPresets = entries.filter((e) => !club.lineup.tactics[e.fighterId]).length;
  const injuredInLineup = lineupRows.filter((r) => !engineFit(engine, r.f));
  const injuredReserves = rows.filter((r) => !r.entry && r.f.injury && r.f.injury.weeksOut > 0);
  // One-click fix for an unfit starter: the best fit reserves, highest rating first, one per unfit place.
  const fitReserves = rows.filter((r) => !r.entry && engineFit(engine, r.f)).sort((a, b) => (b.view?.rating ?? 0) - (a.view?.rating ?? 0));
  const name = (id: FighterId | null) => (id ? (state.fighters[id]?.name.full ?? id) : '');

  const zone = (label: string, list: readonly LineupEntry[], row: 'front' | 'back', empties: number) => (
    <div
      class={`lineup__row${props.dragId ? ' is-drop-target' : ''}`}
      style={{ '--slots': Math.max(1, list.length + empties) }}
      aria-label={label}
      onDragOver={(e) => {
        if (props.dragId) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        props.onDropRow(row);
      }}
    >
      <div class="lineup__row-label">
        <span>{label}</span>
        <span class="u-faint" {...tipAttrs(format(T.rowCountTip, { n: list.length, row: label.toLowerCase() }))}>
          {list.length}
        </span>
      </div>
      <div class="lineup__slots">
        {list.map((e) => {
          const r = byId.get(e.fighterId);
          return r ? (
            <LineupCard key={e.fighterId} {...props} r={r} isSelected={selected === e.fighterId} />
          ) : null;
        })}
        {Array.from({ length: empties }, (_, i) => (
          <article key={`empty-${i}`} class="lineup-card lineup-card--empty" aria-label={hiredBlade ? T.hiredBlade : T.emptyPlace}>
            <strong>{hiredBlade ? T.hiredBlade : T.emptyPlace}</strong>
            <span>{hiredBlade ? T.hiredBladeHint : T.emptyPlaceHint}</span>
          </article>
        ))}
      </div>
    </div>
  );

  // Empty places go to the back row first (most lineups field 2 front / 3 back), then the front.
  const backEmpty = Math.min(emptySlots, Math.max(0, 3 - back.length));
  const frontEmpty = emptySlots - backEmpty;

  return (
    <Panel
      span={12}
      title={T.lineup}
      icon="squad"
      testId="lineup-board"
      subtitle={
        <>
          {T.lineupHint} <Kbd>F</Kbd> front, <Kbd>B</Kbd> back, <Kbd>R</Kbd> bench, <Kbd>M</Kbd> match reserve, <Kbd>C</Kbd> captain, <Kbd>V</Kbd> vice
        </>
      }
      actions={
        <>
          <button class="btn btn--sm btn--ghost" type="button" onClick={props.onAuto} {...tipAttrs(T.autoPickTip)}>
            <Icon name="refresh" />
            {T.autoPick}
          </button>
          <button
            class="btn btn--sm btn--ghost"
            type="button"
            aria-disabled={last ? undefined : 'true'}
            onClick={() => last && props.onLast(last)}
            {...tipAttrs(last ? T.lastLineupTip : T.lastLineupNone)}
          >
            <Icon name="undo" />
            {T.lastLineup}
          </button>
        </>
      }
      footerClass="lineup-check"
      footerLabel="Lineup check"
      footer={
        <>
          <ul class="checklist checklist--inline" role="list">
            <li data-state={entries.length < 5 ? 'warn' : injuredInLineup.length ? 'bad' : undefined}>
              {hiredBlade && entries.length < 5
                ? format(T.checkHiredBlade, { n: entries.length })
                : entries.length === 5 && injuredInLineup.length > 0
                  ? format(T.checkFilledUnfit, { n: injuredInLineup.length })
                  : entries.length === 5
                    ? format(T.checkFilled, { n: 5 })
                    : format(T.checkFilledPartial, { n: entries.length })}
            </li>
            <li data-state={club.captainId ? undefined : 'bad'}>
              {club.captainId
                ? club.viceCaptainId
                  ? format(T.checkCaptain, { captain: name(club.captainId), vice: name(club.viceCaptainId) })
                  : format(T.checkCaptainNoVice, { captain: name(club.captainId) })
                : T.checkNoCaptain}
            </li>
            <li data-state={missingPresets ? 'warn' : undefined}>{missingPresets ? format(T.checkPresetsMissing, { n: missingPresets }) : T.checkPresets}</li>
            {injuredInLineup.map((r, i) => {
              const sub = fitReserves[i];
              return (
                <li key={r.f.id} data-state="bad">
                  <span class="l-cluster l-cluster--xs">
                    {format(T.checkInjuredInLineup, { name: r.f.name.full })}
                    {sub && (
                      <button
                        class="btn btn--sm"
                        type="button"
                        data-testid={`bring-in-${sub.f.id}`}
                        onClick={() => props.actions.moveTo(sub.f.id, r.entry?.row ?? 'back', r.f.id)}
                        {...tipAttrs(format(T.bringInTip, { name: sub.f.name.full, rating: sub.view?.rating ?? '—', out: r.f.name.given, row: (r.entry?.row === 'front' ? T.frontRow : T.backRow).toLowerCase() }))}
                      >
                        {format(T.bringIn, { name: sub.f.name.given })}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
            {injuredReserves.slice(0, 2).map((r) => (
              <li key={r.f.id} data-state="warn">
                {format(T.checkInjured, { name: r.f.name.full, weeks: weeksOutText(r.f.injury!) })}
              </li>
            ))}
          </ul>
          {chemistry !== null && (
            <span class="l-push u-num" tabIndex={0} {...tipAttrs(T.chemistryTip)}>
              {T.chemistry} <strong>{chemistry > 0 ? `+${chemistry}` : chemistry < 0 ? `−${-chemistry}` : '0'}</strong>
            </span>
          )}
          {mean !== null && (
            <span
              class={chemistry === null ? 'l-push u-num' : 'u-num'}
              tabIndex={0}
              {...tipAttrs(
                format(T.meanRatingTip, {
                  list: lineupRows.map((r) => `${r.f.name.given} ${r.view?.rating ?? '—'}`).join(', '),
                  vs: opponentMean !== null && props.opponent ? format(T.meanRatingVs, { club: props.opponent.shortName, mean: opponentMean.toFixed(1) }) : '',
                }),
              )}
            >
              {T.meanRating} <strong>{mean.toFixed(1)}</strong>
              {opponentMean !== null && (
                <span class="u-faint">
                  {' '}
                  · {T.theirLastLineup} {opponentMean.toFixed(1)}
                </span>
              )}
            </span>
          )}
          <span class="u-num" tabIndex={0} {...tipAttrs(lineupRows.map((r) => `${r.f.name.full} ${formatMoney(r.f.contract?.wagePerWeek ?? 0)}`).join(' · '))}>
            {T.lineupWages} <strong>{formatMoney(wages)}</strong>
          </span>
        </>
      }
    >
      <div class="lineup">
        {zone(T.backRow, back, 'back', backEmpty)}
        {zone(T.frontRow, front, 'front', frontEmpty)}
        <div class="lineup__facing" aria-hidden="true">
          <Icon name="arrow-right" />
          {T.enemySide}
        </div>
      </div>
      <ReservesZone state={state} content={content} engine={engine} club={club} store={props.store} selected={selected} onSelect={props.onSelect} dragId={props.dragId} setDragId={props.setDragId} />
      <RotationStrip tips={rotationTips(state, content, engine, club)} state={state} onRotate={(tip) => props.actions.moveTo(tip.in, tip.row, tip.out)} />
    </Panel>
  );
}

function LineupCard(props: BoardProps & { r: Row; isSelected: boolean }) {
  const { r, ctx, actions, isSelected: selected } = props;
  const { state, content, club, tier } = ctx;
  const presets = presetsOf(r.klass, content);
  const assignment = club.lineup.tactics[r.f.id];
  const presetId = assignment?.kind === 'preset' ? assignment.presetId : r.klass.defaultPresetId;
  const preset = content.presets.get(presetId);
  const race = raceName(r.f, content);
  const captain = club.captainId === r.f.id ? 'captain' : club.viceCaptainId === r.f.id ? 'vice' : null;
  const risk = r.view ? injuryRiskText(r.view, content) : null;
  const injured = r.f.injury && r.f.injury.weeksOut > 0;
  const fresh = freshInfo(props.engine, state, content, r.f);
  const level = levelInfo(props.engine, state, content, r.f);
  const willTire = fresh.readyRounds < 3;
  return (
    <article
      class="lineup-card"
      data-role={rolesOf(r.klass)[0]}
      tabIndex={0}
      aria-selected={selected ? 'true' : 'false'}
      aria-label={`${r.f.name.full}, ${r.klass.name}, ${r.entry?.row === 'front' ? T.frontRow : T.backRow}${captain === 'captain' ? `, ${t('fighter.captain')}` : captain === 'vice' ? `, ${t('fighter.viceCaptain')}` : ''}`}
      draggable
      data-testid={`lineup-card-${r.f.id}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('select')) return;
        props.onSelect(r.f.id);
      }}
      onDblClick={() => navigate(`#/fighter/${r.f.id}`)}
      onFocus={(e) => {
        if (e.target === e.currentTarget) props.onSelect(r.f.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`#/fighter/${r.f.id}`);
      }}
      onDragStart={(e) => {
        e.dataTransfer?.setData('text/plain', r.f.id);
        props.setDragId(r.f.id);
      }}
      onDragEnd={() => props.setDragId(null)}
      onDragOver={(e) => {
        if (props.dragId && props.dragId !== r.f.id) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onDropRow(r.entry?.row ?? 'back', r.f.id);
      }}
    >
      <Portrait size="sm" role={rolesOf(r.klass)[0]} race={r.f.raceId} injured={!!injured} />
      <div class="lineup-card__head">
        <span class="lineup-card__name">
          <span {...tipAttrs(r.f.name.full)}>{r.f.name.full}</span>
          {captain === 'captain' && (
            <CaptainMark tip={r.view ? `${t('fighter.captain')} · captaincy ${r.view.captaincy.cq} of 100 (${r.view.captaincy.gradeId})` : t('fighter.captain')} />
          )}
          {captain === 'vice' && <ViceCaptainTag />}
        </span>
        <span class="lineup-card__class" {...tipAttrs(format(T.ageTip, { race, age: r.f.age, human: r.view?.humanAge ?? '—' }))}>
          {r.klass.name} · {race} {r.f.age}
        </span>
      </div>
      <div class="lineup-card__foot">
        <span class="select-wrap select-wrap--inline u-grow">
          <select
            class="select select--inline"
            aria-label={format(T.presetFor, { name: r.f.name.full })}
            value={presetId}
            onChange={(e) => actions.setPreset(r.f.id, (e.target as HTMLSelectElement).value)}
            {...tipAttrs(preset ? presetTip(preset, r.klass, content) : null)}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </span>
        {r.view ? <Rating value={r.view.rating} tip={ratingTip(r.view, r.klass, content, tier)} /> : <span class="u-faint">—</span>}
      </div>
      <div class="lineup-card__foot lineup-card__meta">
        {risk && (
          // Normal risk is the quiet default: icon only (the word stays for screen readers and the tooltip).
          <span {...tipAttrs(risk.tip)} class={risk.atRisk ? 'lineup-card__risk u-warn' : 'lineup-card__risk'}>
            <Icon name="injury" size="sm" /> <span class={risk.notable ? undefined : 'u-sr-only'}>{risk.word}</span>
          </span>
        )}
        <FreshMeter info={fresh} content={content} testId={`fresh-${r.f.id}`} />
        <span
          class={`lineup-card__proj u-xs${willTire ? ' u-warn' : ' u-muted'}`}
          {...tipAttrs(format(T.freshProjectionTip, { drain: fresh.drain.toFixed(1), n: fresh.afterMatch, tired: willTire ? T.freshWillTire : T.freshFine }))}
        >
          {format(T.freshProjection, { n: fresh.afterMatch })}
        </span>
        <button class="lineup-card__lvl" type="button" onClick={(e) => {
          e.stopPropagation();
          if (level.pending > 0) levelUpRequest.value = r.f.id;
        }} {...tipAttrs(format(T.levelTip, { n: level.level }))}>
          <LevelChip info={level} />
        </button>
      </div>
      {(fresh.label === 'tired' || fresh.label === 'spent') && (
        <div class="lineup-card__warn">
          <Tag kind={fresh.label === 'spent' ? 'bad' : 'warn'} icon="warning" tip={freshTip(fresh, content)}>
            {format(T.tiredTag, { label: fresh.labelText, n: fresh.value })}
          </Tag>
        </div>
      )}
    </article>
  );
}

function engineFit(engine: GameEngine, f: Fighter): boolean {
  return safeView(() => engine.isFit(f), !(f.injury && f.injury.weeksOut > 0));
}

/** Mean rating of the opponent's last played lineup this season (D-R); null before their first match. */
function opponentLineupMean(state: GameState, opponent: Club): number | null {
  const played = lastPlayedLineup(state, opponent.id);
  return played && played.length ? played.reduce((s, x) => s + x.rating, 0) / played.length : null;
}

/** The five, rows of the club's last match (from the stored sim input). */
function lastLineup(state: GameState, club: Club): LineupEntry[] | null {
  const last = Object.values(state.results)
    .filter((r) => r.homeClubId === club.id || r.awayClubId === club.id)
    .sort((a, b) => b.weekIndex - a.weekIndex)[0];
  if (!last) return null;
  const side = last.homeClubId === club.id ? last.input.home : last.input.away;
  const entries = side.fighters.filter((f) => state.fighters[f.fighterId]?.clubId === club.id).map((f) => ({ fighterId: f.fighterId, row: f.row }));
  return entries.length > 0 ? entries : null;
}

// ---- Roster table columns --------------------------------------------------------------------------------

function columnsFor(view: View, ctx: ClubContext, actions: ReturnType<typeof clubActions>, engine: GameEngine): Column<Row>[] {
  const { state, content, club, tier } = ctx;
  const season = state.calendar.season;
  const fighter: Column<Row> = {
    id: 'fighter',
    header: T.colFighter,
    fill: true,
    sortValue: (r) => r.f.name.full,
    cell: (r) => (
      <FighterName
        name={r.f.name.full}
        href={`#/fighter/${r.f.id}`}
        role={rolesOf(r.klass)[0]}
        race={r.f.raceId}
        injured={!!(r.f.injury && r.f.injury.weeksOut > 0)}
        captain={club.captainId === r.f.id ? 'captain' : club.viceCaptainId === r.f.id ? 'vice' : null}
        rookie={r.f.debutSeason === season}
      />
    ),
  };
  const slot: Column<Row> = { id: 'slot', header: '#', headerLabel: 'Lineup order', class: 'cell-tight u-faint', sortValue: (r) => (r.slot < 0 ? 99 : r.slot), cell: (r) => (r.slot >= 0 ? <span {...tipAttrs(format(T.slotTip, { n: r.slot + 1 }))}>{r.slot + 1}</span> : '') };
  const klass: Column<Row> = {
    id: 'class',
    header: T.colClass,
    sortValue: (r) => r.klass.name,
    cell: (r) => <ClassTag name={r.klass.name} roles={rolesOf(r.klass)} roleNames={roleNames(r.klass, content)} />,
  };
  const raceAge: Column<Row> = {
    id: 'race',
    header: T.colRaceAge,
    sortValue: (r) => r.f.age,
    cell: (r) => (
      <span {...tipAttrs(format(T.ageTip, { race: raceName(r.f, content), age: r.f.age, human: r.view?.humanAge ?? '—' }))}>
        {raceName(r.f, content)} · {r.f.age}
      </span>
    ),
  };
  const rating: Column<Row> = {
    id: 'rating',
    header: T.colRating,
    align: 'num',
    sortValue: (r) => r.view?.rating ?? 0,
    cell: (r) => (r.view ? <Rating value={r.view.rating} tip={ratingTip(r.view, r.klass, content, tier)} /> : '—'),
  };
  const potential: Column<Row> = {
    id: 'potential',
    header: T.colPotential,
    sortValue: (r) => r.view?.potential ?? 0,
    firstDir: 'desc',
    cell: (r) => (r.view ? <Stars potential={r.view.potential} tip={potentialTip(r.view.potential)} /> : '—'),
  };
  const lineup: Column<Row> = {
    id: 'lineup',
    header: T.colLineup,
    sortValue: (r) => (r.f.injury && r.f.injury.weeksOut > 0 ? 9 : r.entry ? (r.entry.row === 'front' ? 1 : 2) : 4),
    cell: (r) =>
      r.f.injury && r.f.injury.weeksOut > 0 ? (
        <Tag kind="bad" icon="injury" tip={injuryTip(r.f.injury, content)}>
          {weeksOutText(r.f.injury)}
        </Tag>
      ) : (
        <RowMark row={r.entry ? r.entry.row : 'bench'} />
      ),
  };
  const preset: Column<Row> = {
    id: 'preset',
    header: T.colPreset,
    class: 'col-mid',
    sortValue: (r) => presetName(r, club, content),
    cell: (r) => {
      const a = club.lineup.tactics[r.f.id];
      const p = content.presets.get(a?.kind === 'preset' ? a.presetId : r.klass.defaultPresetId);
      return <span {...tipAttrs(p ? presetTip(p, r.klass, content) : null)}>{p?.name ?? '—'}</span>;
    },
  };
  const training: Column<Row> = {
    id: 'training',
    header: T.colTraining,
    class: 'squad-training',
    sortValue: (r) => r.f.trainingEmphasis,
    cell: (r) => (
      <span class="select-wrap select-wrap--inline">
        <select
          class="select select--inline"
          aria-label={format(T.emphasisFor, { name: r.f.name.full })}
          value={r.f.trainingEmphasis}
          onChange={(e) => actions.setEmphasis(r.f.id, (e.target as HTMLSelectElement).value as Fighter['trainingEmphasis'])}
          {...tipAttrs('Training emphasis: which attributes earned growth goes to (Body: physical, Mind: mental). Never how much. E cycles.')}
        >
          {trainingOptions(content).map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </span>
    ),
  };
  const level: Column<Row> = {
    id: 'level',
    header: T.colLevel,
    align: 'num',
    sortValue: (r) => r.f.level ?? 0,
    cell: (r) => {
      const info = levelInfo(engine, state, content, r.f);
      return (
        <button class="lineup-card__lvl" type="button" onClick={() => info.pending > 0 && (levelUpRequest.value = r.f.id)} data-testid={`lvl-${r.f.id}`}>
          <LevelChip info={info} />
        </button>
      );
    },
  };
  const freshness: Column<Row> = {
    id: 'freshness',
    header: T.colFresh,
    sortValue: (r) => r.f.freshness10 ?? 1000,
    cell: (r) => <FreshMeter info={freshInfo(engine, state, content, r.f)} content={content} />,
  };
  // Below 1400 px the traits give way to the names (they stay on the profile and Attributes view).
  const traits: Column<Row> = {
    id: 'traits',
    header: T.colTraits,
    class: 'col-mid',
    cell: (r) => <TraitDots traits={fighterTraits(r.f, content).map((ti) => ({ id: ti.id, polarity: ti.polarity, tip: ti.tip }))} />,
  };
  const apps: Column<Row> = { id: 'apps', header: T.colApps, align: 'num', class: 'col-wide', sortValue: (r) => r.f.season.matchesStarted, cell: (r) => <span {...tipAttrs(format(T.apps, { n: r.f.season.matchesStarted }))}>{r.f.season.matchesStarted}</span> };
  const downs: Column<Row> = { id: 'downs', header: T.colDowns, align: 'num', class: 'col-wide', sortValue: (r) => r.f.career.downsInflicted, cell: (r) => <span {...tipAttrs(`Career downs inflicted ${r.f.career.downsInflicted}`)}>{r.f.career.downsInflicted}</span> };
  const wage: Column<Row> = {
    id: 'wage',
    header: T.colWage,
    align: 'num',
    sortValue: (r) => r.f.contract?.wagePerWeek ?? 0,
    cell: (r) => <span {...tipAttrs(wageTip(r.f, r.view))}>{r.f.contract ? formatInt(r.f.contract.wagePerWeek) : '—'}</span>,
  };
  const contract: Column<Row> = {
    id: 'contract',
    header: T.colContract,
    sortValue: (r) => r.f.contract?.endSeason ?? 0,
    cell: (r) => {
      const c = contractEnds(r.f.contract, season);
      if (c.final)
        return (
          <Tag kind="warn" tip={T.contractFinalTip}>
            {format(T.contractFinal, { season: r.f.contract?.endSeason ?? season })}
          </Tag>
        );
      return (
        <span {...tipAttrs(`Contract ends after S${r.f.contract?.endSeason}.`)}>
          {c.text}
          <span class="u-faint col-mid"> · {format(T.contractMore, { n: c.seasonsLeft })}</span>
        </span>
      );
    },
  };

  if (view === 'attributes') {
    const stats = content.stats.list.map<Column<Row>>((s) => ({
      id: `stat-${s.id}`,
      header: s.abbr,
      headerLabel: s.name,
      headerTip: `${s.name}: ${s.description}`,
      align: 'num',
      sortValue: (r) => r.view?.stats[s.id as StatId] ?? 0,
      cell: (r) => {
        const v = r.view?.stats[s.id as StatId];
        return v === undefined ? '—' : (
          <span class="stat-num" data-band={attributeBand(v)} {...tipAttrs(`${s.name} ${v}`)}>
            {v}
          </span>
        );
      },
    }));
    return [slot, fighter, { ...klass, class: 'col-mid' }, rating, ...stats];
  }
  if (view === 'contracts') {
    const market: Column<Row> = {
      id: 'market',
      header: T.colMarket,
      align: 'num',
      sortValue: (r) => r.view?.marketWage ?? 0,
      cell: (r) => (r.view ? <span {...tipAttrs('Market wage: what clubs would pay for this fighter now, from rating, potential, age, traits and role demand.')}>{formatInt(r.view.marketWage)}</span> : '—'),
    };
    const left: Column<Row> = {
      id: 'left',
      header: T.colLeft,
      align: 'num',
      sortValue: (r) => contractEnds(r.f.contract, season).seasonsLeft,
      cell: (r) => <span {...tipAttrs('Seasons after this one')}>{contractEnds(r.f.contract, season).seasonsLeft}</span>,
    };
    return [slot, fighter, klass, rating, lineup, wage, market, contract, left];
  }
  if (view === 'season') {
    const num = (id: string, header: string, get: (r: Row) => number, tip: (r: Row) => string): Column<Row> => ({
      id,
      header,
      align: 'num',
      sortValue: get,
      cell: (r) => <span {...tipAttrs(tip(r))}>{formatInt(get(r))}</span>,
    });
    return [
      slot,
      fighter,
      klass,
      rating,
      lineup,
      num('apps', T.colApps, (r) => r.f.season.matchesStarted, (r) => `Matches started this season: ${r.f.season.matchesStarted}`),
      num('rounds', T.colRounds, (r) => r.f.season.roundsStarted, (r) => `Rounds started this season: ${r.f.season.roundsStarted}`),
      num('xp', T.colXp, (r) => r.f.season.xp, (r) => format(T.xpTip, { xp: r.f.season.xp, target: content.development.xp.seasonTarget })),
      num('injuries', T.colInjuries, (r) => r.f.season.injuries, (r) => `Injuries this season: ${r.f.season.injuries}`),
      num('career', T.colCareer, (r) => r.f.career.matches, (r) => `Career matches: ${r.f.career.matches}`),
      num('cdowns', T.colCareerDowns, (r) => r.f.career.downsInflicted, (r) => `Career downs inflicted: ${r.f.career.downsInflicted}`),
    ];
  }
  return [slot, fighter, klass, raceAge, rating, potential, level, freshness, lineup, preset, training, traits, apps, downs, wage, contract];
}

function presetName(r: Row, club: Club, content: ContentDB): string {
  const a = club.lineup.tactics[r.f.id];
  return content.presets.get(a?.kind === 'preset' ? a.presetId : r.klass.defaultPresetId)?.name ?? '';
}
