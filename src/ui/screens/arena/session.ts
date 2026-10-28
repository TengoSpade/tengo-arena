/**
 * The viewer session of an arena screen: creates the viewer through the factory seam, loads one round, and turns its
 * callbacks into signals the DOM HUD reads (tech-018: HUD, strip, feed and inspector are DOM fed at <= 10 Hz).
 *
 * LIVE DATA ONLY THROUGH THE VIEWER (review B1): for a live round everything the screen shows comes from `onFrame`,
 * `keyMoments()`, `decisionAt()` and `headTick`; `endTick` stays null until reached. This file never touches
 * `playback.log.events`; it passes the log to `viewer.load` and nothing else (the leak test holds it to that).
 */
import { effect, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContentDB } from '../../../core/content';
import type { RoundPlayback } from '../../../core/game';
import type { ArenaFrameState, ArenaRoundContext, DecisionSnapshot, KeyMoment, PlaybackStop, Speed } from '../../../render';
import type { ArenaViewer } from '../../../render/viewer';
import { effectiveTheme, reducedMotion, settings, updateArenaSettings } from '../../store/settings';
import { hookSlot } from './hook-registry';
import { readArenaPalette } from './palette';
import { useViewerFactory } from './viewer-factory';

/** Why playback stopped: a PlaybackStop from the viewer, or one of the player's own reasons. */
export type StopKind = { kind: 'pause' | 'hidden' | 'leave' } | PlaybackStop;

export interface ViewerSnap {
  playing: boolean;
  tick: number;
  /** Live: the furthest tick shown. Replay: the round's last tick. */
  head: number;
  /** Replay: the last tick. Live: null until playback reached it. */
  end: number | null;
  speed: Speed;
}

export interface SessionOptions {
  playback: RoundPlayback;
  ctx: ArenaRoundContext;
  content: ContentDB;
  /** Start playing once loaded (a fresh round, a replay); a resume stays paused at its cursor. */
  autoplay: boolean;
  /** Live only: pause when the window is hidden (setting). */
  pauseWhenHidden: boolean;
  onStopped?: (stop: StopKind, viewer: ArenaViewer) => void;
  onLoaded?: (viewer: ArenaViewer) => void;
  /** Live resume: the automatic pause that left the round at its cursor (resume-cause.ts), shown like a live stop. */
  resumedStop?: PlaybackStop | null;
}

export interface ArenaSession {
  readonly status: ReadonlySignal<'loading' | 'ready' | 'failed'>;
  readonly error: ReadonlySignal<string | null>;
  readonly frame: ReadonlySignal<ArenaFrameState | null>;
  readonly snap: ReadonlySignal<ViewerSnap>;
  readonly moments: ReadonlySignal<readonly KeyMoment[]>;
  readonly selected: ReadonlySignal<number | null>;
  /** The last stop the viewer reported (for the polite announcement). */
  readonly lastStop: ReadonlySignal<StopKind | null>;
  readonly viewer: () => ArenaViewer | null;
  play(): void;
  pause(): void;
  toggle(): void;
  setSpeed(speed: Speed): void;
  cycleSpeed(delta: 1 | -1): void;
  seek(tick: number): void;
  /** One step while paused: a frame (2 ticks) or a second (20), bounded by the head. */
  step(ticks: number): void;
  live(): void;
  select(unit: number | null): void;
  selectNext(delta: 1 | -1): void;
  cycleLabels(): void;
  recentre(): void;
  decisionAt(unit: number): DecisionSnapshot | null;
  decisionsOf(unit: number): readonly DecisionSnapshot[] | null;
  retry(): void;
}

const SPEEDS: readonly Speed[] = [1, 2, 4];
const EMPTY_SNAP: ViewerSnap = { playing: false, tick: 0, head: 0, end: null, speed: 1 };

interface State {
  status: Signal<'loading' | 'ready' | 'failed'>;
  error: Signal<string | null>;
  frame: Signal<ArenaFrameState | null>;
  snap: Signal<ViewerSnap>;
  moments: Signal<readonly KeyMoment[]>;
  selected: Signal<number | null>;
  lastStop: Signal<StopKind | null>;
}

function createState(): State {
  return {
    status: signal('loading'),
    error: signal(null),
    frame: signal(null),
    snap: signal(EMPTY_SNAP),
    moments: signal([]),
    selected: signal(null),
    lastStop: signal(null),
  };
}

export function useViewerSession(hostRef: { current: HTMLElement | null }, opts: SessionOptions): ArenaSession {
  const factory = useViewerFactory();
  const [s] = useState(createState);
  const viewerRef = useRef<ArenaViewer | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [attempt, setAttempt] = useState(0);
  const loadedPlayback = useRef<RoundPlayback | null>(null);

  const sync = (v: ArenaViewer): void => {
    s.snap.value = { playing: v.playing, tick: v.tick, head: v.headTick, end: v.endTick, speed: v.speed };
    const m = v.keyMoments();
    const cur = s.moments.value;
    if (m.length !== cur.length || m[m.length - 1]?.seq !== cur[cur.length - 1]?.seq) s.moments.value = m;
  };

  // The viewer: created once per mount (and per retry); a round is loaded into it, replaced for the next replay round.
  useEffect(() => {
    let disposed = false;
    s.status.value = 'loading';
    s.error.value = null;
    void (async () => {
      let viewer: ArenaViewer | null = null;
      try {
        const o = optsRef.current;
        const arena = settings.value.arena;
        const host = hostRef.current;
        if (!host) throw new Error('no host element');
        // `tabStop: false` (ArenaViewerOptionExtras): the host element below is the one tab stop (role img, focus ring outside
        // the wall), so the viewer's own canvas must not be a second one.
        viewer = await factory({
          tabStop: false,
          host,
          content: o.content,
          palette: readArenaPalette(effectiveTheme(settings.value)),
          reducedMotion: reducedMotion(settings.value),
          hudHz: 10,
          onFrame: (state) => {
            s.frame.value = state;
            const v = viewerRef.current;
            if (v) sync(v);
          },
          onStop: (stop) => {
            s.lastStop.value = stop;
            const v = viewerRef.current;
            if (v) {
              sync(v);
              optsRef.current.onStopped?.(stop, v);
            }
          },
          onSelect: (unit) => {
            s.selected.value = unit;
          },
        });
        if (disposed) {
          viewer.destroy();
          return;
        }
        viewerRef.current = viewer;
        viewer.setAutoPause(arena.autoPause);
        viewer.setLabels(arena.labels);
        viewer.setSpeed(arena.speed);
        await viewer.load(o.playback.log, o.ctx);
        if (disposed) return;
        loadedPlayback.current = o.playback;
        hookSlot.viewer = viewer;
        hookSlot.logHash = o.playback.log.hash;
        hookSlot.log = o.playback.log;
        hookSlot.frame = () => s.frame.peek();
        s.status.value = 'ready';
        sync(viewer);
        // A resume sits paused at its cursor: say why it stopped there, as the live stop did (the cause is not in the save).
        if (o.resumedStop) s.lastStop.value = o.resumedStop;
        o.onLoaded?.(viewer);
        if (o.autoplay) viewer.play();
        sync(viewer);
      } catch (e) {
        if (disposed) return;
        s.status.value = 'failed';
        s.error.value = e instanceof Error ? e.message : String(e);
        viewer?.destroy();
        viewerRef.current = null;
      }
    })();
    return () => {
      disposed = true;
      const v = viewerRef.current;
      viewerRef.current = null;
      if (hookSlot.viewer === v) {
        hookSlot.viewer = null;
        hookSlot.logHash = null;
        hookSlot.log = null;
        hookSlot.frame = null;
      }
      if (v) {
        // Leaving while the round runs is a stop: the cursor must persist (tech-019).
        if (v.playing) {
          v.pause();
          optsRef.current.onStopped?.({ kind: 'leave' }, v);
        }
        v.destroy();
      }
    };
  }, [attempt]);

  // A replay switches round: load it into the same viewer (the live screen remounts per round).
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || s.status.value !== 'ready' || loadedPlayback.current === opts.playback) return;
    let stale = false;
    loadedPlayback.current = opts.playback;
    s.status.value = 'loading';
    void v.load(opts.playback.log, opts.ctx).then(
      () => {
        if (stale || viewerRef.current !== v) return;
        hookSlot.logHash = opts.playback.log.hash;
        hookSlot.log = opts.playback.log;
        s.status.value = 'ready';
        s.selected.value = null;
        sync(v);
        optsRef.current.onLoaded?.(v);
        if (optsRef.current.autoplay) v.play();
        sync(v);
      },
      (e: unknown) => {
        if (stale) return;
        s.status.value = 'failed';
        s.error.value = e instanceof Error ? e.message : String(e);
      },
    );
    return () => {
      stale = true;
    };
  }, [opts.playback]);

  // Settings follow the player: auto-pause rules, names, reduced motion and the theme's palette.
  useEffect(() => {
    let theme = effectiveTheme(settings.value);
    let motion = reducedMotion(settings.value);
    let scale = settings.value.scale;
    // The OS preference (Settings: reduced motion 'system') changing mid-arena applies at once, not at the next mount.
    const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const onOsMotion = (): void => {
      const v = viewerRef.current;
      if (!v) return;
      const nowMotion = reducedMotion(settings.peek());
      v.setReducedMotion(nowMotion);
      if (nowMotion !== motion) {
        motion = nowMotion;
        v.setPalette(readArenaPalette(effectiveTheme(settings.peek())));
      }
    };
    mq?.addEventListener?.('change', onOsMotion);
    const stopSettings = effect(() => {
      const st = settings.value;
      const v = viewerRef.current;
      if (!v) return;
      v.setAutoPause(st.arena.autoPause);
      v.setLabels(st.arena.labels);
      const now = effectiveTheme(st);
      const nowMotion = reducedMotion(st);
      v.setReducedMotion(nowMotion);
      // The palette is read from the CSS tokens once per theme, motion or interface-scale change, never per frame.
      if (now !== theme || nowMotion !== motion || st.scale !== scale) {
        theme = now;
        motion = nowMotion;
        scale = st.scale;
        v.setPalette(readArenaPalette(now));
      }
    });
    return () => {
      stopSettings();
      mq?.removeEventListener?.('change', onOsMotion);
    };
  }, []);

  // A live round pauses when the window is hidden (setting, on by default), which also saves the cursor.
  useEffect(() => {
    if (!opts.pauseWhenHidden || typeof document === 'undefined') return undefined;
    const onVisibility = () => {
      const v = viewerRef.current;
      if (document.hidden && v && v.playing) {
        v.pause();
        sync(v);
        s.lastStop.value = { kind: 'hidden' };
        optsRef.current.onStopped?.({ kind: 'hidden' }, v);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [opts.pauseWhenHidden]);

  const view = (): ArenaViewer | null => (s.status.value === 'ready' ? viewerRef.current : null);
  const api: ArenaSession = {
    status: s.status,
    error: s.error,
    frame: s.frame,
    snap: s.snap,
    moments: s.moments,
    selected: s.selected,
    lastStop: s.lastStop,
    viewer: () => viewerRef.current,
    play() {
      const v = view();
      if (!v || v.playing) return;
      v.play();
      // An earlier stop's cause is over once the round runs again (the round's end stays until the card moves on).
      if (s.lastStop.value?.kind !== 'end') s.lastStop.value = null;
      sync(v);
    },
    pause() {
      const v = view();
      if (!v || !v.playing) return;
      v.pause();
      // A manual pause is its own stop: it must not keep showing (or announcing) the cause of an earlier automatic one.
      s.lastStop.value = { kind: 'pause' };
      sync(v);
      optsRef.current.onStopped?.({ kind: 'pause' }, v);
    },
    toggle() {
      if (s.snap.value.playing) api.pause();
      else api.play();
    },
    setSpeed(speed) {
      const v = view();
      if (!v) return;
      v.setSpeed(speed);
      updateArenaSettings({ speed });
      sync(v);
    },
    cycleSpeed(delta) {
      const i = SPEEDS.indexOf(s.snap.value.speed);
      api.setSpeed(SPEEDS[(i + delta + SPEEDS.length) % SPEEDS.length]!);
    },
    seek(tick) {
      const v = view();
      if (!v) return;
      v.seek(Math.max(0, Math.min(tick, v.headTick)));
      sync(v);
    },
    step(ticks) {
      const v = view();
      if (!v || v.playing) return;
      api.seek(v.tick + ticks);
    },
    live() {
      const v = view();
      if (v) api.seek(v.headTick);
    },
    select(unit) {
      const v = view();
      s.selected.value = unit;
      v?.select(unit);
    },
    selectNext(delta) {
      const ctx = optsRef.current.ctx;
      // Own side first (the player's, else home), then the other side: Tab walks the strip left to right.
      const first = ctx.playerSide === 1 ? 1 : 0;
      const order = [...ctx.units].sort((a, b) => Number(a.side !== first) - Number(b.side !== first) || a.unit - b.unit).map((u) => u.unit);
      const cur = s.selected.value;
      const i = cur === null ? (delta > 0 ? -1 : 0) : order.indexOf(cur);
      api.select(order[(i + delta + order.length) % order.length] ?? null);
    },
    cycleLabels() {
      const v = view();
      const order = ['off', 'selected', 'all'] as const;
      const cur = settings.value.arena.labels;
      const next = order[(order.indexOf(cur) + 1) % order.length]!;
      updateArenaSettings({ labels: next });
      v?.setLabels(next);
    },
    recentre() {
      view()?.setCamera({ follow: null, zoom: 1 });
    },
    decisionAt(unit) {
      return view()?.decisionAt(unit) ?? null;
    },
    decisionsOf(unit) {
      // Oldest first, up to the shown tick and never past the live head (ArenaViewerDecisionHistory).
      return view()?.decisionsUpTo?.(unit) ?? null;
    },
    retry() {
      setAttempt((n) => n + 1);
    },
  };
  return api;
}
