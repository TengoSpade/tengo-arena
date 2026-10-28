/**
 * Why a live round was left paused where it was, for the arena that resumes there ("Paused automatically: your fighter
 * went down", the same cause and announcement as the live stop).
 *
 * The save has a cursor tick and nothing about the stop, and the tick alone cannot tell an automatic pause from a manual
 * one a fraction of a tick before the same event: the cursor is the reveal frontier, the CEIL of the head, so a pause at
 * 399.6 saves 400 and a down at tick 400 would look like its cause. So the cause is remembered when the cursor is saved,
 * per device (one record, the latest stop), and recalled only when career, fixture, round and cursor all match. A device
 * without the record (another browser, cleared storage) shows no cause; it never shows a wrong one.
 */
import type { AutoPauseStop, PlaybackStop } from '../../../render';

const KEY = 'arena-league.arena.last-stop';

/** Which saved cursor a stop belongs to. `career` is the career's RNG root (a new career never inherits a stop). */
export interface StopAt {
  career: string;
  fixtureId: string;
  round: number;
  cursor: number;
}

type StopRecord = StopAt & { stop: AutoPauseStop | null };

/** The stop at this cursor: an automatic pause (its cause) or none (a manual pause, a hidden window, leaving). */
export function rememberStop(at: StopAt, stop: AutoPauseStop | null): void {
  try {
    const record: StopRecord = { ...at, stop };
    globalThis.localStorage?.setItem(KEY, JSON.stringify(record));
  } catch {
    // storage unavailable: the resume just shows no cause
  }
}

/** The automatic pause that left this round at this cursor, or null. */
export function recallStop(at: StopAt): PlaybackStop | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Partial<StopRecord> | null;
    if (!r || r.career !== at.career || r.fixtureId !== at.fixtureId || r.round !== at.round || r.cursor !== at.cursor) return null;
    const s = r.stop;
    if (!s || typeof s.tick !== 'number' || typeof s.seq !== 'number' || typeof s.reason !== 'string' || (s.unit !== null && typeof s.unit !== 'number')) return null;
    return { kind: 'auto', stop: { tick: s.tick, seq: s.seq, reason: s.reason, unit: s.unit } };
  } catch {
    return null;
  }
}

/** Forget the record (tests). */
export function forgetStop(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // nothing to forget
  }
}
