/**
 * The app frame shared by every hub screen (04 §6.1): top bar (club,
 * calendar, money, roster, standing, search, digest bell, theme, shortcut
 * sheet, Continue), side navigation, main page area, the embargo banner,
 * and the global overlays (tooltips, toasts, shortcut sheet, search,
 * Simulating). Owns the Continue runner and the global shortcut map.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { ClubId, WeekReport } from '../../core/model';
import { Crest, Icon, Modal, ToastRegion, TooltipLayer, showToast, tipAttrs, undoLast, type Tip } from '../components';
import { formatInt, formatMoney, ordinal } from '../format';
import { phaseName, weekLabel } from '../format/calendar';
import { useStore, type AppStore } from '../store';
import { buildDigest, needsActionCount } from '../store/digest';
import { useEngine } from '../store/engine';
import { effectiveTheme, pacingStops, reducedMotion, settings, updateSettings } from '../store/settings';
import { usePlayerClub, type ClubContext } from '../store/views';
import { t } from '../text';
import { continueModel, type ContinueModel } from './continue';
import { NAV_FOOTER, NAV_ITEMS, navOwner } from './nav';
import { SearchPalette, ShortcutSheet, SimulatingPanel } from './overlays';
import { goBack, navigate, useRoute } from './router';
import type { RouteId } from './routes';
import { installShortcuts, type ShortcutMap } from './shortcuts';

const SIMULATING_MS = 600;

export interface FrameProps {
  children: ComponentChildren;
  /** Toggle the debug overlay (dev or ?debug=1). */
  onToggleDebug?: () => void;
}

export function Frame({ children, onToggleDebug }: FrameProps) {
  const store = useStore() as AppStore;
  const engine = useEngine();
  const ctx = usePlayerClub();
  const { route } = useRoute();
  const routeId = route?.id ?? null;
  const [sheet, setSheet] = useState(false);
  const [search, setSearch] = useState(false);
  const [confirm, setConfirm] = useState<'kick-off' | 'season-end' | null>(null);
  const [simulating, setSimulating] = useState<number | null>(null);
  const s = settings.value;

  const model = continueModel({
    state: store.game.value,
    content: store.content.value,
    engine,
    blockers: store.blockers.value,
    routeId,
    busy: store.busy.value || simulating !== null,
    stops: pacingStops(s),
  });

  const digest = ctx ? buildDigest(ctx.state, ctx.content, ctx.club.id, store.blockers.value) : [];
  const needsAction = needsActionCount(digest);

  const afterMatch = (report: WeekReport) => {
    const state = store.game.value;
    const clubId = state?.playerClubId;
    const fixtureId = report.playerFixtureId;
    if (!state || !clubId || !fixtureId) return;
    const result = state.results[fixtureId];
    const stops = pacingStops(settings.value);
    const won = result?.winnerClubId === clubId;
    const injured = Object.values(state.fighters).some(
      (f) => f.clubId === clubId && f.injury && f.injury.since.season === report.season && f.injury.since.weekIndex === report.weekIndex,
    );
    const open = stops.reportAlways || (!won && stops.reportOnLoss) || (injured && stops.reportOnInjury);
    if (open) {
      navigate(`#/match/${encodeURIComponent(fixtureId)}`);
      return;
    }
    navigate('#/home');
    if (result) {
      const home = result.homeClubId === clubId;
      const other = state.clubs[(home ? result.awayClubId : result.homeClubId) as ClubId];
      const score = home ? `${result.score.home}–${result.score.away}` : `${result.score.away}–${result.score.home}`;
      showToast({
        title: t(won ? 'continue.resultWon' : 'continue.resultLost', { score, where: home ? t('continue.vs') : t('continue.at'), club: other?.name ?? '' }),
        kind: won ? 'good' : 'info',
        action: { label: t('continue.openReport'), onClick: () => navigate(`#/match/${encodeURIComponent(fixtureId)}`) },
      });
    }
  };

  const advance = async (playsMatch: boolean) => {
    const delay = playsMatch && !reducedMotion(settings.value) ? SIMULATING_MS : 0;
    if (playsMatch) setSimulating(ctx?.fixture?.bestOf ?? 3);
    const [res] = await Promise.all([store.advance(), new Promise((r) => setTimeout(r, delay))]);
    setSimulating(null);
    if (!res.ok) return;
    if (res.value.playerFixtureId) afterMatch(res.value);
    else if (routeId !== 'home') navigate('#/home');
  };

  const advanceToSeasonEnd = async () => {
    for (let i = 0; i < 6; i++) {
      const g = store.game.value;
      if (!g || g.calendar.phase === 'season-end') break;
      const res = await store.advance();
      if (!res.ok) break;
    }
    navigate('#/home');
  };

  const runContinue = async (m: ContinueModel = model) => {
    const a = m.action;
    switch (a.kind) {
      case 'navigate':
        navigate(a.to);
        return;
      case 'advance':
        await advance(a.playsMatch);
        return;
      case 'confirm-advance':
        setConfirm(a.variant);
        return;
      case 'season-end': {
        const res = await store.finishSeason();
        if (res.ok) navigate('#/season-review');
        return;
      }
      case 'none':
        return;
    }
  };

  const quickSave = async () => {
    if (!store.game.value?.playerClubId) return;
    const res = await store.quickSave();
    if (res.ok) showToast({ title: t('save.saved', { slot: res.value.label }), sub: res.value.slotId, kind: 'good' });
  };

  // Global shortcuts (04 §6.4). Screens add their own layers with useShortcuts().
  useEffect(() => {
    const global = (): ShortcutMap => {
      const map: Record<string, () => boolean | void> = {
        Space: () => void runContinueRef.current(),
        'ctrl+s': () => void quickSaveRef.current(),
        'ctrl+k': () => setSearch(true),
        'ctrl+z': () => {
          undoLast();
        },
        '?': () => setSheet(true),
        Escape: () => goBack(),
        'alt+ArrowLeft': () => goBack(),
      };
      if (onToggleDebug) map['`'] = onToggleDebug;
      for (const n of NAV_ITEMS) if (n.key) map[n.key] = () => navigate(n.href);
      return map;
    };
    return installShortcuts(global);
  }, [onToggleDebug]);
  const runContinueRef = useLatest(runContinue);
  const quickSaveRef = useLatest(quickSave);

  const owner = navOwner(routeId);
  const collapsed = s.navCollapsed;

  return (
    <div class="app" data-nav={collapsed ? 'collapsed' : undefined}>
      <Topbar ctx={ctx} model={model} needsAction={needsAction} onContinue={() => void runContinue()} onSearch={() => setSearch(true)} onSheet={() => setSheet(true)} />
      <nav class="sidenav" aria-label={t('nav.main')}>
        {NAV_ITEMS.map((n) => (
          <a key={n.id} class="sidenav__item" href={n.href} aria-current={owner === n.id ? 'page' : undefined} {...tipAttrs(collapsed ? t(n.label) : null)}>
            <Icon name={n.icon} />
            <span class="sidenav__label">{t(n.label)}</span>
            {n.id === 'home' && needsAction > 0 ? (
              <span class="sidenav__badge" aria-label={t('topbar.digest', { n: needsAction })}>
                {needsAction}
              </span>
            ) : (
              n.key && <span class="sidenav__key">{n.key}</span>
            )}
          </a>
        ))}
        <div class="sidenav__footer">
          {NAV_FOOTER.map((n) => (
            <a key={n.id} class="sidenav__item" href={n.href} aria-current={owner === n.id ? 'page' : undefined} {...tipAttrs(collapsed ? t(n.label) : null)}>
              <Icon name={n.icon} />
              <span class="sidenav__label">{t(n.label)}</span>
              {n.id === 'saves' && (
                <span class="sidenav__key" title="Ctrl S">
                  S
                </span>
              )}
            </a>
          ))}
          <button
            class="sidenav__item"
            type="button"
            onClick={() => updateSettings({ navCollapsed: !collapsed })}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
            {...tipAttrs(collapsed ? t('nav.expand') : null)}
          >
            <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} />
            <span class="sidenav__label">{t('nav.collapse')}</span>
          </button>
        </div>
      </nav>
      <main class="main" id="main">
        {ctx?.finance?.status === 'embargo' && (
          <div class="banner" role="alert">
            <Icon name="warning" />
            <span>
              {t('finance.embargo', { balance: formatMoney(ctx.finance.balance) })}
              {ctx.finance.statusReason ? ` · ${ctx.finance.statusReason}` : ''}
            </span>
          </div>
        )}
        {children}
      </main>
      <TooltipLayer />
      <ToastRegion />
      <ShortcutSheet open={sheet} onClose={() => setSheet(false)} />
      <SearchPalette open={search} onClose={() => setSearch(false)} state={store.game.value} content={store.content.value} />
      {simulating !== null && <SimulatingPanel rounds={simulating} />}
      <ContinueConfirm
        variant={confirm}
        ctx={ctx}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const v = confirm;
          setConfirm(null);
          if (v === 'kick-off') await advance(false);
          else if (v === 'season-end') await advanceToSeasonEnd();
        }}
      />
    </div>
  );
}

function useLatest<T>(value: T): { current: T } {
  const [ref] = useState(() => ({ current: value }));
  ref.current = value;
  return ref;
}

// ---- Top bar ---------------------------------------------------------------------------------------

function Topbar({
  ctx,
  model,
  needsAction,
  onContinue,
  onSearch,
  onSheet,
}: {
  ctx: ClubContext | null;
  model: ContinueModel;
  needsAction: number;
  onContinue: () => void;
  onSearch: () => void;
  onSheet: () => void;
}) {
  const theme = effectiveTheme(settings.value);
  return (
    <header class="topbar">
      {ctx ? (
        <a class="topbar__club" href="#/home" data-testid="topbar-club">
          <Crest primary={ctx.club.colors.primary} secondary={ctx.club.colors.secondary} code={ctx.club.code} size="md" />
          <span class="topbar__club-text">
            <span class="topbar__club-name">{ctx.club.name}</span>
            <span class="topbar__club-tier">
              {ctx.tier.name} · {t('topbar.tier', { n: ctx.tier.level })}
            </span>
          </span>
        </a>
      ) : (
        <a class="topbar__club" href="#/new-game">
          <span class="topbar__club-text">
            <span class="topbar__club-name">{t('app.title')}</span>
          </span>
        </a>
      )}
      {ctx && <TopbarStats ctx={ctx} />}
      <div class="topbar__actions">
        <button class="search-trigger" type="button" onClick={onSearch} aria-label={t('topbar.search')}>
          <Icon name="search" />
          <span class="search-trigger__label">{t('topbar.search')}</span>
          <kbd>Ctrl K</kbd>
        </button>
        <a
          class="icon-btn"
          href="#/home"
          aria-label={needsAction > 0 ? t('topbar.digest', { n: needsAction }) : t('topbar.digestNone')}
          {...tipAttrs(needsAction > 0 ? t('topbar.digest', { n: needsAction }) : t('topbar.digestNone'))}
        >
          <Icon name="bell" />
          {needsAction > 0 && <span class="icon-btn__badge">{needsAction}</span>}
        </a>
        <button
          class="icon-btn"
          type="button"
          aria-label={t('topbar.theme')}
          {...tipAttrs(t('topbar.themeTip'))}
          onClick={() => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
          data-testid="theme-toggle"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button class="icon-btn" type="button" aria-label={t('topbar.shortcuts')} {...tipAttrs(t('topbar.shortcutsTip'))} onClick={onSheet}>
          <Icon name="keyboard" />
        </button>
        <button
          class="continue"
          type="button"
          data-state={model.state === 'blocked' ? 'blocked' : undefined}
          aria-busy={model.state === 'busy' ? 'true' : undefined}
          onClick={onContinue}
          data-testid="continue"
          {...tipAttrs(model.tip)}
        >
          <span class="continue__text">
            <span class="continue__main">{model.main}</span>
            {model.sub && <span class="continue__sub">{model.sub}</span>}
          </span>
          <kbd>Space</kbd>
        </button>
      </div>
    </header>
  );
}

function TopbarStats({ ctx }: { ctx: ClubContext }) {
  const { state, content, club, tier, finance, roster } = ctx;
  const cal = state.calendar;
  const week = weekLabel(content, cal.weekIndex, tier);
  const contracts = roster.filter((f) => f.contract);
  const top = [...contracts].sort((a, b) => (b.contract?.wagePerWeek ?? 0) - (a.contract?.wagePerWeek ?? 0))[0];
  const lineupIds = new Set(club.lineup.fighters.map((e) => e.fighterId));
  const lineupWages = contracts.filter((f) => lineupIds.has(f.id)).reduce((s, f) => s + (f.contract?.wagePerWeek ?? 0), 0);
  const wageBill = ctx.wageBill;
  const wagesTip: Tip = {
    kicker: t('topbar.wages'),
    title: wageBill !== null ? formatMoney(wageBill, { perWeek: true }) : '—',
    body: t('topbar.wagesTip', { n: contracts.length, budget: finance ? formatMoney(finance.wageBudgetPerWeek) : '—' }),
    rows: [
      ...(top ? [{ label: t('topbar.topEarner', { name: top.name.full }), value: formatInt(top.contract!.wagePerWeek) }] : []),
      { label: t('topbar.lineupWages', { n: lineupIds.size }), value: formatInt(lineupWages) },
      { label: t('topbar.reserveWages', { n: contracts.length - lineupIds.size }), value: formatInt((wageBill ?? 0) - lineupWages) },
    ],
    meta: t('topbar.wagesMeta'),
  };
  const balanceTip: Tip = {
    kicker: t('topbar.balance'),
    title: finance ? formatMoney(finance.balance) : '—',
    body: t('topbar.balanceTip'),
    rows: finance
      ? [
          { label: t('topbar.seasonBudget'), value: formatInt(finance.seasonBudget) },
          { label: t('topbar.projected'), value: formatInt(finance.projectedSeasonEndBalance) },
        ]
      : [],
    meta: t('topbar.balanceMeta'),
  };
  const standing = ctx.standing;
  return (
    <div class="topbar__group">
      <div class="topbar__stat" tabIndex={0} {...tipAttrs(t('topbar.calendarTip', { season: cal.season, week, phase: phaseName(cal.phase) }))}>
        <span class="topbar__stat-label">{t('common.season', { n: cal.season })}</span>
        <span class="topbar__stat-value">{week}</span>
      </div>
      <div class="topbar__divider" />
      <div class="topbar__stat" tabIndex={0} {...tipAttrs(balanceTip)}>
        <span class="topbar__stat-label">{t('topbar.balance')}</span>
        <span class="topbar__stat-value">{finance ? formatMoney(finance.balance) : '—'}</span>
      </div>
      <div class="topbar__stat topbar__stat--optional" tabIndex={0} {...tipAttrs(wagesTip)}>
        <span class="topbar__stat-label">{t('topbar.wages')}</span>
        <span class="topbar__stat-value">{wageBill !== null ? formatMoney(wageBill) : '—'}</span>
      </div>
      <div class="topbar__stat topbar__stat--optional" tabIndex={0} {...tipAttrs(t('topbar.rosterTip', { n: roster.length, cap: ctx.rosterCap, tier: tier.name }))}>
        <span class="topbar__stat-label">{t('topbar.roster')}</span>
        <span class="topbar__stat-value">
          {roster.length} / {ctx.rosterCap}
        </span>
      </div>
      <div
        class="topbar__stat"
        tabIndex={0}
        {...tipAttrs(
          standing && ctx.wing
            ? t('topbar.standingTip', { pos: ordinal(standing.position), size: ctx.wingRows.length, wing: ctx.wing.name, tournament: tier.tournamentName })
            : t('topbar.standingNone'),
        )}
      >
        <span class="topbar__stat-label">{t('topbar.standing')}</span>
        <span class="topbar__stat-value">{standing ? t('topbar.standingValue', { pos: ordinal(standing.position), pts: standing.points }) : '—'}</span>
      </div>
    </div>
  );
}

// ---- Commit dialogs of Continue (Kick off season, Advance to season end) --------------------------

function ContinueConfirm({
  variant,
  ctx,
  onClose,
  onConfirm,
}: {
  variant: 'kick-off' | 'season-end' | null;
  ctx: ClubContext | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const kick = variant === 'kick-off';
  return (
    <Modal
      open={variant !== null}
      onClose={onClose}
      title={kick ? t('continue.kickOffTitle') : t('continue.seasonEndTitle')}
      icon={kick ? 'play' : 'calendar-check'}
      size="narrow"
      onEnter={onConfirm}
      testId="continue-confirm"
      footer={
        <>
          <button class="btn" type="button" onClick={onClose}>
            {t('common.cancel')} <kbd>Esc</kbd>
          </button>
          <button class="btn btn--primary" type="button" onClick={onConfirm} data-autofocus>
            {kick ? t('continue.kickOffConfirm') : t('continue.seasonEndConfirm')} <kbd>Enter</kbd>
          </button>
        </>
      }
    >
      <div class="l-stack">
        <p class="u-sm">{kick ? t('continue.kickOffText') : t('continue.seasonEndText')}</p>
        {ctx && (
          <dl class="kv">
            <div>
              <dt>{t('topbar.roster')}</dt>
              <dd>
                {ctx.roster.length} / {ctx.rosterCap}
              </dd>
            </div>
            {ctx.finance && (
              <>
                <div>
                  <dt>{t('topbar.wages')}</dt>
                  <dd>
                    {formatMoney(ctx.finance.wageBill)} / {formatMoney(ctx.finance.wageBudgetPerWeek)}
                  </dd>
                </div>
                <div>
                  <dt>{t('topbar.balance')}</dt>
                  <dd>{formatMoney(ctx.finance.balance)}</dd>
                </div>
              </>
            )}
          </dl>
        )}
      </div>
    </Modal>
  );
}

export type { RouteId };
