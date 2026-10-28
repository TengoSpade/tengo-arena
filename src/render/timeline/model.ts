import type { FightHeader } from '../../core/model';

/** An indexed log. Opaque outside src/render/timeline. */
export interface PlaybackIndex {
  readonly header: FightHeader;
  readonly kind: 'live' | 'replay';
  /** The tick of `fight.end` for a replay; always null for a live round (the end is not known until reached). */
  readonly endTick: number | null;
  /** FightHeader.logFormat ?? 1. */
  readonly logFormat: number;
  readonly internal: unknown;
}
