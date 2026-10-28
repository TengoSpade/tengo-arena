/**
 * The arena screen's layout and keys (05-technical-m2 §A7, A9): the canvas host under a DOM HUD, the feed and the
 * inspector at the side, the transport row and the fighter strip at the bottom. Shared by the live round and the
 * replay; what differs (commit, resume, round tabs) is passed in by LiveArena and ReplayArena.
 *
 * Keyboard (04 §9, every action by keyboard): Space plays or pauses; 1 2 4 or [ ] set the speed; ← → step a frame
 * and Shift ← → a second while paused; Tab and Shift Tab walk the ten fighters (the first and last Tab leave the
 * canvas for the controls, so a keyboard player is never trapped); Enter or I opens the inspector; L cycles the
 * names; Home recentres; End returns to the live moment; Shift S skips to the end of the round; Esc closes the
 * inspector, then goes back.
 */
import type { ReadonlySignal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContentDB } from '../../../core/content';
import type { EngineError, Result } from '../../../core/util';
import type { RoundProbe } from '../../../core/sim';
import type { ArenaRoundContext } from '../../../render';
import { useShortcuts, type ShortcutMap } from '../../app/shortcuts';
import { Empty } from '../../components';
import { settings } from '../../store/settings';
import type { FightFighterInput } from '../../../core/model';
import './arena.css';
import { ArenaControls } from './Controls';
import { feedItems, stopText } from './feed';
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
  /** The round-end overlay, the "resumed" note, dialogs. */
  overlay?: ComponentChildren;
  /** Above the transport row (the replay's round tabs). */
  aboveControls?: ComponentChildren;
  /** Keys of the host screen (replay: Alt 1–5 rounds), merged after the arena's own. */
  extraKeys?: ShortcutMap;
  keysHint?: string;
}

/** Tab order of the strip: the player's side first (else home), left to right. */
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
  const labels = settings.value.arena.labels;
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const hudRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // The canvas fills the stage; the HUD and the bottom stack overlay it, so the arena is framed inside their measured height.
  useEffect(() => {
    if (status !== 'ready') return undefined;
    const apply = () => session.setPadding(hudRef.current?.offsetHeight || 56, bottomRef.current?.offsetHeight || 72);
    apply();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(apply);
    if (hudRef.current) ro.observe(hudRef.current);
    if (bottomRef.current) ro.observe(bottomRef.current);
    return () => ro.disconnect();
  }, [status]);

  // Keys work as soon as the round is on screen.
  useEffect(() => {
    if (status === 'ready') p.hostRef.current?.focus({ preventScroll: true });
  }, [status]);

  // Selecting a fighter while paused opens the inspector (P-22).
  useEffect(() => {
    if (selected !== null && !session.snap.value.playing) setInspectorOpen(true);
  }, [selected]);

  // ---- the inspector's "what he would decide now" (a probe at the paused tick) ----
  const paused = !snap.playing;
  const tick = Math.floor(snap.tick);
  const saved = p.cursorSaved?.value ?? Number.POSITIVE_INFINITY;
  const [probe, setProbe] = useState<{ state: ProbeState; tick: number; unit: number | null; value: RoundProbe | null }>({ state: 'idle', tick: -1, unit: null, value: null });
  useEffect(() => {
    if (!inspectorOpen || selected === null || !paused || status !== 'ready') {
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
  }, [inspectorOpen, selected, paused, tick, saved, status]);

  const selectedInfo = selected !== null ? ctx.units[selected] : undefined;
  const model =
    selected !== null && selectedInfo
      ? inspectorModel({
          content: p.content,
          ctx,
          unit: selected,
          state: frame?.units.find((u) => u.unit === selected) ?? null,
          decision: paused ? session.decisionAt(selected) : null,
          probe: probe.value && probe.unit === selected ? (probe.value.units.find((u) => u.unit === selected) ?? null) : null,
          decisions: paused ? session.decisionsOf(selected) : null,
          input: p.inputOf(selectedInfo.fighterId),
        })
      : null;

  // ---- feed and announcements ----
  const items = feedItems(session.moments.value, ctx, p.content);
  const stop = session.lastStop.value;
  const announcement = stop ? (stop.kind === 'hidden' ? t('stopHidden') : stopText(stop, ctx)) : null;

  // ---- keys ----
  const k = useRef(p);
  k.current = p;
  const order = unitOrder(ctx);
  const keys: ShortcutMap = {
    Space: () => {
      session.toggle();
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
    Tab: (e) => {
      // Only on the canvas: elsewhere Tab keeps its normal job. The ends release focus to the controls.
      const target = e.target as HTMLElement | null;
      if (target !== p.hostRef.current && target !== document.body) return false;
      const cur = session.selected.value;
      const i = cur === null ? -1 : order.indexOf(cur);
      if (!e.shiftKey) {
        if (i === order.length - 1) return false;
        session.select(order[i + 1] ?? null);
      } else {
        if (i <= 0) return false;
        session.select(order[i - 1] ?? null);
      }
      return true;
    },
    Enter: () => {
      if (session.selected.value === null) session.select(order[0] ?? null);
      setInspectorOpen(true);
      return true;
    },
    i: () => setInspectorOpen((o) => !o),
    l: () => session.cycleLabels(),
    Home: () => session.recentre(),
    End: () => {
      if (k.current.kind !== 'live') return false;
      session.live();
      return true;
    },
    s: (e) => {
      if (!e.shiftKey) return false;
      k.current.onSkip();
      return true;
    },
    Escape: () => {
      if (!inspectorOpen) return false;
      setInspectorOpen(false);
      return true;
    },
    ...p.extraKeys,
  };
  useShortcuts(keys);

  const ariaLabel = (() => {
    if (status !== 'ready' || !frame) return t('canvasLabel');
    if (snap.playing) return t('canvasPlaying');
    const base = { time: clock(frame.fightSeconds), home: ctx.sides[0].name, a: frame.standing.home, away: ctx.sides[1].name, b: frame.standing.away };
    const st = selected !== null ? frame.units.find((u) => u.unit === selected) : undefined;
    return st && selectedInfo ? t('canvasPausedSel', { ...base, name: selectedInfo.name, hp: st.hp, max: st.maxHp }) : t('canvasPaused', base);
  })();

  return (
    <section class="arena" data-testid={p.kind === 'live' ? 'screen-arena' : 'screen-replay'} data-kind={p.kind} data-status={status}>
      <h1 class="u-sr-only">{`${t('title')} · ${t('hudRound', { n: p.hud.round, max: p.hud.bestOf })}`}</h1>
      <div class="arena__stage">
        <div ref={p.hostRef as { current: HTMLDivElement | null }} class="arena__host" tabIndex={0} role="img" aria-label={ariaLabel} data-testid="arena-host" />
        {status === 'loading' && (
          <div class="arena__loading" role="status" aria-busy="true" data-testid="arena-loading">
            {t('loading')}
          </div>
        )}
        {status === 'failed' && (
          <div class="arena__failed" data-testid="arena-failed">
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
      </div>
      <div ref={hudRef} class="arena__top">
        <ArenaHud info={p.hud} frame={session.frame} snap={session.snap} onToggle={() => session.toggle()} onSpeed={(s) => session.setSpeed(s)} />
      </div>
      <div class="arena__side">
        {inspectorOpen && (
          <ArenaInspector model={model} paused={paused} probe={probe.state} hasSelection={selected !== null} onClose={() => setInspectorOpen(false)} />
        )}
        <ArenaFeed items={items} announcement={announcement} onJump={(tickAt) => session.seek(Math.max(0, tickAt - 40))} />
      </div>
      <div ref={bottomRef} class="arena__bottom">
        {p.aboveControls}
        <ArenaControls
          session={session}
          kind={p.kind}
          marks={session.moments}
          inspectorOpen={inspectorOpen}
          labels={labels}
          onToggleInspector={() => setInspectorOpen((o) => !o)}
          onSkip={p.onSkip}
          onSimulateRest={p.onSimulateRest}
          busy={p.busy}
        />
        <ArenaStrip ctx={ctx} frame={session.frame} selected={session.selected} onSelect={(u) => session.select(session.selected.value === u ? null : u)} roleName={p.roleName} />
        <p class="arena__keys u-xs u-faint">{p.keysHint ?? t(p.kind === 'live' ? 'keys' : 'keysReplay')}</p>
      </div>
      {p.overlay}
    </section>
  );
}
