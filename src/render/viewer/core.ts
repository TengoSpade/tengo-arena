/**
 * The viewer's logic without PixiJS: the playback clock, the round's index, auto-pause stops, bounded queries,
 * log swaps, the HUD feed and selection. It drives a `ScenePort` (the real one is `ArenaScene`) and an injectable
 * `Timeline`, so everything here is tested in happy-dom with a fake timeline and a recording scene, no GPU.
 *
 * Rules it keeps (05-technical-m2 §A5, review B1):
 * - It never simulates, never draws randomness, never writes game state.
 * - A live round never seeks past `headTick`; its end is unknown (`endTick` null) until playback reaches it;
 *   key moments and auto-pause stops are only ever asked for up to the tick being shown.
 * - A frame state is a pure function of (log, tick): seeking and playing give the same picture.
 */
import type { ContentDB } from '../../core/content';
import type { FightLog, UnitIndex } from '../../core/model';
import type { PlaybackIndex, Timeline } from '../timeline';
import type { ArenaFrameState, ArenaRoundContext, ArenaUnitInfo, AutoPauseRules, AutoPauseStop, CueTable, DecisionSnapshot, KeyMoment, PlaybackStop, Speed } from '../types';
import { MAX_DT_MS, PlaybackClock } from './clock';
import type { FrameInfo, KickoffInfo } from './scene/arena-scene';

/** The scene as the core sees it. `ArenaScene` implements it. */
export interface ScenePort {
  setRound(ctx: ArenaRoundContext, arena: { width: number; height: number }, kickoff: KickoffInfo | null): void;
  clearRound(): void;
  draw(state: ArenaFrameState, frame: FrameInfo): void;
  select(unit: UnitIndex | null): void;
  setLabels(mode: 'off' | 'selected' | 'all'): void;
  setReducedMotion(on: boolean): void;
  hitTest(px: number, py: number): UnitIndex | null;
}

export interface CoreOptions {
  content: ContentDB;
  cues: CueTable;
  timeline: Timeline;
  scene: ScenePort;
  /** The skin's prepare(units): awaited by load so the first frame never waits on a texture. */
  prepare(units: readonly ArenaUnitInfo[]): Promise<void>;
  /** Monotonic wall time, ms. */
  now(): number;
  /** A frame is wanted (draw once, or keep the ticker running). */
  wake(): void;
  reducedMotion: boolean;
  autoPause: AutoPauseRules;
  onFrame?: (state: ArenaFrameState) => void;
  hudHz: number;
  onStop?: (stop: PlaybackStop) => void;
  onSelect?: (unit: UnitIndex | null) => void;
}

/** The auto-pause stops of a round, computed up to the tick being shown and cached. */
class StopPlan {
  private list: readonly AutoPauseStop[] = [];
  private until = Number.NEGATIVE_INFINITY;

  reset(): void {
    this.list = [];
    this.until = Number.NEGATIVE_INFINITY;
  }

  ensure(until: number, compute: (until: number) => readonly AutoPauseStop[]): void {
    if (until <= this.until) return;
    this.list = compute(until);
    this.until = until;
  }

  /** The first stop with from < tick <= to (a stop at the tick playback resumes from does not fire). */
  firstIn(from: number, to: number): AutoPauseStop | null {
    for (const stop of this.list) if (stop.tick > from && stop.tick <= to) return stop;
    return null;
  }
}

export class ViewerCore {
  private ctx: ArenaRoundContext | null = null;
  private index: PlaybackIndex | null = null;
  private clock: PlaybackClock | null = null;
  private readonly stops = new StopPlan();
  private autoPause: AutoPauseRules;
  private reducedMotion: boolean;
  private speedSetting: Speed = 1;
  private selected: UnitIndex | null = null;
  private lastState: ArenaFrameState | null = null;
  private lastHudMs = Number.NEGATIVE_INFINITY;
  private loadGen = 0;
  private destroyed = false;
  private moments: { index: PlaybackIndex; head: number; value: readonly KeyMoment[] } | null = null;
  private needsDraw = false;
  private labels: 'off' | 'selected' | 'all' = 'off';

  constructor(private readonly o: CoreOptions) {
    this.autoPause = o.autoPause;
    this.reducedMotion = o.reducedMotion;
  }

  // ---- state the UI reads ----------------------------------------------------------------------------------------

  get loaded(): boolean {
    return this.clock !== null;
  }
  get playing(): boolean {
    return this.clock?.playing ?? false;
  }
  get speed(): Speed {
    return this.clock?.speed ?? this.speedSetting;
  }
  get tick(): number {
    return this.clock?.tick ?? 0;
  }
  get headTick(): number {
    return this.clock?.head ?? 0;
  }
  get endTick(): number | null {
    return this.clock?.end ?? null;
  }
  get selection(): UnitIndex | null {
    return this.selected;
  }
  get currentState(): ArenaFrameState | null {
    return this.lastState;
  }
  get context(): ArenaRoundContext | null {
    return this.ctx;
  }

  // ---- loading ---------------------------------------------------------------------------------------------------

  /**
   * Show a round, paused at ctx.startTick. The previous round's visuals are freed first; `skin.prepare` finishes
   * before the first frame; a newer `load` (or `destroy`) that overtakes this one wins and this one resolves quietly.
   */
  async load(log: FightLog, ctx: ArenaRoundContext): Promise<void> {
    if (this.destroyed) return;
    const gen = ++this.loadGen;
    this.unloadRound();
    const index = this.o.timeline.indexFightLog(log, this.o.content, this.o.cues, ctx.kind);
    await this.o.prepare(ctx.units);
    if (this.destroyed || gen !== this.loadGen) return;

    this.ctx = ctx;
    this.index = index;
    // A live round has no end until playback reaches it, whatever the index says (no future leak).
    const clock = new PlaybackClock(ctx.kind, ctx.startTick, ctx.kind === 'live' ? null : index.endTick);
    clock.setSpeed(this.speedSetting);
    this.clock = clock;
    this.stops.reset();
    this.moments = null;
    this.selected = null;
    this.o.scene.select(null);
    this.o.scene.setLabels(this.labels);
    this.o.scene.setReducedMotion(this.reducedMotion);
    this.o.scene.setRound(ctx, index.header.arena, this.kickoffOf(index, ctx));
    this.redraw();
    this.emitFrame(true);
  }

  private unloadRound(): void {
    this.clock?.pause();
    this.o.scene.clearRound();
    this.ctx = null;
    this.index = null;
    this.clock = null;
    this.lastState = null;
    this.moments = null;
    this.selected = null;
    this.stops.reset();
  }

  private kickoffOf(index: PlaybackIndex, ctx: ArenaRoundContext): KickoffInfo | null {
    try {
      const s0 = this.o.timeline.sampleAt(index, 0, ctx, ctx.kind === 'live' ? { reducedMotion: true, knownUntilTick: Math.max(0, ctx.startTick) } : { reducedMotion: true });
      const rows = new Map(index.header.units.map((u) => [u.index, u.row]));
      return { units: s0.units.map((u) => ({ unit: u.unit, side: u.side, row: rows.get(u.unit) ?? 'front', x: u.x })) };
    } catch {
      return null;
    }
  }

  /**
   * Calls: swap in the round re-simulated with a new call, at the current tick. Refused (false) unless every event
   * up to `atTick` is identical, and never for a tick beyond the head. A live round then counts only the ticks up to
   * `atTick` as shown (its head, and the tick, move back to it): the new log's later ticks were never shown, so they
   * cannot be sought, and a known end is forgotten unless it was reached.
   */
  replaceLog(log: FightLog, atTick: number): boolean {
    const { ctx, index, clock } = this;
    if (this.destroyed || !ctx || !index || !clock) return false;
    if (!Number.isFinite(atTick) || atTick > clock.head + 1e-9) return false;
    let next: PlaybackIndex;
    try {
      next = this.o.timeline.indexFightLog(log, this.o.content, this.o.cues, ctx.kind);
      if (!this.o.timeline.samePrefix(index, next, atTick)) return false;
    } catch {
      return false;
    }
    this.index = next;
    this.stops.reset();
    this.moments = null;
    if (ctx.kind === 'replay') clock.reset(next.endTick);
    else clock.rebase(atTick);
    this.redraw();
    this.emitFrame(true);
    return true;
  }

  // ---- transport -------------------------------------------------------------------------------------------------

  play(): void {
    const clock = this.clock;
    if (this.destroyed || !clock || clock.playing) return;
    clock.play();
    this.o.wake();
  }

  pause(): void {
    const clock = this.clock;
    if (this.destroyed || !clock) return;
    clock.pause();
    this.redraw();
    this.emitFrame(true);
  }

  setSpeed(speed: Speed): void {
    this.speedSetting = speed === 2 || speed === 4 ? speed : 1;
    this.clock?.setSpeed(this.speedSetting);
  }

  seek(tick: number): void {
    const clock = this.clock;
    if (this.destroyed || !clock) return;
    clock.seek(tick);
    this.redraw();
    this.emitFrame(true);
  }

  // ---- queries (bounded by the head) -----------------------------------------------------------------------------

  keyMoments(): readonly KeyMoment[] {
    const { ctx, index, clock } = this;
    if (!ctx || !index || !clock) return [];
    const head = clock.head;
    if (this.moments && this.moments.index === index && this.moments.head === head) return this.moments.value;
    const value = this.o.timeline.keyMoments(index, ctx, head);
    this.moments = { index, head, value };
    return value;
  }

  decisionAt(unit: UnitIndex): DecisionSnapshot | null {
    const { index, clock } = this;
    if (!index || !clock) return null;
    return this.o.timeline.decisionAt(index, unit, clock.tick);
  }

  // ---- settings --------------------------------------------------------------------------------------------------

  /**
   * The unit's committed decisions from round start, oldest first, up to and including `tick` (default: the current
   * tick), never past the head: a live round reveals nothing beyond what has been shown (§A19). Each entry is what
   * `decisionAt` returns, so counting by `rule` gives the fires so far (inspector "rules fired so far").
   */
  decisionsUpTo(unit: UnitIndex, tick?: number): readonly DecisionSnapshot[] {
    const { index, clock } = this;
    if (!index || !clock) return [];
    let at = Math.min(tick ?? clock.tick, clock.head);
    const out: DecisionSnapshot[] = [];
    // Walk back: the latest decision committed at or before `at`, then the latest before that one's commit tick.
    for (let guard = 0; guard < 10_000 && Number.isFinite(at) && at >= 0; guard++) {
      const d = this.o.timeline.decisionAt(index, unit, at);
      if (!d) break;
      out.push(d);
      at = d.commitTick - 1e-6; // strictly decreasing: the next older decision
    }
    return out.reverse();
  }

  setAutoPause(rules: AutoPauseRules): void {
    this.autoPause = rules;
    this.stops.reset();
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
    this.o.scene.setReducedMotion(on);
    this.redraw();
  }

  setLabels(mode: 'off' | 'selected' | 'all'): void {
    this.labels = mode;
    this.o.scene.setLabels(mode);
    this.redraw();
  }

  select(unit: UnitIndex | null): void {
    this.selected = unit;
    this.o.scene.select(unit);
    this.redraw();
  }

  /** The unit under a canvas point (pointer hover), or null. */
  hit(px: number, py: number): UnitIndex | null {
    return this.clock ? this.o.scene.hitTest(px, py) : null;
  }

  /** A click on the canvas: select the token under it, or clear the selection on empty floor. */
  pointerSelect(px: number, py: number): void {
    if (!this.clock) return;
    const unit = this.o.scene.hitTest(px, py);
    if (unit === this.selected) return;
    this.applyUserSelection(unit);
  }

  private applyUserSelection(unit: UnitIndex | null): void {
    this.selected = unit;
    this.o.scene.select(unit);
    this.redraw();
    this.o.onSelect?.(unit);
  }

  /** A short text for the canvas's aria-label, refreshed at each pause, seek and stop. */
  describe(): string {
    const ctx = this.ctx;
    const s = this.lastState;
    if (!ctx || !s) return 'Arena';
    const [home, away] = ctx.sides;
    const seconds = Math.max(0, s.fightSeconds).toFixed(1);
    const standing = `${home.shortName} ${s.standing.home} standing, ${away.shortName} ${s.standing.away} standing`;
    return `Arena, round ${ctx.round}, ${seconds} seconds${s.overtime ? ', overtime' : ''}. ${standing}.`;
  }

  // ---- frames ----------------------------------------------------------------------------------------------------

  /**
   * One display frame. Returns true while the ticker should keep running (playing); false lets it stop after the
   * render that follows. `dtMs` is the ticker's wall delta (clamped by the clock).
   */
  frame(dtMs: number): boolean {
    const clock = this.clock;
    const index = this.index;
    const ctx = this.ctx;
    if (this.destroyed || !clock || !index || !ctx) return false;
    if (!clock.playing) {
      if (this.needsDraw) this.redraw();
      return false;
    }

    const now = this.o.now();
    const from = clock.tick;
    let target = clock.plan(dtMs);
    let stop: PlaybackStop | null = null;

    if (clock.atEnd) {
      // play() at the end of the round: stop again at once (the UI decides what an end means).
      stop = { kind: 'end', tick: clock.tick };
      target = clock.tick;
    } else {
      // Auto-pause stops are only asked for up to the tick about to be shown (a live round never looks ahead).
      // Stops sit on whole ticks, so the model is asked once per tick reached (not once per frame), never beyond the frame.
      const until = clock.kind === 'replay' && clock.end !== null ? clock.end : Math.floor(target);
      this.stops.ensure(until, (u) => this.o.timeline.autoPauseStops(index, this.autoPause, ctx, u));
      const hit = this.stops.firstIn(from, target);
      if (hit) {
        target = hit.tick;
        stop = { kind: 'auto', stop: hit };
      } else if (clock.rewound && target >= clock.head) {
        // Live, after a rewind: playback caught up with what was already shown.
        target = clock.head;
        stop = { kind: 'head', tick: target };
      }
    }

    let state = this.sample(index, ctx, target);
    if (state.ended && state.endTick !== null) {
      clock.markEnd(state.endTick);
      if (state.endTick <= target) {
        target = state.endTick;
        if (!stop || stop.kind === 'head') stop = { kind: 'end', tick: target };
        if (target !== state.tick) state = this.sample(index, ctx, target);
      }
    }
    clock.commit(target);
    this.present(state, target, now, dtMs, true);

    if (stop) {
      clock.pause();
      this.emitFrame(true);
      this.o.onStop?.(stop);
      // The callback may have called play() (or destroy()): the ticker follows the clock, not the stop.
      return !this.destroyed && (this.clock?.playing ?? false);
    }
    this.emitFrame(false);
    return true;
  }

  /**
   * Sample the model. A LIVE round passes `knownUntilTick` = the head (the furthest tick shown, or the tick this very
   * frame is about to show), so interpolated positions, effect anchors and projectile starts never use a frame past
   * it (§A19). A replay passes none.
   */
  private sample(index: PlaybackIndex, ctx: ArenaRoundContext, tick: number): ArenaFrameState {
    if (ctx.kind === 'live') {
      const head = Math.max(this.clock?.head ?? 0, tick);
      return this.o.timeline.sampleAt(index, tick, ctx, { reducedMotion: this.reducedMotion, knownUntilTick: head });
    }
    return this.o.timeline.sampleAt(index, tick, ctx, { reducedMotion: this.reducedMotion });
  }

  /** Draw the clock's current tick once, paused (seek, a setting changed, a log swap). */
  private redraw(): void {
    const { clock, index, ctx } = this;
    this.needsDraw = false;
    if (!clock || !index || !ctx) return;
    const state = this.sample(index, ctx, clock.tick);
    this.present(state, clock.tick, this.o.now(), 0, clock.playing);
    this.o.wake();
  }

  private present(state: ArenaFrameState, tick: number, now: number, dtMs: number, playing: boolean): void {
    this.lastState = state;
    this.o.scene.draw(state, { tick, dtMs: playing ? Math.min(Math.max(dtMs, 0), MAX_DT_MS) : 0, speed: this.speed, playing, nowMs: now });
  }

  /** The HUD feed: throttled to hudHz while playing, immediate at every pause, seek and stop. */
  private emitFrame(force: boolean): void {
    const state = this.lastState;
    if (!state || !this.o.onFrame) return;
    const now = this.o.now();
    const interval = 1000 / Math.max(1, this.o.hudHz);
    if (!force && now - this.lastHudMs < interval) return;
    this.lastHudMs = now;
    this.o.onFrame(state);
  }

  /** Draw the current tick now, synchronously (a resize just cleared the canvas). */
  refresh(): void {
    this.redraw();
  }

  invalidate(): void {
    this.needsDraw = true;
    this.o.wake();
  }

  /** Free everything: no callbacks after this. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loadGen++;
    this.clock?.pause();
    this.o.scene.clearRound();
    this.ctx = null;
    this.index = null;
    this.clock = null;
    this.lastState = null;
    this.moments = null;
  }
}
