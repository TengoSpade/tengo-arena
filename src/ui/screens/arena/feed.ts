/**
 * The live feed's sentences (04 §4 "downs name their cause", vis-003): one line per key moment, from the viewer's
 * `keyMoments()` (bounded by the live head) and the round context. Pure.
 *
 * Convention (confirmed by the architect; src/render/timeline and the match report use it): `unit` is the ACTING fighter
 * and `target` the one it happened to. So for a 'down', `unit` is the killer (the credited fighter, null for none) and
 * `target` the fallen; for 'interrupt', `unit` interrupted `target`; for 'deathward', `unit` saved `target`. Rally,
 * captain-down, handover and call are about `unit`.
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
  /** The mock's data-side: 'us' when it is about the player's side (home in a match between other clubs), 'them' for the other, null when neutral. */
  mark: 'us' | 'them' | null;
  /** True when it is about the player's side (null in a match between other clubs, or when neutral). */
  ours: boolean | null;
  /** The timeline component's data-event ('down', 'end', 'rule'). */
  event: 'down' | 'end' | 'rule';
  /** The sentence ("Kael downed by Cato"), its detail line (the ability), and both as one line (announcements). */
  title: string;
  detail: string;
  text: string;
  time: string;
  /** A down whose fighter was the captain (his captain-down moment is folded into this item). */
  captain?: boolean;
}

const TICK_S = 0.05;

export function nameOfUnit(ctx: ArenaRoundContext, unit: number | null): string {
  return unit === null ? '' : (ctx.units[unit]?.name ?? `#${unit}`);
}

/** `captain`: the fallen was the acting captain (his captain-down moment is folded into this line, not a second one). */
export function momentParts(m: KeyMoment, ctx: ArenaRoundContext, content: ContentDB, captain = false): { title: string; detail: string } {
  const unit = nameOfUnit(ctx, m.target);
  const by = nameOfUnit(ctx, m.unit);
  const ability = m.ability ? abilityName(content, m.ability) : '';
  switch (m.kind) {
    case 'down':
      if (captain) return { title: by ? t('momentDownCaptain', { unit, by }) : t('momentDownCaptainAlone', { unit }), detail: ability };
      return { title: by ? t('momentDown', { unit, by }) : t('momentDownAlone', { unit }), detail: ability };
    default:
      return { title: momentText(m, ctx, content), detail: '' };
  }
}

/** The fighter a moment is ABOUT: the fallen, the interrupted, the saved; else the acting fighter. */
export function subjectOf(m: KeyMoment): number | null {
  return m.kind === 'down' || m.kind === 'interrupt' || m.kind === 'deathward' ? m.target : m.unit;
}

export function momentText(m: KeyMoment, ctx: ArenaRoundContext, content: ContentDB, captain = false): string {
  // About whom (the fallen, the interrupted, the saved) and by whom, per the convention above.
  const affected = subjectOf(m) === m.target && m.target !== null;
  const unit = nameOfUnit(ctx, affected ? m.target : m.unit);
  const by = affected ? nameOfUnit(ctx, m.unit) : '';
  const ability = m.ability ? abilityName(content, m.ability) : '';
  switch (m.kind) {
    case 'down':
      if (captain) return by && ability ? t('momentDownCaptainBy', { unit, by, ability }) : by ? t('momentDownCaptain', { unit, by }) : t('momentDownCaptainAlone', { unit });
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
  // A captain's fall is one line: the down names him Captain, and his captain-down moment (same tick, same fighter) is folded
  // into it. A captain-down with no down beside it stays as its own line.
  const downs = new Set<string>();
  for (const m of moments) if (m.kind === 'down' && m.target !== null) downs.add(`${m.tick}:${m.target}`);
  const folded = (m: KeyMoment): boolean => m.kind === 'captain-down' && m.unit !== null && downs.has(`${m.tick}:${m.unit}`);
  const captains = new Set<string>();
  for (const m of moments) if (folded(m)) captains.add(`${m.tick}:${m.unit}`);
  const items: FeedItem[] = [];
  for (const m of moments) {
    if (folded(m)) continue;
    const captain = m.kind === 'down' && m.target !== null && captains.has(`${m.tick}:${m.target}`);
    const subject = subjectOf(m);
    const side = subject !== null ? (ctx.units[subject]?.side ?? null) : null;
    const ours = side === null ? null : side === (ctx.playerSide ?? 0);
    const parts = momentParts(m, ctx, content, captain);
    items.push({
      key: `${m.seq}`,
      tick: m.tick,
      kind: m.kind,
      side,
      mark: ours === null ? null : ours ? 'us' : 'them',
      ours: side === null || ctx.playerSide === null ? null : side === ctx.playerSide,
      event: m.kind === 'down' || m.kind === 'captain-down' ? 'down' : m.kind === 'overtime' || m.kind === 'end' ? 'end' : 'rule',
      title: parts.title,
      detail: parts.detail,
      text: momentText(m, ctx, content, captain),
      time: clock(m.tick * TICK_S),
      ...(captain ? { captain: true } : {}),
    });
  }
  return items;
}

const AUTO_WHY: Record<AutoPauseReason, Parameters<typeof t>[0]> = {
  ownDowned: 'stopAutoOwnDowned',
  enemyDowned: 'stopAutoEnemyDowned',
  ownCaptainDown: 'stopAutoOwnCaptainDown',
  overtime: 'stopAutoOvertime',
  ownHpBelowPct: 'stopAutoOwnHpBelowPct',
};

/** The cause of an automatic pause for the transport's status ("Kael Dunmere was downed"), or null. */
export function stopCause(stop: StopKind, ctx: ArenaRoundContext): string | null {
  if (stop.kind !== 'auto') return null;
  const name = nameOfUnit(ctx, stop.stop.unit);
  switch (stop.stop.reason) {
    case 'ownDowned':
    case 'enemyDowned':
    case 'ownCaptainDown':
      return name ? t('statusDown', { name }) : null;
    case 'overtime':
      return t('momentOvertime');
    default:
      return t(AUTO_WHY[stop.stop.reason]);
  }
}

/** The sentence a stop announces in the polite live region ("Paused: one of yours went down"). */
export function stopText(stop: StopKind, ctx: ArenaRoundContext): string | null {
  if (stop.kind !== 'auto') return null;
  const named = stop.stop.unit !== null ? ` (${nameOfUnit(ctx, stop.stop.unit)})` : '';
  return t('stopAuto', { why: t(AUTO_WHY[stop.stop.reason]) }) + named;
}
