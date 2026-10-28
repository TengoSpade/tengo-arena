/**
 * The playback clock (05-technical-m2 §A5): tick += dtMs × speed ÷ TICK_MS, with a play state, speeds, seeking
 * within bounds, and (live) a head the playback never seeks past. Pure logic: no PixiJS, no DOM, no timers.
 *
 * Live rounds: `head` is the furthest tick shown so far. `seek` stops at the head (no peeking ahead), and the end
 * is unknown (`end` null) until playback has reached it (`markEnd`), so nothing derived from the future is exposed.
 * Replays: `end` is known and `head` equals it.
 */
import type { Speed } from '../types';

/** Milliseconds of fight time per tick (combat.json tick.tickMs). */
export const TICK_MS = 50;
/** A frame after a hidden tab or a stall never advances more than this much wall time (tech-024). */
export const MAX_DT_MS = 100;

export class PlaybackClock {
  readonly kind: 'live' | 'replay';
  private _tick: number;
  private _head: number;
  private _end: number | null;
  private _speed: Speed = 1;
  private _playing = false;

  /**
   * @param startTick where the round is shown first (live: the resume point, which is also the head)
   * @param end the round's last tick for a replay; null for a live round
   */
  constructor(kind: 'live' | 'replay', startTick: number, end: number | null) {
    this.kind = kind;
    this._end = end;
    const bound = end ?? Number.POSITIVE_INFINITY;
    this._tick = clamp(finite(startTick), 0, bound);
    this._head = kind === 'replay' && end !== null ? end : this._tick;
  }

  get tick(): number {
    return this._tick;
  }
  get head(): number {
    return this._head;
  }
  /** The round's last tick, once known (a replay: always; live: after playback reached it). */
  get end(): number | null {
    return this._end;
  }
  get speed(): Speed {
    return this._speed;
  }
  get playing(): boolean {
    return this._playing;
  }
  /** Live only: shown ticks lie ahead of the current tick (the user rewound). */
  get rewound(): boolean {
    return this.kind === 'live' && this._tick < this._head;
  }
  get atEnd(): boolean {
    return this._end !== null && this._tick >= this._end;
  }

  play(): void {
    this._playing = true;
  }
  pause(): void {
    this._playing = false;
  }
  setSpeed(speed: Speed): void {
    this._speed = speed === 2 || speed === 4 ? speed : 1;
  }

  /** The furthest tick a seek may reach: replay the end; live the head. */
  seekLimit(): number {
    return this.kind === 'replay' ? (this._end ?? this._head) : this._head;
  }

  /** Move to `tick` clamped to [0, seekLimit]; returns the tick reached. The play state is unchanged. */
  seek(tick: number): number {
    this._tick = clamp(finite(tick), 0, this.seekLimit());
    return this._tick;
  }

  /**
   * The tick the next frame wants to show after `dtMs` of wall time (not committed): never backwards, and capped
   * at the known end. `dtMs` is clamped to MAX_DT_MS (no jump after a hidden tab).
   */
  plan(dtMs: number): number {
    const dt = clamp(finite(dtMs), 0, MAX_DT_MS);
    const target = this._tick + (dt * this._speed) / TICK_MS;
    return this._end === null ? target : Math.min(target, this._end);
  }

  /** Make `tick` current; a live head only moves forward. */
  commit(tick: number): void {
    this._tick = tick;
    if (tick > this._head) this._head = tick;
  }

  /** Live: the reveal frontier moves forward to `head` (it runs ahead of the drawn tick by up to a frame interval). */
  reveal(head: number): void {
    if (head > this._head) this._head = head;
  }

  /** The round's end was reached (a live sample reported it). */
  markEnd(end: number): void {
    this._end = end;
  }

  /**
   * A live round after a log swap at `atTick` (calls): only the ticks up to it were shown, so the head and the tick move
   * back to it, and an end that was not reached (it lies beyond) is unknown again.
   */
  rebase(atTick: number): void {
    this._head = Math.min(this._head, Math.max(0, atTick));
    this._tick = Math.min(this._tick, this._head);
    if (this._end !== null && this._end > this._head) this._end = null;
  }

  /** Replace the end and head bounds after a log swap (calls). The tick is kept. */
  reset(end: number | null): void {
    this._end = end;
    if (this.kind === 'replay' && end !== null) this._head = end;
  }
}

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}
