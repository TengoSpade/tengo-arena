/**
 * The live feed's sentences (04 §4 "downs name their cause", vis-003): one line per key moment, from the viewer's
 * `keyMoments()` (bounded by the live head) and the round context. Pure.
 *
 * Convention (confirm with src/render/timeline, WP-M2C): for kind 'down' a KeyMoment's `unit` is the downed fighter
 * and `target` the one who downed him (the sim's `unit.down` envelope: unit = victim, target = killer); for
 * 'interrupt' and 'deathward' `unit` is the one affected and `target` the other fighter, when there is one.
 */
import type { ContentDB } from '../../../core/content';
import type { ArenaRoundContext, AutoPauseReason, KeyMoment } from '../../../render';
import { abilityName } from '../../m11/model';
import type { StopKind } from './session';
import { clock, t } from './text';

export interface FeedItem {
  key: string;
  tick: number;
  kind: KeyMoment['kind'];
  /** The side the moment is about (0 home, 1 away), or null for neutral ones (overtime, the end). */
  side: 0 | 1 | null;
  /** True when it is about the player's side (null in a match between other clubs, or when neutral). */
  ours: boolean | null;
  text: string;
  time: string;
}

const TICK_S = 0.05;

export function nameOfUnit(ctx: ArenaRoundContext, unit: number | null): string {
  return unit === null ? '' : (ctx.units[unit]?.name ?? `#${unit}`);
}

export function momentText(m: KeyMoment, ctx: ArenaRoundContext, content: ContentDB): string {
  const unit = nameOfUnit(ctx, m.unit);
  const by = nameOfUnit(ctx, m.target);
  const ability = m.ability ? abilityName(content, m.ability) : '';
  switch (m.kind) {
    case 'down':
      return by && ability ? t('momentDownBy', { unit, by, ability }) : by ? t('momentDown', { unit, by }) : t('momentDownAlone', { unit });
    case 'interrupt':
      return by ? t('momentInterruptBy', { unit, by }) : t('momentInterrupt', { unit });
    case 'deathward':
      return by ? t('momentDeathwardBy', { unit, by }) : t('momentDeathward', { unit });
    case 'rally':
      return t('momentRally', { unit });
    case 'captain-down':
      return t('momentCaptainDown', { unit });
    case 'handover':
      return t('momentHandover', { unit });
    case 'overtime':
      return t('momentOvertime');
    case 'call':
      return t('momentCall', { unit });
    case 'end':
      return t('momentEnd');
  }
}

export function feedItems(moments: readonly KeyMoment[], ctx: ArenaRoundContext, content: ContentDB): FeedItem[] {
  return moments.map((m) => {
    const side = m.unit !== null ? (ctx.units[m.unit]?.side ?? null) : null;
    return {
      key: `${m.seq}`,
      tick: m.tick,
      kind: m.kind,
      side,
      ours: side === null || ctx.playerSide === null ? null : side === ctx.playerSide,
      text: momentText(m, ctx, content),
      time: clock(m.tick * TICK_S),
    };
  });
}

const AUTO_WHY: Record<AutoPauseReason, Parameters<typeof t>[0]> = {
  ownDowned: 'stopAutoOwnDowned',
  enemyDowned: 'stopAutoEnemyDowned',
  ownCaptainDown: 'stopAutoOwnCaptainDown',
  overtime: 'stopAutoOvertime',
  ownHpBelowPct: 'stopAutoOwnHpBelowPct',
};

/** The sentence a stop announces in the polite live region ("Paused: one of yours went down"). */
export function stopText(stop: StopKind, ctx: ArenaRoundContext): string | null {
  if (stop.kind !== 'auto') return null;
  const named = stop.stop.unit !== null ? ` (${nameOfUnit(ctx, stop.stop.unit)})` : '';
  return t('stopAuto', { why: t(AUTO_WHY[stop.stop.reason]) }) + named;
}
