/**
 * ui-fighter · Fighter profile (04 §6.3, mockup fighter.html): everything
 * about one fighter so decisions about playing, keeping or selling him are
 * informed. Header (portrait, name, facts, traits, rating, potential,
 * actions), tabs Overview / Tactics / Match log / Contract.
 * Keys: [ ] previous / next fighter, T tactics tab, C / V captain, E cycle
 * training emphasis, Esc back to Squad.
 */
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import type { ClassDef, ContentDB, RaceDef } from '../../../core/content';
import type { FighterView } from '../../../core/game';
import type { Fighter, FighterId, GameState, StatId } from '../../../core/model';
import type { ScreenProps } from '../../app/routes';
import { navigate } from '../../app/router';
import { useShortcuts } from '../../app/shortcuts';
import {
  Callout,
  CaptainMark,
  ConfirmButton,
  Crest,
  DataTable,
  Empty,
  Icon,
  Panel,
  Portrait,
  Progress,
  Rating,
  RoleBadge,
  RowMark,
  RuleLine,
  Segmented,
  Stars,
  StatBar,
  TabPanel,
  Tabs,
  Tag,
  TraitBadge,
  ViceCaptainTag,
  tipAttrs,
  type Column,
} from '../../components';
import { formatInt, formatMoney, formatPercentBp } from '../../format';
import { weekCode } from '../../format/calendar';
import {
  captaincyGradeLabel,
  contractEnds,
  fighterTraits,
  injuryLabel,
  injuryTip,
  potentialTip,
  presetTip,
  presetsOf,
  raceName,
  ratingTip,
  roleNames,
  rolesOf,
  statusLabel,
  trainingOptions,
  trendInfo,
} from '../../format/fighter';
import { ruleParts, stanceDescription, stanceName } from '../../format/rules';
import { useStore } from '../../store';
import { clubActions } from '../../store/actions';
import { safeView, useEngine } from '../../store/engine';
import { fighterViewOf, usePlayerClub, type ClubContext } from '../../store/views';
import { format } from '../../text';
import { T } from './text';
import './fighter.css';

type Tab = 'overview' | 'tactics' | 'log' | 'contract';
const fighterTab = signal<Tab>('overview');

export default function FighterScreen({ params }: ScreenProps) {
  const store = useStore();
  const engine = useEngine();
  const ctx = usePlayerClub();
  const state = store.game.value;
  const content = store.content.value;
  const id = (params['id'] ?? '') as FighterId;
  const f = state?.fighters[id];
  const own = !!ctx && !!f && f.clubId === ctx.club.id && f.status === 'active';
  const order = ctx ? ctx.roster.map((x) => x.id) : [];
  const idx = order.indexOf(id);
  const prev = idx >= 0 ? order[(idx - 1 + order.length) % order.length] : undefined;
  const next = idx >= 0 ? order[(idx + 1) % order.length] : undefined;
  const actions =
    ctx && state && content && own
      ? clubActions(store, state, content, ctx.club, {
          front: '{name} to the front row',
          back: '{name} to the back row',
          reserve: '{name} to the reserves',
          replace: '{name} replaces {other}',
          captain: '{name} is captain',
          vice: '{name} is vice-captain',
          captainSub: 'Captaincy costs are evaluated at the next lineup lock, so changing back before then is free.',
          preset: '{name}: preset {preset}',
          emphasis: '{name}: training {emphasis}',
        })
      : null;

  useShortcuts({
    '[': () => (prev && prev !== id ? navigate(`#/fighter/${prev}`) : false),
    ']': () => (next && next !== id ? navigate(`#/fighter/${next}`) : false),
    t: () => {
      fighterTab.value = 'tactics';
    },
    c: () => (actions && f ? void actions.setCaptain(f.id) : false),
    v: () => (actions && f ? void actions.setVice(f.id) : false),
    e: () => (actions && f ? void actions.cycleEmphasis(f.id) : false),
    Escape: () => navigate('#/squad'),
  });

  if (!state || !content || !f) {
    return (
      <section class="page" data-testid="screen-fighter">
        <Empty icon="fighter" title={T.notFound} text={T.notFoundText} actions={<a class="btn" href="#/squad">{T.squad}</a>} />
      </section>
    );
  }

  const view = fighterViewOf(engine, state, content, f.id);
  const klass = content.classes.require(f.classId);
  const race = content.races.require(f.raceId);
  const club = f.clubId ? state.clubs[f.clubId] : undefined;
  const tier = club ? content.tiers.get(club.tierId) : undefined;
  const tab = fighterTab.value;

  return (
    <section class="page" data-testid="screen-fighter">
      <div class="l-row fighter-crumbs">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          <a href="#/squad">{T.squad}</a> <Icon name="chevron-right" size="sm" /> <span>{f.name.full}</span>
        </nav>
        {own && order.length > 1 && prev && next && (
          <div class="l-push l-cluster l-cluster--xs">
            <a class="btn btn--sm btn--ghost" href={`#/fighter/${prev}`} {...tipAttrs(T.prevTip)}>
              <Icon name="chevron-left" />
              {state.fighters[prev]?.name.full}
            </a>
            <a class="btn btn--sm btn--ghost" href={`#/fighter/${next}`} {...tipAttrs(T.nextTip)}>
              {state.fighters[next]?.name.full}
              <Icon name="chevron-right" />
            </a>
          </div>
        )}
      </div>

      <ProfileHeader f={f} view={view} klass={klass} race={race} state={state} content={content} ctx={ctx} own={own} actions={actions} tierName={tier}>
        <Tabs<Tab>
          idPrefix="fighter"
          label={T.tabs}
          inset
          class="fighter-tabs"
          selected={tab}
          onSelect={(x) => (fighterTab.value = x)}
          tabs={[
            { id: 'overview', label: T.tabOverview },
            { id: 'tactics', label: T.tabTactics, kbd: 'T' },
            { id: 'log', label: T.tabLog },
            { id: 'contract', label: T.tabContract },
          ]}
        />
      </ProfileHeader>

      <TabPanel idPrefix="fighter" id="overview" selected={tab} class="l-grid fighter-panel">
        <Overview f={f} view={view} klass={klass} race={race} state={state} content={content} own={own} actions={actions} />
      </TabPanel>
      <TabPanel idPrefix="fighter" id="tactics" selected={tab} class="l-grid fighter-panel">
        <TacticsTab f={f} klass={klass} state={state} content={content} own={own} actions={actions} ctx={ctx} />
      </TabPanel>
      <TabPanel idPrefix="fighter" id="log" selected={tab} class="fighter-panel">
        <MatchLog f={f} state={state} content={content} />
      </TabPanel>
      <TabPanel idPrefix="fighter" id="contract" selected={tab} class="fighter-panel">
        <ContractTab f={f} view={view} state={state} />
      </TabPanel>
    </section>
  );
}

type Actions = ReturnType<typeof clubActions> | null;

// ---- Header ---------------------------------------------------------------------------------------------

function ProfileHeader(props: {
  f: Fighter;
  view: FighterView | null;
  klass: ClassDef;
  race: RaceDef;
  state: GameState;
  content: ContentDB;
  ctx: ClubContext | null;
  own: boolean;
  actions: Actions;
  tierName: ReturnType<ContentDB['tiers']['get']>;
  children?: ComponentChildren;
}) {
  const { f, view, klass, state, content, ctx, own, actions } = props;
  const store = useStore();
  const club = ctx?.club;
  const entry = club?.lineup.fighters.find((e) => e.fighterId === f.id);
  const isCaptain = club?.captainId === f.id;
  const isVice = club?.viceCaptainId === f.id;
  const roles = roleNames(klass, content);
  const assignment = club?.lineup.tactics[f.id];
  const preset = content.presets.get(assignment?.kind === 'preset' ? assignment.presetId : klass.defaultPresetId);
  const traits = fighterTraits(f, content);
  const contract = contractEnds(f.contract, state.calendar.season);
  const retired = f.status === 'retired';
  const injured = !!(f.injury && f.injury.weeksOut > 0);
  const since = f.contract?.signedAt.season;
  const rosterAfter = ctx ? ctx.roster.length - 1 : 0;
  const billAfter = ctx?.wageBill !== null && ctx?.wageBill !== undefined ? ctx.wageBill - (f.contract?.wagePerWeek ?? 0) : null;
  const engine = useEngine();
  const payout = own && ctx ? safeView(() => engine.releasePayout(state, ctx.club.id, f.id, content), null) : null;
  const balance = ctx?.finance?.balance ?? null;

  return (
    <section class="panel panel--hero" aria-labelledby="fighter-name" data-testid="profile-head">
      <div class="profile-head">
        <Portrait size="lg" role={rolesOf(klass)[0]} race={f.raceId} injured={injured} label={`${raceName(f, content)}, ${roles.join(' and ')}`} />
        <div class="fighter-head__main">
          <h1 class="profile-head__name" id="fighter-name">
            {f.name.full}
            {isCaptain && <CaptainMark tip={view ? `Club captain · captaincy ${view.captaincy.cq} of 100 (${captaincyGradeLabel(view.captaincy.gradeId, content)})` : undefined} />}
            {isVice && <ViceCaptainTag />}
            {retired && <Tag kind="outline">{format(T.retiredRibbon, { season: f.history[f.history.length - 1]?.season ?? state.calendar.season })}</Tag>}
          </h1>
          <div class="profile-head__facts">
            {klass.archetypes.map((a, i) => (
              <RoleBadge key={a} role={a} name={roles[i] ?? a} tip={format(T.roleTip, { role: roles[i] ?? a })} />
            ))}
            <span {...tipAttrs({ kicker: 'Class', title: klass.name, body: klass.description, flavor: klass.flavor })}>
              <strong>{klass.name}</strong>
            </span>
            <span {...tipAttrs(view ? `Human-age equivalent ${view.humanAge}` : null)}>
              {raceName(f, content)} · <strong>{f.age}</strong>
            </span>
            {club && (
              <span>
                {entry ? (
                  <>
                    <RowMark row={entry.row} /> {T.row}
                  </>
                ) : (
                  <RowMark row="bench" label={T.reserve} />
                )}
              </span>
            )}
            {preset && (
              <span>
                {T.preset} <strong {...tipAttrs(presetTip(preset, klass, content))}>{preset.name}</strong>
              </span>
            )}
            {since !== undefined && f.clubId && (
              <span {...tipAttrs(format(T.sinceTip, { season: since }))}>
                {T.sinceClub} <strong>S{since}</strong>
              </span>
            )}
            {!f.clubId && f.status === 'free-agent' && <Tag kind="info">{T.freeAgent}</Tag>}
          </div>
          {traits.length > 0 && (
            <div class="trait-list fighter-traits">
              {traits.map((tr) => (
                <TraitBadge key={tr.id} name={tr.name} polarity={tr.polarity} tip={tr.tip} />
              ))}
            </div>
          )}
        </div>
        <div class="l-stack l-stack--sm fighter-head__side">
          <div class="profile-head__ratings">
            {view && (
              <div class="rating-stack" tabIndex={0} {...tipAttrs(ratingTip(view, klass, content, props.tierName))}>
                <Rating value={view.rating} size="lg" />
                <span class="rating-stack__label">{T.rating}</span>
              </div>
            )}
            {view && (
              <div class="rating-stack" tabIndex={0} {...tipAttrs(potentialTip(view.potential))}>
                <span class="l-row fighter-potential">
                  <Stars potential={view.potential} />
                  <strong class="u-lg u-num">{view.potential}</strong>
                </span>
                <span class="rating-stack__label">{T.potential}</span>
              </div>
            )}
          </div>
          {own && actions && ctx && (
            <div class="l-cluster l-cluster--xs fighter-actions">
              {!isCaptain && (
                <button class="btn btn--sm" type="button" onClick={() => actions.setCaptain(f.id)} {...tipAttrs(T.makeCaptainTip)}>
                  <Icon name="crown" />
                  {T.makeCaptain} <kbd>C</kbd>
                </button>
              )}
              {!isVice && !isCaptain && (
                <button class="btn btn--sm" type="button" onClick={() => actions.setVice(f.id)} {...tipAttrs(T.makeViceTip)}>
                  {T.makeVice} <kbd>V</kbd>
                </button>
              )}
              {contract.final ? (
                <a class="btn btn--sm" href={`#/market?renew=${f.id}`} {...tipAttrs(T.renewOpen)}>
                  <Icon name="contract" />
                  {T.renew}
                </a>
              ) : (
                <button class="btn btn--sm" type="button" aria-disabled="true" {...tipAttrs(format(T.renewTip, { season: f.contract?.endSeason ?? '—' }))}>
                  <Icon name="contract" />
                  {T.renew}
                </button>
              )}
              <a class="btn btn--sm" href={`#/market?compare=${f.id}`} {...tipAttrs(T.compareTip)}>
                <Icon name="compare" />
                {T.compare}
              </a>
              <ConfirmButton
                size="sm"
                variant="danger"
                icon="user-minus"
                testId="release"
                title={format(T.releaseTitle, { name: f.name.full })}
                description={format(T.releaseText, { name: f.name.given })}
                warning={T.releaseWarning}
                confirmLabel={format(T.releaseConfirm, { name: f.name.given })}
                confirmVariant="danger"
                consequences={[
                  { label: T.releasePayout, value: payout !== null ? formatMoney(payout) : '—', tip: T.releasePayoutTip },
                  ...(payout !== null && balance !== null ? [{ label: T.releaseBalance, value: formatMoney(balance - payout) }] : []),
                  { label: T.releaseWage, value: f.contract ? formatMoney(f.contract.wagePerWeek, { perWeek: true }) : '—' },
                  {
                    label: T.releaseLeft,
                    value: f.contract
                      ? format(contract.final ? T.contractFinal : T.contractEndsValue, { season: f.contract.endSeason, n: contract.seasonsLeft })
                      : '—',
                  },
                  { label: T.releaseRoster, value: `${rosterAfter} / ${ctx.rosterCap}` },
                  { label: T.releaseBill, value: billAfter !== null ? formatMoney(billAfter, { perWeek: true }) : '—' },
                  ...(isCaptain ? [{ label: T.releaseCaptain, value: T.releaseCaptainNone }] : []),
                ]}
                onConfirm={() => {
                  const res = store.dispatch({ type: 'roster.release', clubId: ctx.club.id, fighterId: f.id });
                  if (res.ok) navigate('#/squad');
                }}
              >
                {T.release}
              </ConfirmButton>
            </div>
          )}
        </div>
      </div>
      {props.children}
    </section>
  );
}

// ---- Overview --------------------------------------------------------------------------------------------

function Overview(props: { f: Fighter; view: FighterView | null; klass: ClassDef; race: RaceDef; state: GameState; content: ContentDB; own: boolean; actions: Actions }) {
  const { f, view, klass, race, state, content, own, actions } = props;
  const lastRow = f.history[f.history.length - 1];
  const stats = content.stats.list;
  const statBar = (id: string) => {
    const def = content.stats.require(id);
    const value = view?.stats[id as StatId] ?? 0;
    const cap = Math.round((f.cap100[id as StatId] ?? 0) / 100);
    const wear = Math.round((f.wear100[id as StatId] ?? 0) / 100);
    const change = lastRow ? value - (lastRow.stats[id as StatId] ?? value) : null;
    const tip =
      `${def.name} ${value}: ${def.description}` +
      format(T.statTipCap, { cap }) +
      (wear > 0 ? format(T.statTipWear, { wear }) : '') +
      (change !== null && change !== 0 ? format(T.statTipChange, { change: change > 0 ? `+${change}` : `−${-change}` }) : '');
    return <StatBar key={id} label={def.name} value={value} cap={cap} peak={wear > 0 ? value + wear : null} delta={change} tip={tip} />;
  };
  const physical = stats.filter((s) => s.group === 'physical');
  const mental = stats.filter((s) => s.group === 'mental');
  const traits = fighterTraits(f, content);
  const injured = f.injury && f.injury.weeksOut > 0 ? f.injury : null;
  const trend = view ? trendInfo(view.trend, content) : null;
  const xpCfg = content.development.xp;
  const contract = contractEnds(f.contract, state.calendar.season);
  const statuses = f.statuses.map((s) => statusLabel(s.id, content));

  return (
    <>
      {injured && (
        <div class="span-12">
          <Callout kind="bad" icon="injury" title={format(T.injuryTitle, { label: injuryLabel(injured, content), weeks: injured.weeksOut })}>
            {injuryTip(injured, content)} {T.injuryText}
          </Callout>
        </div>
      )}
      <Panel span={4} title={T.attributes} subtitle={T.attributesSub} footer={<span>{T.attributesFooter}</span>} bodyClass="l-stack" testId="attributes">
        <div>
          <div class="panel-section__title" {...tipAttrs(T.physicalTip)}>
            {T.physical}
          </div>
          <div class="stat-list">{physical.map((s) => statBar(s.id))}</div>
        </div>
        <div>
          <div class="panel-section__title" {...tipAttrs(T.mentalTip)}>
            {T.mental}
          </div>
          <div class="stat-list">{mental.map((s) => statBar(s.id))}</div>
        </div>
      </Panel>
      <div class="span-4 l-stack">
        <AgeCurve f={f} race={race} content={content} humanAge={view?.humanAge ?? f.age} />
        <Panel
          title={T.development}
          subtitle={view ? format(T.developmentSub, { p: view.potential, trend: trend?.label ?? '—' }) : undefined}
          subtitleTip={view ? potentialTip(view.potential) : undefined}
          bodyClass="l-stack l-stack--sm"
          actions={
            own && actions ? (
              <span {...tipAttrs(T.trainingTip)}>
                <Segmented<Fighter['trainingEmphasis']>
                  label={T.training}
                  value={f.trainingEmphasis}
                  onChange={(v) => actions.setEmphasis(f.id, v)}
                  options={trainingOptions(content).map((o) => ({ id: o.id, label: o.label }))}
                />
              </span>
            ) : undefined
          }
        >
          <div class="l-row u-sm" {...tipAttrs(format(T.seasonXpTip, { per: xpCfg.perRoundStarted, win: xpCfg.winBonus, down: xpCfg.downCreditEach, max: xpCfg.downCreditMax, target: xpCfg.seasonTarget }))}>
            <span class="u-muted" {...tipAttrs(format(T.seasonXpTip, { per: xpCfg.perRoundStarted, win: xpCfg.winBonus, down: xpCfg.downCreditEach, max: xpCfg.downCreditMax, target: xpCfg.seasonTarget }))}>
              {T.seasonXp}
            </span>
            <span class="l-push u-num">
              <strong>{formatInt(f.season.xp)}</strong> <span class="u-muted">{format(T.typical, { n: xpCfg.seasonTarget })}</span>
            </span>
          </div>
          <Progress value={f.season.xp / Math.max(1, xpCfg.seasonTarget)} tip={format(T.seasonXpTip, { per: xpCfg.perRoundStarted, win: xpCfg.winBonus, down: xpCfg.downCreditEach, max: xpCfg.downCreditMax, target: xpCfg.seasonTarget })} />
          <RatingHistory f={f} view={view} state={state} />
        </Panel>
      </div>
      <div class="span-4 l-stack">
        <Panel
          title={T.traits}
          subtitle={format(T.traitsSub, { pos: traits.filter((x) => x.polarity !== 'neg').length, neg: traits.filter((x) => x.polarity === 'neg').length })}
          subtitleTip={T.traitsTip}
          body="tight"
          testId="traits"
        >
          {traits.length === 0 ? (
            <span class="u-faint u-sm">{T.noTraits}</span>
          ) : (
            traits.map((tr) => (
              <div key={tr.id} class="trait-row">
                <TraitBadge name={tr.name} polarity={tr.polarity} tip={tr.tip} />
                <span class="trait-row__effect">{tr.effect}</span>
              </div>
            ))
          )}
        </Panel>
        <Panel
          title={T.fitness}
          body="tight"
          headerExtra={
            <span class="l-push">
              {injured ? (
                <Tag kind="bad" icon="injury">
                  {T.injured}
                </Tag>
              ) : (
                <Tag kind="good" icon="check">
                  {T.fit}
                </Tag>
              )}
            </span>
          }
        >
          <dl class="kv">
            <KV label={T.wage} tip={f.contract ? `Wage until the end of S${f.contract.endSeason}` : undefined}>
              {f.contract ? formatMoney(f.contract.wagePerWeek, { perWeek: true }) : '—'}
            </KV>
            <KV label={T.contractEnds} tip="Contracts expire in the season-end step of their last season.">
              {f.contract ? (contract.final ? format(T.contractFinal, { season: f.contract.endSeason }) : format(T.contractEndsValue, { season: f.contract.endSeason, n: contract.seasonsLeft })) : T.contractNone}
            </KV>
            {view && (
              <KV label={T.captaincy} tip={T.captaincyTip}>
                {view.captaincy.cq} · {captaincyGradeLabel(view.captaincy.gradeId, content)}
              </KV>
            )}
            <KV label={T.injuryHistory} tip="Injuries suffered this season">
              {f.season.injuries}
            </KV>
            {view && view.retirementChanceBp > 0 && (
              <KV label={T.retirement} tip={T.retirementTip}>
                {formatPercentBp(view.retirementChanceBp)}
              </KV>
            )}
            {f.finalSeason && (
              <KV label={T.finalSeason} tip={statusLabel('final_season', content).text}>
                {T.finalSeasonText}
              </KV>
            )}
            {statuses.length > 0 && (
              <KV label={T.statuses} tip={statuses.map((s) => `${s.label}: ${s.text}`).join(' ')}>
                {statuses.map((s) => s.label).join(', ')}
              </KV>
            )}
          </dl>
        </Panel>
      </div>
      <CareerTable f={f} view={view} state={state} content={content} klass={klass} />
    </>
  );
}

function KV({ label, tip, children }: { label: string; tip?: string; children: ComponentChildren }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd {...tipAttrs(tip)}>{children}</dd>
    </div>
  );
}

function RatingHistory({ f, view, state }: { f: Fighter; view: FighterView | null; state: GameState }) {
  const points = [...f.history.map((h) => ({ season: h.season, rating: h.rating })), ...(view ? [{ season: state.calendar.season, rating: view.rating }] : [])];
  if (points.length < 2) {
    return (
      <div class="stat-tile">
        <span class="stat-tile__label">{T.ratingBySeason}</span>
        <span class="u-sm u-muted" {...tipAttrs(T.ratingHistoryTip)}>
          {view ? `S${state.calendar.season} ${view.rating}` : '—'} · {T.firstSeasonTrend}
        </span>
      </div>
    );
  }
  const max = 100;
  const xs = points.map((_, i) => 2 + (96 * i) / (points.length - 1));
  const ys = points.map((p) => 28 - (26 * p.rating) / max);
  const potY = view ? 28 - (26 * view.potential) / max : null;
  return (
    <div class="l-row">
      <div class="stat-tile">
        <span class="stat-tile__label">{T.ratingBySeason}</span>
        <span class="u-num u-sm" {...tipAttrs(T.ratingHistoryTip)}>{points.map((p, i) => (i === points.length - 1 ? `S${p.season} ${p.rating}` : `S${p.season} ${p.rating} · `)).join('')}</span>
      </div>
      <svg class="sparkline l-push fighter-spark" viewBox="0 0 100 30" aria-label={points.map((p) => p.rating).join(', ')}>
        {potY !== null && <line class="fighter-spark__potential" x1="2" x2="98" y1={potY} y2={potY} />}
        <polyline points={xs.map((x, i) => `${x},${ys[i]}`).join(' ')} />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" />
      </svg>
    </div>
  );
}

/** Race age curve from development.json (maturity curves, wear table), drawn in the race's own years. */
function AgeCurve({ f, race, content, humanAge }: { f: Fighter; race: RaceDef; content: ContentDB; humanAge: number }) {
  const dev = content.development;
  const H0 = 16;
  const H1 = 40;
  const X0 = 36;
  const X1 = 388;
  const Y0 = 150;
  const Y1 = 26;
  const yOf = (v: number) => Y0 - ((v - 0.4) / 0.6) * (Y0 - Y1);
  const xOf = (h: number) => X0 + ((Math.min(H1, Math.max(H0, h)) - H0) / (H1 - H0)) * (X1 - X0);
  const interp = (pts: readonly (readonly number[])[], h: number) => {
    const list = pts as readonly [number, number][];
    if (h <= list[0]![0]) return list[0]![1];
    for (let i = 1; i < list.length; i++) {
      const [a, va] = list[i - 1]!;
      const [b, vb] = list[i]!;
      if (h <= b) return va + ((vb - va) * (h - a)) / (b - a);
    }
    return list[list.length - 1]![1];
  };
  const wearStart = (dev.decline.physicalPerHumanYear as readonly (readonly number[])[]).find((p) => (p[1] ?? 0) > 0)?.[0] ?? 31;
  const peakAt = (dev.maturityCurve.physical as readonly (readonly number[])[]).find((p) => (p[1] ?? 0) >= 1)?.[0] ?? 28;
  // Wear in points per human-year, shown against a 15-point attribute (typical value).
  const physical = (h: number) => {
    let v = interp(dev.maturityCurve.physical, h);
    let wear = 0;
    for (let y = wearStart; y < h; y += 0.25) wear += interp(dev.decline.physicalPerHumanYear, y) * 0.25;
    v -= wear / 15;
    return Math.max(0.4, v);
  };
  const mental = (h: number) => interp(dev.maturityCurve.mental, h);
  const steps = Array.from({ length: (H1 - H0) * 2 + 1 }, (_, i) => H0 + i / 2);
  const physPts = steps.map((h) => `${xOf(h).toFixed(1)},${yOf(physical(h)).toFixed(1)}`).join(' ');
  const mentPts = steps.map((h) => `${xOf(h).toFixed(1)},${yOf(mental(h)).toFixed(1)}`).join(' ');
  const raceAge = (h: number) => Math.round((h * race.lifespan) / 80);
  const ticks = [16, 20, 24, 28, 32, 36, 40];
  const hx = xOf(humanAge);
  const mult = (80 / race.lifespan).toFixed(2).replace(/\.?0+$/, '');
  return (
    <Panel title={format(T.ageCurve, { race: race.name })} subtitle={T.ageCurveSub} testId="age-curve">
      <svg class="chart" viewBox="0 0 400 186" role="img" aria-label={format(T.ageCaption, { peak: peakAt, wear: wearStart, race: race.plural, mult, name: f.name.given, age: f.age, human: humanAge })}>
        <rect class="chart__zone--grow" x={X0} y="18" width={xOf(peakAt) - X0} height={Y0 - 18} />
        <rect class="chart__zone--peak" x={xOf(peakAt)} y="18" width={xOf(wearStart) - xOf(peakAt)} height={Y0 - 18} />
        <rect class="chart__zone--decline" x={xOf(wearStart)} y="18" width={X1 - xOf(wearStart)} height={Y0 - 18} />
        <text class="chart__zone-label" x={(X0 + xOf(peakAt)) / 2} y="12" text-anchor="middle">
          {T.growth}
        </text>
        <text class="chart__zone-label" x={(xOf(peakAt) + xOf(wearStart)) / 2} y="12" text-anchor="middle">
          {T.peak}
        </text>
        <text class="chart__zone-label" x={(xOf(wearStart) + X1) / 2} y="12" text-anchor="middle">
          {T.wear}
        </text>
        <g class="chart__grid">
          {[0.5, 0.75, 1].map((v) => (
            <line key={v} x1={X0} x2={X1} y1={yOf(v)} y2={yOf(v)} />
          ))}
        </g>
        <g class="chart__axis">
          <line x1={X0} x2={X1} y1={Y0} y2={Y0} />
        </g>
        {[0.5, 0.75, 1].map((v) => (
          <text key={v} x="30" y={yOf(v) + 4} text-anchor="end">
            {Math.round(v * 100)}%
          </text>
        ))}
        {ticks.map((h) => (
          <text key={h} x={xOf(h)} y="166" text-anchor="middle">
            {raceAge(h)}
          </text>
        ))}
        <text x={(X0 + X1) / 2} y="182" text-anchor="middle">
          {T.age}
        </text>
        <polyline class="chart__curve chart__curve--dashed" points={mentPts} />
        <polyline class="chart__curve" points={physPts} />
        <line class="chart__marker-line" x1={hx} x2={hx} y1="18" y2={Y0} />
        <circle class="chart__marker" cx={hx} cy={yOf(physical(humanAge))} r="6" />
        <text class="chart__marker-label" x={hx + 6} y={Math.max(24, yOf(physical(humanAge)) + 20)}>
          {f.age}
        </text>
      </svg>
      <div class="legend fighter-legend">
        <span class="legend__item">
          <svg width="22" height="8" aria-hidden="true">
            <line class="fighter-legend__line" x1="0" x2="22" y1="4" y2="4" />
          </svg>
          {T.legendPhysical}
        </span>
        <span class="legend__item">
          <svg width="22" height="8" aria-hidden="true">
            <line class="fighter-legend__line fighter-legend__line--dashed" x1="0" x2="22" y1="4" y2="4" />
          </svg>
          {T.legendMental}
        </span>
        <span class="legend__item" {...tipAttrs(format(T.legendYouTip, { age: f.age, human: humanAge }))}>
          <span class="legend__swatch" style={{ '--swatch': 'var(--c-accent)' }} />
          {format(T.legendYou, { name: f.name.given, age: f.age })}
        </span>
      </div>
      <p class="u-sm u-muted fighter-caption">{format(T.ageCaption, { peak: peakAt, wear: wearStart, race: race.plural, mult, name: f.name.given, age: f.age, human: humanAge })}</p>
    </Panel>
  );
}

interface CareerRow {
  season: number;
  clubId: string | null;
  age: number;
  rating: number | null;
  potential: number | null;
  xp: number;
  usageBp: number | null;
  injuries: number;
  traits: string;
  now: boolean;
}

function CareerTable({ f, view, state, content }: { f: Fighter; view: FighterView | null; state: GameState; content: ContentDB; klass: ClassDef }) {
  const rows: CareerRow[] = [
    {
      season: state.calendar.season,
      clubId: f.clubId,
      age: f.age,
      rating: view?.rating ?? null,
      potential: view?.potential ?? null,
      xp: f.season.xp,
      usageBp: null,
      injuries: f.season.injuries,
      traits: '',
      now: true,
    },
    ...[...f.history].reverse().map((h) => ({
      season: h.season,
      clubId: h.clubId,
      age: h.age,
      rating: h.rating,
      potential: h.potential,
      xp: h.xp,
      usageBp: h.usageBp,
      injuries: h.injuries,
      traits: h.traitsGained.map((id) => content.traits.get(id)?.name ?? id).join(', '),
      now: false,
    })),
  ];
  const columns: Column<CareerRow>[] = [
    {
      id: 'season',
      header: T.colSeason,
      sortValue: (r) => r.season,
      cell: (r) => (
        <span {...tipAttrs(`Season ${r.season}`)}>
          S{r.season} {r.now && <Tag kind="accent">{T.now}</Tag>}
        </span>
      ),
    },
    {
      id: 'club',
      header: T.colClub,
      fill: true,
      cell: (r) => {
        const c = r.clubId ? state.clubs[r.clubId as keyof typeof state.clubs] : undefined;
        return c ? (
          <span class="entity">
            <Crest primary={c.colors.primary} secondary={c.colors.secondary} />
            <span class="entity__name">{c.name}</span>
          </span>
        ) : (
          <span class="u-faint">{T.freeAgent}</span>
        );
      },
    },
    { id: 'age', header: T.colAge, align: 'num', sortValue: (r) => r.age, cell: (r) => <span {...tipAttrs(`Age ${r.age} in S${r.season}`)}>{r.age}</span> },
    { id: 'xp', header: T.colXp, align: 'num', sortValue: (r) => r.xp, cell: (r) => <span {...tipAttrs(`Season XP ${r.xp}`)}>{formatInt(r.xp)}</span> },
    {
      id: 'usage',
      header: T.colUsage,
      headerTip: T.colUsageTip,
      align: 'num',
      class: 'col-mid',
      sortValue: (r) => r.usageBp ?? -1,
      cell: (r) => (r.usageBp === null ? '—' : <span {...tipAttrs(T.colUsageTip)}>{formatPercentBp(r.usageBp, 0)}</span>),
    },
    { id: 'injuries', header: T.colInjuries, align: 'num', sortValue: (r) => r.injuries, cell: (r) => <span {...tipAttrs(`Injuries in S${r.season}: ${r.injuries}`)}>{r.injuries}</span> },
    { id: 'traits', header: T.colTraits, class: 'cell-wrap col-wide', cell: (r) => r.traits || <span class="u-faint">—</span> },
    {
      id: 'rating',
      header: T.colRating,
      align: 'num',
      sortValue: (r) => r.rating ?? 0,
      cell: (r) => (r.rating === null ? '—' : <Rating value={r.rating} tip={`Rating ${r.rating} at the end of S${r.season}`} />),
    },
    { id: 'potential', header: T.colPotential, align: 'num', sortValue: (r) => r.potential ?? 0, cell: (r) => (r.potential === null ? '—' : <span {...tipAttrs(potentialTip(r.potential))}>{r.potential}</span>) },
  ];
  const c = f.career;
  return (
    <Panel
      span={12}
      title={T.career}
      subtitle={T.careerSub}
      body="flush"
      testId="career"
      footer={<span>{format(T.careerFooter, { matches: c.matches, rw: c.roundsWon, rl: c.roundsStarted - c.roundsWon, downs: c.downsInflicted, titles: c.titles })}</span>}
    >
      <DataTable<CareerRow>
        label={T.career}
        variant={['compact']}
        columns={columns}
        rows={rows}
        rowKey={(r) => String(r.season)}
        empty={<Empty compact title={T.noHistory} />}
      />
    </Panel>
  );
}

// ---- Tactics ------------------------------------------------------------------------------------------------

function TacticsTab({ f, klass, state, content, own, actions, ctx }: { f: Fighter; klass: ClassDef; state: GameState; content: ContentDB; own: boolean; actions: Actions; ctx: ClubContext | null }) {
  const club = ctx?.club;
  const assignment = club?.lineup.tactics[f.id];
  const presetId = assignment?.kind === 'preset' ? assignment.presetId : klass.defaultPresetId;
  const preset = content.presets.get(presetId);
  const presets = presetsOf(klass, content);
  const last = Object.values(state.results)
    .filter((r) => r.fighterStats[f.id])
    .sort((a, b) => b.weekIndex - a.weekIndex)[0];
  const stats = last?.fighterStats[f.id];
  const fires = (i: number) => stats?.ruleFires[i];
  const never = (i: number) => stats?.rulesNeverFired.includes(i) ?? false;
  const kit = (['basic', 'a1', 'a2', 'passive'] as const).map((slot) => ({ slot, a: safeView(() => content.classAbility(klass.id, slot), null) }));
  return (
    <>
      <Panel
        span={8}
        title={format(T.presetRules, { name: preset?.name ?? '—' })}
        subtitle={T.presetRulesSub}
        testId="preset-rules"
        actions={
          <span class="select-wrap">
            <select
              class="select select--sm"
              aria-label={T.presetSelect}
              value={presetId}
              disabled={!own || !actions}
              onChange={(e) => actions?.setPreset(f.id, (e.target as HTMLSelectElement).value)}
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </span>
        }
        footer={
          <>
            <Icon name="info" />
            {format(T.tacticsFooter, { klass: klass.name })}
          </>
        }
      >
        {preset && (
          <>
            <p class="u-sm u-muted fighter-summary">{preset.summary}</p>
            <ol class="rule-list">
              {preset.rules.map((rule, i) => {
                const p = ruleParts(rule, klass, content);
                return (
                  <li key={rule.id}>
                    <RuleLine parts={p} />
                    {stats &&
                      (never(i) ? (
                        <span class="rule-list__fires u-warn">{T.neverFired}</span>
                      ) : fires(i) !== undefined ? (
                        <span class="rule-list__fires" {...tipAttrs('Times this rule acted in the last match')}>
                          {format(T.firesLast, { n: fires(i)! })}
                        </span>
                      ) : null)}
                  </li>
                );
              })}
              <li>
                <span class="rule">
                  <span class="rule__id">St</span> <span class="rule__v">{stanceName(preset.stance, content)}</span> stance: {stanceDescription(preset.stance, content)}
                </span>
              </li>
            </ol>
          </>
        )}
      </Panel>
      <Panel span={4} title={format(T.kit, { klass: klass.name })} body="tight" testId="kit">
        <dl class="kv">
          {kit.map(({ slot, a }) =>
            a ? (
              <div key={slot}>
                <dt {...tipAttrs({ kicker: slot === 'basic' ? T.basic : slot === 'passive' ? T.passive : slot.toUpperCase(), title: a.name, body: a.description })}>{a.name}</dt>
                <dd {...tipAttrs(a.description)}>
                  {slot === 'basic' ? T.basic : slot === 'passive' ? T.passive : [a.cooldownS ? format(T.cooldown, { s: a.cooldownS }) : null, a.focusCost ? format(T.focus, { n: a.focusCost }) : null].filter(Boolean).join(' · ')}
                </dd>
              </div>
            ) : null,
          )}
        </dl>
      </Panel>
    </>
  );
}

// ---- Match log and contract -----------------------------------------------------------------------------------

interface LogRow {
  fixtureId: string;
  weekIndex: number;
  opponent: string;
  won: boolean;
  score: string;
  downs: number;
  damage: number;
  taken: number;
}

function MatchLog({ f, state, content }: { f: Fighter; state: GameState; content: ContentDB }) {
  const rows: LogRow[] = Object.values(state.results)
    .filter((r) => r.season === state.calendar.season && r.fighterStats[f.id])
    .map((r) => {
      const s = r.fighterStats[f.id]!;
      const home = s.clubId === r.homeClubId;
      const other = state.clubs[home ? r.awayClubId : r.homeClubId];
      return {
        fixtureId: r.fixtureId,
        weekIndex: r.weekIndex,
        opponent: other?.name ?? '',
        won: r.winnerClubId === s.clubId,
        score: home ? `${r.score.home}–${r.score.away}` : `${r.score.away}–${r.score.home}`,
        downs: s.downsInflicted,
        damage: s.damageDealt,
        taken: s.damageTaken,
      };
    });
  if (rows.length === 0) {
    return (
      <section class="panel">
        <Empty icon="trend" title={T.logEmpty} text={T.logEmptyText} />
      </section>
    );
  }
  const columns: Column<LogRow>[] = [
    { id: 'week', header: T.colWeek, sortValue: (r) => r.weekIndex, cell: (r) => weekCode(content, r.weekIndex) },
    { id: 'opp', header: T.colOpponent, fill: true, sortValue: (r) => r.opponent, cell: (r) => r.opponent },
    {
      id: 'result',
      header: T.colResult,
      cell: (r) => (
        <span class="form">
          <i class="form__r" data-r={r.won ? 'W' : 'L'}>
            {r.won ? 'W' : 'L'}
          </i>{' '}
          {r.score}
        </span>
      ),
    },
    { id: 'downs', header: T.colDowns, align: 'num', sortValue: (r) => r.downs, cell: (r) => <span {...tipAttrs('Downs inflicted')}>{r.downs}</span> },
    { id: 'damage', header: T.colDamage, align: 'num', sortValue: (r) => r.damage, cell: (r) => <span {...tipAttrs('Damage dealt')}>{formatInt(r.damage)}</span> },
    { id: 'taken', header: T.colTaken, align: 'num', sortValue: (r) => r.taken, cell: (r) => <span {...tipAttrs('Damage taken')}>{formatInt(r.taken)}</span> },
    {
      id: 'report',
      header: '',
      cell: (r) => (
        <a class="btn btn--sm btn--ghost" href={`#/match/${encodeURIComponent(r.fixtureId)}`}>
          {T.report}
        </a>
      ),
    },
  ];
  return (
    <Panel title={T.tabLog} body="flush">
      <DataTable<LogRow>
        label={T.tabLog}
        variant={['compact']}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.fixtureId}
        defaultSort={{ column: 'week', dir: 'desc' }}
        onOpen={(r) => navigate(`#/match/${encodeURIComponent(r.fixtureId)}`)}
      />
    </Panel>
  );
}

function ContractTab({ f, view, state }: { f: Fighter; view: FighterView | null; state: GameState }) {
  const c = f.contract;
  if (!c) {
    return (
      <section class="panel">
        <Empty icon="contract" title={T.noContract} text={T.noContractText} />
      </section>
    );
  }
  const ends = contractEnds(c, state.calendar.season);
  return (
    <div class="l-grid">
      <Panel span={6} title={T.contractTitle} body="tight">
        <dl class="kv">
          <KV label={T.wage}>{formatMoney(c.wagePerWeek, { perWeek: true })}</KV>
          <KV label={T.signed}>{format(T.signedValue, { season: c.signedAt.season, week: c.signedAt.weekIndex })}</KV>
          <KV label={T.length}>{format(T.lengthValue, { from: c.startSeason, to: c.endSeason })}</KV>
          <KV label={T.renewal} tip="Renewals answer at once (03 sys-contracts).">
            {ends.final ? T.renewalOpen : format(T.renewalLater, { season: c.endSeason })}
          </KV>
          {view && (
            <KV label={T.marketWage} tip="What clubs would pay for this fighter now, from rating, potential, age, traits and role demand.">
              {formatMoney(view.marketWage, { perWeek: true })}
            </KV>
          )}
        </dl>
      </Panel>
    </div>
  );
}
