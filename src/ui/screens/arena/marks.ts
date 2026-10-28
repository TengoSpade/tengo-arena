/**
 * The scrubber's key-moment marks, merged where they would touch: marks of one side (ours sit above the track, theirs
 * below) closer than `minGapPx` on the track are one mark that stands for all of them. Pure; the track's width is the
 * caller's measurement, and an unmeasured track (0) merges nothing.
 */
import type { FeedItem } from './feed';

/** Marks closer than this on the track are one (the designer's 12 px). */
export const MARK_MIN_GAP_PX = 12;

export interface MarkGroup {
  /** The anchor's key (the first moment of the group). */
  key: string;
  /** The anchor's tick: where the mark is drawn and what it stands for in the DOM. */
  tick: number;
  lane: 'us' | 'them';
  /** The most telling moment of the group (a down before the rest) and every moment in it, in time order. */
  lead: FeedItem;
  items: readonly FeedItem[];
}

const lane = (m: FeedItem): 'us' | 'them' => m.mark ?? 'them';

/** `at(tick)` is the mark's place on the track, 0 to 1; `trackPx` the track's width in pixels. */
export function mergeMarks(marks: readonly FeedItem[], at: (tick: number) => number, trackPx: number, minGapPx: number = MARK_MIN_GAP_PX): MarkGroup[] {
  const measured = trackPx > 0;
  const groups: MarkGroup[] = [];
  for (const side of ['us', 'them'] as const) {
    const mine = marks.filter((m) => lane(m) === side).sort((a, b) => a.tick - b.tick);
    let anchorPx = Number.NEGATIVE_INFINITY;
    let current: FeedItem[] = [];
    const flush = (): void => {
      if (current.length === 0) return;
      const first = current[0]!;
      groups.push({ key: first.key, tick: first.tick, lane: side, lead: current.find((m) => m.event === 'down') ?? first, items: current });
      current = [];
    };
    for (const m of mine) {
      const px = at(m.tick) * trackPx;
      if (measured && current.length > 0 && px - anchorPx < minGapPx) current.push(m);
      else {
        flush();
        anchorPx = px;
        current = [m];
      }
    }
    flush();
  }
  return groups.sort((a, b) => a.tick - b.tick);
}
