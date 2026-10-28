/**
 * The app frame shared by every hub screen (04 §6.1): top bar (club,
 * calendar, money, roster, standing, search, digest bell, theme, shortcut
 * sheet, Continue), side navigation, main page area, the embargo banner,
 * and the global overlays (tooltips, toasts, shortcut sheet, search,
 * Simulating). Owns the Continue runner and the global shortcut map.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
// Direct module imports (not the components barrel) keep screen-only components out of the main bundle.
import { Icon } from '../components/Icon';
import { Crest, crestLetters } from '../components/basic-marks';
import { ToastRegion, clearUndos, showToast, undoLast } from '../components/Toast';
import { TooltipLayer, tipAttrs, type Tip } from '../components/Tooltip';
import { formatInt, formatMoney, ordinal } from '../format';
import { phaseName, weekLabel } from '../format/calendar';
import type { MatchViewMode } from '../../core/model';
import { MATCH_PAUSED, MATCH_WATCHING, SAVE_ROUND_FAILED, WATCH_NOT_SHOWN, isTicketSlot, useStore, type AppStore } from '../store';
import { digestNews, needsActionNow, newsNeedsAction } from '../store/digest-flags';
import { useEngine } from '../store/engine';
import { effectiveTheme, pacingStops, reducedMotion, settings, updateSettings } from '../store/settings';
import { usePlayerClub, type ClubContext } from '../store/views';
import { t } from '../text';
import { continueModel, playModeFor, type ContinueModel } from './continue';
import { NAV_FOOTER, NAV_ITEMS, navOwner } from './nav';
import type * as ContinueDialogs from './continue-dialogs';
import type { ConfirmVariant } from './continue-dialogs';
import { afterMatch } from './after-match';
import { expiringUnrenewed } from './expiring';
import { levelUpRequest, skipToKickOffRequest } from './intents';
import { openTicketTool, playtestToolsOn, ticketBusy } from '../tickets/launcher';
import { SimulatingPanel } from './overlays';
import { quickSaveOrAsk } from './save-intent';
import type * as Palettes from './palettes';
import type * as LevelUps from '../levelup/host';
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
  // A step that outlives the frame (the Simulating pause is 600 ms) must not route afterwards: the frame is gone, and so is
  // the screen it was started from (a stale navigate() would pull the player off whatever he opened meanwhile).
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);
  const [sheet, setSheet] = useState(false);
  const [search, setSearch] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmVariant | null>(null);
  // The commit dialogs are a lazy chunk: loaded shortly after start, or at once when one opens.
  const [dialogs, setDialogs] = useState<typeof ContinueDialogs | null>(null);
  useEffect(() => {
    if (dialogs) return;
    const load = () => void import('./continue-dialogs').then(setDialogs);
    if (confirm) {
      load();
      return;
    }
    const id = setTimeout(load, 1200);
    return () => clearTimeout(id);
  }, [confirm, dialogs]);
  const [simulating, setSimulating] = useState<number | null>(null);
  const s = settings.value;

  // The shortcut sheet and search load on first use, or shortly after start (bundle budget).
  const [palettes, setPalettes] = useState<typeof Palettes | null>(null);
  // M1.1 level-ups: the dialog host loads when a week brought level-ups or a screen asks for one.
  const [levelUps, setLevelUps] = useState<typeof LevelUps | null>(null);
  const wantLevelUps = !!store.lastWeekReport.value?.levelUps?.length || levelUpRequest.value !== null;
  useEffect(() => {
    if (wantLevelUps && !levelUps) void import('../levelup/host').then(setLevelUps);
  }, [wantLevelUps, levelUps]);
  useEffect(() => {
    if (palettes) return;
    const load = () => void import('./palettes').then(setPalettes);
    if (sheet || search) {
      load();
      return;
    }
    const id = setTimeout(load, 1500);
    return () => clearTimeout(id);
  }, [sheet, search, palettes]);

  // A week processed, a season ended or another career loaded: earlier undos would act on the wrong week.
  const cal = store.game.value?.calendar;
  const commitKey = cal ? `${store.game.value!.rng.root}:${cal.season}:${cal.weekIndex}:${cal.phase}` : '';
  useEffect(() => clearUndos(), [commitKey]);

  // Changes since the last save (signings, releases, lineup) are kept only by the next autosave or a
  // manual save: ask before the tab closes on them.
  const dirty = store.dirty?.value ?? false;
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const play = playModeFor(s.pacing, s.arena.watchPreference);
  const model = continueModel({
    state: store.game.value,
    content: store.content.value,
    engine,
    blockers: store.blockers.value,
    routeId,
    busy: store.busy.value || simulating !== null,
    stops: pacingStops(s),
    play,
  });

  const needsAction = ctx ? needsActionNow(ctx.state, ctx.club.id, store.blockers.value) : 0;

  /** A step that did not finish the week: where the player goes (or what he is told) instead. */
  const stopped = (code: string): boolean => {
    if (code === MATCH_PAUSED) navigate('#/between-rounds'); // the player's match waits between rounds (M1.1)
    else if (code === MATCH_WATCHING || code === WATCH_NOT_SHOWN) navigate('#/arena'); // a round waits to be watched (M2)
    else if (code === SAVE_ROUND_FAILED) {
      // The lock could not be saved, so nothing started and nothing opened (the viewer needs the write). Play match again retries.
      showToast({
        kind: 'bad',
        title: t('continue.saveFailedTitle'),
        sub: t('continue.saveFailedSub'),
        durationMs: 15000,
        action: { label: t('continue.retry'), onClick: () => void advanceRef.current(true, 'watch') },
      });
    } else return false;
    return true;
  };

  const advance = async (playsMatch: boolean, mode: MatchViewMode = play.mode) => {
    // The Simulating panel is the simulated match's; a watched match opens the arena straight away.
    const simulates = playsMatch && mode === 'simulate';
    const delay = simulates && !reducedMotion(settings.value) ? SIMULATING_MS : 0;
    if (simulates) setSimulating(ctx?.fixture?.bestOf ?? 3);
    const [res] = await Promise.all([store.advance(playsMatch ? { playerMatch: mode } : undefined), new Promise((r) => setTimeout(r, delay))]);
    if (!alive.current) return;
    setSimulating(null);
    if (!res.ok) {
      stopped(res.error.code);
      return;
    }
    if (res.value.playerFixtureId) afterMatch(store.game.value, res.value);
    else if (routeId !== 'home') navigate('#/home');
  };
  const advanceRef = useLatest(advance);

  const advanceToSeasonEnd = async () => {
    for (let i = 0; i < 6; i++) {
      const g = store.game.value;
      if (!g || g.calendar.phase === 'season-end') break;
      const res = await store.advance({ playerMatch: play.mode });
      if (!res.ok) {
        if (stopped(res.error.code)) return;
        break;
      }
    }
    navigate('#/home');
  };

  /** `other`: the offered alternative (Shift Space, the second button): Simulate when Watch is the default, and the reverse. */
  const runContinue = async (m: ContinueModel = model, other = false) => {
    const a = m.action;
    switch (a.kind) {
      case 'navigate':
        navigate(a.to);
        return;
      case 'advance':
        if (a.playsMatch) await advance(true, other && a.offer ? (a.mode === 'watch' ? 'simulate' : 'watch') : a.mode);
        else await advance(false);
        return;
      case 'confirm-advance':
        setConfirm(a.variant);
        return;
      case 'season-end': {
        // Contracts that end now and were not renewed: say so before the step lets them go.
        if (expiringUnrenewed(ctx).length > 0) {
          setConfirm('expiring');
          return;
        }
        await runSeasonEnd();
        return;
      }
      case 'none':
        return;
    }
  };

  // "Skip to Matchweek 1": run quiet preseason weeks one by one; stop as soon as something needs the
  // player (a blocker, a needs-action digest item) or the next stop is not a plain week (kick-off asks).
  const skipToKickOff = async () => {
    for (let i = 0; i < 6; i++) {
      const g = store.game.value;
      const c = store.content.value;
      if (!g || !c || g.calendar.phase !== 'preseason') return;
      const m = continueModel({ state: g, content: c, engine, blockers: store.blockers.value, routeId, busy: false, stops: pacingStops(settings.value) });
      if (m.action.kind === 'confirm-advance') {
        setConfirm(m.action.variant);
        return;
      }
      if (m.action.kind !== 'advance' || m.action.playsMatch) return;
      const res = await store.advance();
      if (!res.ok) return;
      const state = store.game.value!;
      const stop = state.playerClubId ? digestNews(state, state.playerClubId).some((n) => newsNeedsAction(n, state)) : false;
      if (stop || store.blockers.value.length > 0) {
        navigate('#/home');
        showToast({ title: t('skip.stopped', { week: weekLabel(c, state.calendar.weekIndex) }), sub: t('skip.stoppedSub'), kind: 'info' });
        return;
      }
    }
  };
  const skipRequest = skipToKickOffRequest.value;
  useEffect(() => {
    if (skipRequest > 0) void skipToKickOff();
  }, [skipRequest]);

  const runSeasonEnd = async () => {
    const res = await store.finishSeason();
    if (res.ok) navigate('#/season-review');
  };

  const quickSave = () => quickSaveOrAsk(store);

  // Global shortcuts (04 §6.4). Screens add their own layers with useShortcuts().
  useEffect(() => {
    const global = (): ShortcutMap => {
      const map: Record<string, (e: KeyboardEvent) => boolean | void> = {
        Space: (e) => void runContinueRef.current(undefined, e.shiftKey),
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
      for (const n of [...NAV_ITEMS, ...NAV_FOOTER]) if (n.key) map[n.key] = () => navigate(n.href);
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
      <Topbar ctx={ctx} model={model} needsAction={needsAction} onContinue={() => void runContinue()} onOther={() => void runContinue(undefined, true)} onSearch={() => setSearch(true)} onSheet={() => setSheet(true)} />
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
              {n.key && <span class="sidenav__key">{n.key.toUpperCase()}</span>}
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
        {isTicketSlot(store.loadedSlot.value) && (
          <div class="banner banner--info" role="status" data-testid="ticket-repro">
            <Icon name="bug" />
            <span>{t('tickets.repro', { id: store.loadedSlot.value!.slice(7) })}</span>
          </div>
        )}
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
      {palettes && <palettes.ShortcutSheet open={sheet} onClose={() => setSheet(false)} />}
      {levelUps && <levelUps.LevelUpHost />}
      {palettes && <palettes.SearchPalette open={search} onClose={() => setSearch(false)} state={store.game.value} content={store.content.value} />}
      {simulating !== null && <SimulatingPanel rounds={simulating} />}
      {dialogs && (
      <dialogs.ContinueConfirm
        variant={confirm}
        ctx={ctx}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const v = confirm;
          setConfirm(null);
          if (v === 'kick-off') await advance(false);
          else if (v === 'season-end') await advanceToSeasonEnd();
          else if (v === 'expiring') await runSeasonEnd();
        }}
      />
      )}
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
  onOther,
  onSearch,
  onSheet,
}: {
  ctx: ClubContext | null;
  model: ContinueModel;
  needsAction: number;
  onContinue: () => void;
  /** Play match: the other way to play it (Simulate beside a primary Watch, and the reverse). */
  onOther: () => void;
  onSearch: () => void;
  onSheet: () => void;
}) {
  const theme = effectiveTheme(settings.value);
  const store = useStore() as AppStore;
  return (
    <header class="topbar">
      {ctx ? (
        <a class="topbar__club" href="#/home" data-testid="topbar-club" aria-label={ctx.club.name} {...tipAttrs(ctx.club.name.length > TOPBAR_NAME_MAX ? ctx.club.name : null)}>
          <Crest primary={ctx.club.colors.primary} secondary={ctx.club.colors.secondary} code={crestLetters(ctx.club)} size="md" />
          <span class="topbar__club-text">
            {/* A long name would be cut in the nav-width block: the short name fits whole. */}
            <span class="topbar__club-name">{ctx.club.name.length > TOPBAR_NAME_MAX ? ctx.club.shortName : ctx.club.name}</span>
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
        {playtestToolsOn() && (
          <button
            class="icon-btn"
            type="button"
            aria-label={t('tickets.report')}
            aria-disabled={ticketBusy.value ? 'true' : undefined}
            {...tipAttrs(t('tickets.report'))}
            onClick={() => void openTicketTool(store)}
            data-testid="ticket-button"
          >
            <Icon name="bug" />
          </button>
        )}
        {model.action.kind === 'advance' && model.action.playsMatch && model.action.offer ? (
          // Play match offers both (open-020, Q54; mockups/arena.html .playmatch): Watch is brass, Simulate neutral; one primary per screen.
          <div class="playmatch" role="group" aria-label={t('continue.playMatch')}>
            <button class="continue" type="button" onClick={onContinue} data-testid="continue" aria-busy={model.state === 'busy' ? 'true' : undefined} {...tipAttrs(model.tip)}>
              {model.action.mode === 'watch' && <Icon name="eye" />}
              <span class="continue__text">
                <span class="continue__main">{t(model.action.mode === 'watch' ? 'continue.watch' : 'continue.simulate')}</span>
                <span class="continue__sub">{model.detail}</span>
              </span>
              <kbd>Space</kbd>
            </button>
            <button
              class="continue continue--secondary"
              type="button"
              onClick={onOther}
              data-testid="continue-other"
              aria-disabled={model.state === 'busy' ? 'true' : undefined}
              {...tipAttrs(t(model.action.mode === 'watch' ? 'continue.simulateTip' : 'continue.tipWatch'))}
            >
              {model.action.mode !== 'watch' && <Icon name="eye" />}
              <span class="continue__text">
                <span class="continue__main">{t(model.action.mode === 'watch' ? 'continue.simulate' : 'continue.watch')}</span>
                <span class="continue__sub">{t(model.action.mode === 'watch' ? 'continue.resultOnly' : 'continue.watchTheMatch')}</span>
              </span>
              <kbd>Shift Space</kbd>
            </button>
          </div>
        ) : (
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
        )}
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
          standing && standing.played === 0 && ctx.wing
            ? t('topbar.standingUnplayed', { wing: ctx.wing.name, size: ctx.wingRows.length })
            : standing && ctx.wing
              ? t('topbar.standingTip', { pos: ordinal(standing.position), size: ctx.wingRows.length, wing: ctx.wing.name, tournament: tier.tournamentName })
              : t('topbar.standingNone'),
        )}
      >
        <span class="topbar__stat-label">{t('topbar.standing')}</span>
        <span class="topbar__stat-value">
          {/* Before the first match a position is only the draw order: say so instead of "4th". */}
          {standing && standing.played === 0 ? t('topbar.standingNotStarted') : standing ? t('topbar.standingValue', { pos: ordinal(standing.position), pts: standing.points }) : '—'}
        </span>
      </div>
    </div>
  );
}

// ---- Commit dialogs of Continue (Kick off season, Advance to season end, expiring contracts) -------


/** Longest club name the top bar shows whole at the nav width (display face, md). */
const TOPBAR_NAME_MAX = 17;

export type { RouteId };
