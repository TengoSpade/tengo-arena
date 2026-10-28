/**
 * The arena screen's layout and keys (05-technical-m2 §A7, §A9, §A18; mockups/arena.html): one full-window screen with
 * no app shell, the HUD above the stage and transport, the right dock (inspector and feed, open at every width), the
 * fighter strip below. Shared by the live round and the replay; what differs (commit, resume, round tabs) is passed in
 * by LiveArena and ReplayArena.
 *
 * THE ARENA OWNS THE KEYBOARD while it is open (A18): the shell's screen shortcuts do not exist here. Space plays or
 * pauses (Shift Space = Simulate the rest, which asks once); 1 2 4 or [ ] set the speed; ← → step a frame and Shift ← →
 * a second while paused; End returns to Live; Enter or I opens the inspector; L cycles the names; D hides or shows the
 * dock (kept per device; the layout never changes on its own); Home recentres; Shift S skips to the end of the round;
 * Esc closes the inspector, then leaves (live: asks once and goes Home with the match still live; replay: back to the
 * report). Tab walks the ten fighter cards in the normal focus order and focus IS selection, so it never traps. F8
 * tickets stay (the App owns that key), and Ctrl S saves while paused.
 */
import type { ReadonlySignal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContentDB } from '../../../core/content';
import type { FightFighterInput } from '../../../core/model';
import type { RoundProbe } from '../../../core/sim';
import type { EngineError, Result } from '../../../core/util';
import type { ArenaRoundContext } from '../../../render';
import { installShortcuts, useShortcuts, type ShortcutMap } from '../../app/shortcuts';
import { Empty } from '../../components';
import { settings, updateArenaSettings } from '../../store/settings';
import './arena.css';
import { ArenaControls } from './Controls';
import { feedItems, nameOfUnit, stopCause, stopText } from './feed';
import { ArenaHud, type HudInfo } from './Hud';
import { inspectorModel } from './inspect';
import { ArenaFeed, ArenaInspector, type ProbeState } from './Panels';
import type { ArenaSession } from './session';
import { ArenaStrip } from './Strip';
import { clock, t } from './text';

export interface ArenaLayoutProps {
  session: ArenaSession;
  hostRef: { current: HTMLElement | null };
  ctx: ArenaRoundContext;
  hud: HudInfo;
  kind: 'live' | 'replay';
  content: ContentDB;
  roleName: (role: string) => string;
  /** The fight input a unit played with (rules for the inspector's sentences). */
  inputOf: (fighterId: string) => FightFighterInput | null;
  /** What he would decide at a tick (core/game inspectPlayback); null when unavailable. */
  probe: (tick: number) => Result<RoundProbe, EngineError> | null;
  /** Live: the tick the cursor was last persisted at (the probe reads state, so it waits for the save). */
  cursorSaved?: ReadonlySignal<number>;
  /** A commit is running. */
  busy: boolean;
  onSkip: () => void;
  onSimulateRest?: () => void;
  /** Esc with nothing left to close: live asks to leave, a replay goes back to the report. */
  onEscape: () => void;
  /** Ctrl S while paused (the cursor has been saved with the pause). */
  onSave?: () => void;
  /** The round-end card, dialogs. */
  overlay?: ComponentChildren;
  /** A replay's round tabs, in the transport's status cell. */
  statusSlot?: ComponentChildren;
  /** Keys of the host screen (replay: Alt 1-5 rounds), merged after the arena's own. */
  extraKeys?: ShortcutMap;
  /** The state of the screen for the stylesheet: 'round-end' while the card shows. */
  roundOver?: boolean;
  onReport?: () => void;
  reportLabel?: { text: string; tip: string };
}

/** Tab order of the strip: the player's side first (else home). */
export function unitOrder(ctx: ArenaRoundContext): number[] {
  const first = ctx.playerSide === 1 ? 1 : 0;
  return [...ctx.units].sort((a, b) => Number(a.side !== first) - Number(b.side !== first) || a.unit - b.unit).map((u) => u.unit);
}

export function ArenaLayout(p: ArenaLayoutProps) {
  const { session, ctx } = p;
  const status = session.status.value;
  const snap = session.snap.value;
  const frame = session.frame.value;
  const selected = session.selected.value;
  const dockOpen = settings.value.arena.dockOpen;
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Keys work as soon as the round is on screen.
  useEffect(() => {
    if (status === 'ready') p.hostRef.current?.focus({ preventScroll: true });
  }, [status]);

  // Selecting a fighter while paused opens the inspector (P-22), and a token click focuses its card (focus is selection).
  useEffect(() => {
    if (selected === null) return;
    if (!session.snap.peek().playing) setInspectorOpen(true);
    const a = document.activeElement;
    if (!a || a === document.body || a === p.hostRef.current) document.querySelector<HTMLElement>(`[data-testid="strip-unit-${selected}"]`)?.focus({ preventScroll: true });
  }, [selected]);

  // ---- the inspector's "what he would decide now" (a probe at the paused tick) ----
  const paused = !snap.playing;
  const tick = Math.floor(snap.tick);
  const saved = p.cursorSaved?.value ?? Number.POSITIVE_INFINITY;
  const [probe, setProbe] = useState<{ state: ProbeState; tick: number; unit: number | null; value: RoundProbe | null }>({ state: 'idle', tick: -1, unit: null, value: null });
  useEffect(() => {
    if (!inspectorOpen || !dockOpen || selected === null || !paused || status !== 'ready') {
      setProbe((c) => (c.state === 'idle' ? c : { state: 'idle', tick: -1, unit: null, value: null }));
      return;
    }
    // A live probe reads the saved cursor: it waits until the pause has been persisted (core refuses a tick past it).
    if (p.kind === 'live' && saved < tick) {
      setProbe({ state: 'loading', tick, unit: selected, value: null });
      return;
    }
    const r = p.probe(tick);
    setProbe(r && r.ok ? { state: 'ready', tick, unit: selected, value: r.value } : { state: 'failed', tick, unit: selected, value: null });
  }, [inspectorOpen, dockOpen, selected, paused, tick, saved, status]);

  const selectedInfo = selected !== null ? ctx.units[selected] : undefined;
  const probeUnit = probe.value && probe.unit === selected ? (probe.value.units.find((u) => u.unit === selected) ?? null) : null;
  const model =
    selected !== null && selectedInfo
      ? inspectorModel({
          content: p.content,
          ctx,
          unit: selected,
          state: frame?.units.find((u) => u.unit === selected) ?? null,
          decision: paused ? session.decisionAt(selected) : null,
          probe: probeUnit,
          probeTick: probe.value ? { tick: probe.value.tick, evaluatedTick: probe.value.evaluatedTick } : null,
          decisions: paused ? session.decisionsOf(selected) : null,
          input: p.inputOf(selectedInfo.fighterId),
        })
      : null;

  // ---- feed, marks, announcements ----
  const items = feedItems(session.moments.value, ctx, p.content);
  const stop = session.lastStop.value;
  const announcement = stop ? (stop.kind === 'hidden' ? t('stopHidden') : stopText(stop, ctx)) : null;
  const downCause = (unit: number): string | null => {
    // The moment whose target is the fallen; its unit is the fighter credited with the down.
    const m = session.moments.value.find((x) => x.kind === 'down' && x.target === unit);
    return m && m.unit !== null ? nameOfUnit(ctx, m.unit) : null;
  };
  const capTicks = Math.round((p.content.combat.overtime.hardCapS * 1000) / p.content.combat.tick.tickMs);

  // ---- keys: the arena installs its own map (the shell's is not mounted here) and a layer for the screen's keys ----
  const k = useRef(p);
  k.current = p;
  const toggleDock = () => updateArenaSettings({ dockOpen: !settings.peek().arena.dockOpen });
  const keys: ShortcutMap = {
    Space: (e) => {
      if (e.shiftKey && k.current.onSimulateRest) k.current.onSimulateRest();
      else session.toggle();
      return true;
    },
    '1': () => session.setSpeed(1),
    '2': () => session.setSpeed(2),
    '4': () => session.setSpeed(4),
    '[': () => session.cycleSpeed(-1),
    ']': () => session.cycleSpeed(1),
    ArrowLeft: (e) => {
      if (session.snap.value.playing) return false;
      session.step(e.shiftKey ? -20 : -2);
      return true;
    },
    ArrowRight: (e) => {
      if (session.snap.value.playing) return false;
      session.step(e.shiftKey ? 20 : 2);
      return true;
    },
    Enter: () => {
      if (session.selected.value === null) session.select(unitOrder(ctx)[0] ?? null);
      setInspectorOpen(true);
      return true;
    },
    i: () => setInspectorOpen((o) => !o),
    l: () => session.cycleLabels(),
    d: () => toggleDock(),
    Home: () => session.recentre(),
    End: () => {
      if (k.current.kind !== 'live') return false;
      session.live();
      return true;
    },
    s: (e) => {
      if (!e.shiftKey || k.current.kind !== 'live') return false;
      k.current.onSkip();
      return true;
    },
    Escape: () => {
      if (inspectorOpen && dockOpen) setInspectorOpen(false);
      else k.current.onEscape();
      return true;
    },
    ...p.extraKeys,
  };
  useShortcuts(keys);
  useEffect(
    () =>
      installShortcuts(() => ({
        // Ctrl S while paused (the pause has already saved the cursor); while the round runs the key is swallowed, not the browser's.
        'ctrl+s': () => {
          if (!session.snap.peek().playing) k.current.onSave?.();
          return true;
        },
      })),
    [],
  );

  const ariaLabel = (() => {
    if (status !== 'ready' || !frame) return t('canvasLabel');
    if (snap.playing) return t('canvasPlaying');
    const base = { time: clock(frame.fightSeconds), home: ctx.sides[0].name, a: frame.standing.home, away: ctx.sides[1].name, b: frame.standing.away };
    const st = selected !== null ? frame.units.find((u) => u.unit === selected) : undefined;
    return st && selectedInfo ? t('canvasPausedSel', { ...base, name: selectedInfo.name, hp: st.hp, max: st.maxHp }) : t('canvasPaused', base);
  })();

  const screenState = p.kind === 'replay' ? 'replay' : p.roundOver ? 'round-end' : paused ? 'paused' : 'live';
  const statusNote = stop && stop.kind === 'auto' ? stopCause(stop, ctx) : null;
  return (
    <section class="arena-screen" data-state={screenState} data-testid={p.kind === 'live' ? 'screen-arena' : 'screen-replay'} data-kind={p.kind} data-status={status}>
      <h1 class="u-sr-only">{`${t('title')} · ${t('hudRound', { n: p.hud.round, max: p.hud.bestOf })}`}</h1>
      <ArenaHud
        info={p.hud}
        frame={session.frame}
        snap={session.snap}
        overtime={{ startS: p.content.combat.overtime.startS, capS: p.content.combat.overtime.hardCapS }}
        onToggle={() => session.toggle()}
        onSpeed={(s) => session.setSpeed(s)}
        onReport={p.onReport}
        reportLabel={p.reportLabel}
        onLeave={p.kind === 'live' ? p.onEscape : undefined}
      />
      <div class="arena-body" data-dock={dockOpen ? 'open' : 'closed'}>
        <div class="arena-main">
          <section class="arena-stage" aria-label={t('title')}>
            <div ref={p.hostRef as { current: HTMLDivElement | null }} class="arena-host" tabIndex={0} role="img" aria-label={ariaLabel} data-testid="arena-host" />
            {status === 'loading' && (
              <div class="arena-note" role="status" aria-busy="true" data-testid="arena-loading">
                {t('loading')}
              </div>
            )}
            {status === 'failed' && (
              <div class="arena-note arena-note--failed" data-testid="arena-failed">
                <Empty
                  icon="warning"
                  title={t('loadFailed')}
                  text={`${t('loadFailedText')} ${session.error.value ?? ''}`.trim()}
                  actions={
                    <button class="btn btn--primary" type="button" onClick={() => session.retry()} data-testid="arena-retry">
                      {t('retry')}
                    </button>
                  }
                />
              </div>
            )}
            {p.overlay}
          </section>
          <ArenaControls
            session={session}
            kind={p.kind}
            capTicks={capTicks}
            marks={items}
            statusNote={statusNote}
            statusSlot={p.statusSlot}
            dockOpen={dockOpen}
            onToggleDock={toggleDock}
            onSkip={p.onSkip}
            onSimulateRest={p.onSimulateRest}
            busy={p.busy}
          />
        </div>
        {dockOpen && (
          <aside class="arena-dock" aria-label={t('dockAria')} data-testid="arena-dock">
            {inspectorOpen && (
              <ArenaInspector content={p.content} model={model} paused={paused} probe={probe.state} hasSelection={selected !== null} onClose={() => setInspectorOpen(false)} roleName={p.roleName} />
            )}
            <ArenaFeed items={items} kind={p.kind} playheadTick={snap.tick} onJump={(at) => session.seek(at)} />
          </aside>
        )}
      </div>
      {/* The polite announcement of an automatic pause or a hidden window: the feed announces the moments themselves. */}
      <div class="u-sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="arena-announce">
        {announcement ?? ''}
      </div>
      <ArenaStrip
        ctx={ctx}
        hud={p.hud}
        frame={session.frame}
        selected={session.selected}
        downCause={downCause}
        onSelect={(u) => {
          if (session.selected.peek() !== u) session.select(u);
        }}
        onToggle={() => session.toggle()}
        onInspect={() => setInspectorOpen(true)}
        onSimulate={p.onSimulateRest}
        roleName={p.roleName}
      />
      <p class="u-sr-only" data-testid="arena-keys">
        {t(p.kind === 'live' ? 'keys' : 'keysReplay')}
      </p>
    </section>
  );
}
