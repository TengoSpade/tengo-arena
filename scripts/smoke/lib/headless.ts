/**
 * The headless reference for a viewed round (vis-009): the same GameState the page holds, played back in Node by
 * core/game, which is the function headless play and the commit use. Reads only.
 */
import type { ContentDB } from '../../../src/core/content';
import { liveRoundPlayback, roundPlayback } from '../../../src/core/game';
import { hashEventStream, type GameState } from '../../../src/core/model';
import { NotImplementedError } from '../../../src/core/util';

export interface HeadlessRound {
  /** The log hash core/game gives for the round, or null when it could not be produced. */
  hash: string | null;
  /** hashEventStream recomputed over the log (what the viewer recomputes). */
  recomputed: string | null;
  /** Which core/game function made it. */
  source: string;
  /** Why there is no hash, when there is none. `stub` = core/game's playback functions are not implemented yet (WP-M2B). */
  problem: { kind: 'stub' | 'no-round' | 'error'; message: string } | null;
}

export function headlessRoundHash(state: GameState, content: ContentDB, hint?: { fixtureId?: string; round?: number }): HeadlessRound {
  const watching = state.liveMatch?.watch?.round;
  try {
    if (hint?.fixtureId && hint.round !== undefined) {
      const r = roundPlayback(state, hint.fixtureId as never, hint.round, content);
      if (!r.ok) return { hash: null, recomputed: null, source: 'roundPlayback', problem: { kind: 'error', message: `${r.error.code}: ${r.error.message}` } };
      return { hash: r.value.log.hash, recomputed: hashEventStream(r.value.log.header, r.value.log.events), source: 'roundPlayback', problem: null };
    }
    if (watching !== undefined && watching !== null) {
      const r = liveRoundPlayback(state, content);
      if (!r.ok) return { hash: null, recomputed: null, source: 'liveRoundPlayback', problem: { kind: 'error', message: `${r.error.code}: ${r.error.message}` } };
      return { hash: r.value.log.hash, recomputed: hashEventStream(r.value.log.header, r.value.log.events), source: 'liveRoundPlayback', problem: null };
    }
    return { hash: null, recomputed: null, source: 'none', problem: { kind: 'no-round', message: 'The page state has no watched round (liveMatch.watch.round) and the fixture round did not name a fixture.' } };
  } catch (e) {
    if (e instanceof NotImplementedError) return { hash: null, recomputed: null, source: 'core/game', problem: { kind: 'stub', message: `${e.message} (WP-M2B delivers the playback functions)` } };
    return { hash: null, recomputed: null, source: 'core/game', problem: { kind: 'error', message: e instanceof Error ? e.message : String(e) } };
  }
}
