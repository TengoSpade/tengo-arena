/**
 * What an F8 ticket records about the arena (05-technical-m2 §A7 "F8 metadata"): fixture, round, tick, speed and
 * kind. The tool lives in the startup chunk and must not import the (lazy) arena screens, so the screen registers a
 * getter here while it is mounted; the launcher reads it synchronously at the key press, like the rest of the
 * snapshot.
 */
export interface ArenaTicketInfo {
  kind: 'live' | 'replay';
  fixtureId: string;
  round: number;
  /** The shown tick (fractional while playing). */
  tick: number;
  /** The live head (live) or the round's last tick (replay). */
  headTick: number;
  speed: number;
  playing: boolean;
}

let getter: (() => ArenaTicketInfo | null) | null = null;

/** Register while an arena screen is mounted; returns the unregister function. */
export function registerArenaTicketInfo(fn: () => ArenaTicketInfo | null): () => void {
  getter = fn;
  return () => {
    if (getter === fn) getter = null;
  };
}

export function arenaTicketInfo(): ArenaTicketInfo | null {
  try {
    return getter ? getter() : null;
  } catch {
    return null;
  }
}
