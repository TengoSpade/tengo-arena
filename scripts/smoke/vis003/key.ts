/**
 * The vis-003 answer key of a fight, computed from its full-level fight log and the content: who the tanks and healers
 * are (classes' archetypes, D-J) and every down with its cause (`unit.down`: the unit and the ability that struck the
 * last blow). Pure; unit-tested on logs the sim produces.
 */
import type { ContentDB } from '../../../src/core/content';
import type { FightLog } from '../../../src/core/model';
import type { FightKey, KeyDown, KeyUnit, SideNo } from './types';

export interface KeyOptions {
  fight: number;
  fixtureId?: string | null;
  /** Fighter id to the name the strip shows (state.fighters[id].name.full). Missing ids fall back to the class name. */
  names?: Readonly<Record<string, string>>;
  ourSide?: SideNo | null;
  clubNames?: [string, string];
}

export function buildFightKey(log: FightLog, content: ContentDB, opts: KeyOptions): FightKey {
  const units: KeyUnit[] = log.header.units.map((u) => {
    const k = content.classes.get(u.classId);
    return {
      unit: u.index,
      side: u.side,
      fighterId: u.fighterId,
      name: opts.names?.[u.fighterId] ?? k?.name ?? u.classId,
      className: k?.name ?? u.classId,
      roles: [...(k?.archetypes ?? [])],
    };
  });
  const withRole = (role: string, side: SideNo): number[] => units.filter((u) => u.side === side && u.roles.includes(role)).map((u) => u.unit);
  const downs: KeyDown[] = [];
  let winnerSide: SideNo | null = null;
  let endTick = 0;
  for (const e of log.events) {
    endTick = Math.max(endTick, e.tick);
    if (e.type === 'unit.down' && e.unit !== undefined && e.data) {
      const abilityId = e.data.ability;
      downs.push({
        index: downs.length + 1,
        tick: e.tick,
        seconds: Math.round(e.tick * 0.05 * 10) / 10,
        victim: e.unit,
        killer: e.data.by,
        ability: abilityId,
        abilityName: abilityId ? (content.abilities.get(abilityId)?.name ?? abilityId) : null,
        assists: [...e.data.assists],
      });
    } else if (e.type === 'fight.end' && e.data) {
      winnerSide = e.data.winner;
      endTick = e.tick;
    }
  }
  return {
    fight: opts.fight,
    fixtureId: opts.fixtureId ?? null,
    round: log.header.round,
    ourSide: opts.ourSide ?? null,
    clubNames: opts.clubNames ?? ['Home', 'Away'],
    units,
    tanks: [withRole('tank', 0), withRole('tank', 1)],
    healers: [withRole('healer', 0), withRole('healer', 1)],
    downs,
    winnerSide,
    durationTicks: endTick,
    logHash: log.hash,
  };
}
