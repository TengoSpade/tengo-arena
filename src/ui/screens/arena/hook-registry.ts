/**
 * Where the arena screen publishes its live viewer for the test hook (05-technical-m2 §A7, tech-027). The hook itself
 * (window.__arena.viewer, ./test-hook.ts) is compiled into dev and `smoke` builds only; this registry is the one
 * neutral variable the screens write, so production carries no hook code, only an unused slot.
 */
import type { RoundPlayback } from '../../../core/game';
import type { FightLog } from '../../../core/model';
import type { ArenaFrameState } from '../../../render';
import type { ArenaViewer } from '../../../render/viewer';

export interface HookSlot {
  viewer: ArenaViewer | null;
  /** Hash of the log the viewer loaded (the commit compares it). */
  logHash: string | null;
  /** The log itself, for the hook's in-browser event-stream hash (the smoke compares it with Node's golden). */
  log: FightLog | null;
  /** The HUD's latest frame. */
  frame: (() => ArenaFrameState | null) | null;
  /** A fixed round the hook asks the replay screen to show (`loadFixtureRound`), else null. */
  fixture: { fixtureId: string; playback: RoundPlayback } | null;
}

export const hookSlot: HookSlot = { viewer: null, logHash: null, log: null, frame: null, fixture: null };
