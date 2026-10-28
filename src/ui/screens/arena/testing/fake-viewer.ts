/**
 * Test support: a fake `ArenaViewer` behind the factory seam (05-technical-m2 §A11 "UI (happy-dom, WP-M2E)").
 *
 * It wraps a `Timeline` (the fake one, or the real one) over the log it is handed, honours the ArenaViewer contract
 * the screens depend on (a live viewer's end tick is null until reached; its head only moves forward; seeking stops at
 * the head; auto-pause stops are asked for bounded by the tick it advances to), and RECORDS every value it hands out,
 * so the leak test can assert each is at or before the head. Tests drive time with `advanceTo`: the clock a real
 * viewer would run is not the subject here.
 */
import type { ContentDB } from '../../../../core/content';
import type { FightLog } from '../../../../core/model';
import type { ArenaFrameState, ArenaRoundContext, AutoPauseRules, CueTable, DecisionSnapshot, KeyMoment, PlaybackStop, Speed, ViewerStats } from '../../../../render';
import type { PlaybackIndex, Timeline } from '../../../../render';
import type { ArenaViewer, ArenaViewerOptions } from '../../../../render/viewer';
import type { ViewerFactory } from '../viewer-factory';

export interface Handed {
  /** Every key-moment list returned, with the head at that moment. */
  moments: { head: number; moments: readonly KeyMoment[] }[];
  /** Every frame given to onFrame, with the head. */
  frames: { head: number; frame: ArenaFrameState }[];
  /** Every endTick returned (null until reached). */
  ends: (number | null)[];
  /** Every headTick returned. */
  heads: number[];
}

export class FakeViewer implements ArenaViewer {
  readonly options: ArenaViewerOptions;
  readonly handed: Handed = { moments: [], frames: [], ends: [], heads: [] };
  /** A call log for assertions ("play", "pause", "seek:120", "speed:2", "select:3", "labels:all", "load", "destroy"...). */
  readonly calls: string[] = [];
  destroyed = false;
  autoPause: AutoPauseRules;
  private index: PlaybackIndex | null = null;
  private ctx: ArenaRoundContext | null = null;
  private _tick = 0;
  private _head = 0;
  private _playing = false;
  private _speed: Speed = 1;
  private _ended = false;
  private _selected: number | null = null;
  private log: FightLog | null = null;

  constructor(
    options: ArenaViewerOptions,
    private readonly timeline: Timeline,
    private readonly content: ContentDB,
  ) {
    this.options = options;
    this.autoPause = { ownDowned: true, enemyDowned: false, ownCaptainDown: true, overtime: true, ownHpBelowPct: null };
  }

  async load(log: FightLog, ctx: ArenaRoundContext): Promise<void> {
    this.calls.push('load');
    this.log = log;
    this.ctx = ctx;
    this.index = this.timeline.indexFightLog(log, this.content, {} as CueTable, ctx.kind);
    this._tick = ctx.startTick;
    this._head = ctx.kind === 'live' ? ctx.startTick : (this.index.endTick ?? 0);
    this._ended = ctx.kind === 'replay' && this.index.endTick !== null && ctx.startTick >= this.index.endTick;
    this._playing = false;
    this.emitFrame();
  }

  replaceLog(): boolean {
    return false;
  }

  play(): void {
    this.calls.push('play');
    this._playing = true;
  }

  pause(): void {
    this.calls.push('pause');
    this._playing = false;
    this.emitFrame();
  }

  get playing(): boolean {
    return this._playing;
  }

  setSpeed(speed: Speed): void {
    this.calls.push(`speed:${speed}`);
    this._speed = speed;
  }

  get speed(): Speed {
    return this._speed;
  }

  seek(tick: number): void {
    this.calls.push(`seek:${tick}`);
    const max = this.ctx?.kind === 'live' ? this._head : (this.index?.endTick ?? this._head);
    this._tick = Math.max(0, Math.min(tick, max));
    this.emitFrame();
  }

  get tick(): number {
    return this._tick;
  }

  get headTick(): number {
    this.handed.heads.push(this._head);
    return this._head;
  }

  get endTick(): number | null {
    const e = this.ctx?.kind === 'replay' ? (this.index?.endTick ?? null) : this._ended ? this._tick : null;
    this.handed.ends.push(e);
    return e;
  }

  keyMoments(): readonly KeyMoment[] {
    if (!this.index || !this.ctx) return [];
    const m = this.timeline.keyMoments(this.index, this.ctx, this._head);
    this.handed.moments.push({ head: this._head, moments: m });
    return m;
  }

  decisionAt(unit: number): DecisionSnapshot | null {
    return this.index ? this.timeline.decisionAt(this.index, unit, this._tick) : null;
  }

  setAutoPause(rules: AutoPauseRules): void {
    this.calls.push('autopause');
    this.autoPause = rules;
  }

  setCamera(): void {
    this.calls.push('camera');
  }

  setPalette(): void {
    this.calls.push('palette');
  }

  setReducedMotion(): void {
    this.calls.push('motion');
  }

  select(unit: number | null): void {
    this.calls.push(`select:${unit}`);
    this._selected = unit;
    this.options.onSelect?.(unit);
  }

  get selected(): number | null {
    return this._selected;
  }

  setLabels(mode: 'off' | 'selected' | 'all'): void {
    this.calls.push(`labels:${mode}`);
  }

  async snapshot(): Promise<Blob> {
    return new Blob([]);
  }

  stats(): ViewerStats {
    return { fps: 60, frameMsP50: 1, frameMsP95: 2, drawCalls: null, renderer: 'none', resolution: 1 };
  }

  destroy(): void {
    this.calls.push('destroy');
    this.destroyed = true;
    this._playing = false;
  }

  /** The loaded log (for assertions on what the screen handed over). */
  get loadedLog(): FightLog | null {
    return this.log;
  }

  private emitFrame(): void {
    if (!this.index || !this.ctx) return;
    const frame = this.timeline.sampleAt(this.index, this._tick, this.ctx);
    this.handed.frames.push({ head: this._head, frame });
    this.options.onFrame?.(frame);
  }

  /**
   * Play forward to `tick` the way the real clock would: stop at the first auto-pause stop on the way (after drawing
   * its tick), or at the round's end; the live head moves with the shown tick. Needs `play()` first.
   */
  advanceTo(tick: number): void {
    if (!this._playing || !this.index || !this.ctx) return;
    const stops = this.timeline.autoPauseStops(this.index, this.autoPause, this.ctx, tick).filter((s) => s.tick > this._tick);
    const first = stops[0];
    const end = this.index.header && this.log?.events.find((e) => e.type === 'fight.end');
    const endTick = end ? end.tick : Number.POSITIVE_INFINITY;
    let to = tick;
    let stop: PlaybackStop | null = null;
    if (first && first.tick <= to && first.tick <= endTick) {
      to = first.tick;
      stop = { kind: 'auto', stop: first };
    }
    if (endTick <= to && (!first || endTick < first.tick)) {
      to = endTick;
      stop = { kind: 'end', tick: endTick };
    }
    this._tick = to;
    this._head = Math.max(this._head, to);
    if (stop) {
      this._playing = false;
      if (stop.kind === 'end') this._ended = true;
    }
    this.emitFrame();
    if (stop) this.options.onStop?.(stop);
  }
}

export interface FakeViewerHarness {
  factory: ViewerFactory;
  /** The viewer of the screen on show (the last one created). */
  current(): FakeViewer;
  all: FakeViewer[];
}

export function createFakeViewerHarness(timeline: Timeline, content: ContentDB, opts: { failLoad?: boolean } = {}): FakeViewerHarness {
  const all: FakeViewer[] = [];
  return {
    factory: async (options) => {
      if (opts.failLoad) throw new Error('viewer chunk failed');
      const v = new FakeViewer(options, timeline, content);
      all.push(v);
      return v;
    },
    current: () => {
      const v = all[all.length - 1];
      if (!v) throw new Error('no viewer was created');
      return v;
    },
    all,
  };
}
