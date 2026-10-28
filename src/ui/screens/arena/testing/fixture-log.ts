/**
 * Test support (not shipped: nothing in src imports it): a small synthetic full-level fight log with KNOWN later
 * events, for the arena screen tests and the leak test (05-technical-m2 §A11 "the fake-viewer leak test"):
 * a down at tick 400, overtime at 900 and the end at 1,000 by default. It is a hand-built stand-in for a sim log
 * (the real timeline of WP-M2C reads real ones); only the event shapes of core/model/events.ts matter.
 */
import { FIGHT_LOG_FORMAT, hashEventStream, type FightEvent, type FightHeader, type FightLog, type FightUnitInfo, type FrameUnit, type RuleTraceEntry } from '../../../../core/model';

export interface LogUnit {
  fighterId: string;
  classId: string;
  clubId: string;
  /** Slot within the side (0-4). */
  slot: number;
  row: 'front' | 'back';
  isCaptain: boolean;
}

export interface LogSpec {
  /** Five home units then five away units. */
  home: LogUnit[];
  away: LogUnit[];
  abilityId: string;
  round?: number;
  endTick?: number;
  /** The unit that goes down, who downs him, and when. */
  downUnit?: number;
  downBy?: number;
  downTick?: number;
  overtimeTick?: number;
  winner?: 0 | 1;
  /** Ticks with a unit.decide for unit 0 (rule index alternates). */
  decideTicks?: number[];
}

export const LOG_ARENA = { width: 3200, height: 1800 };

export function buildFightLog(spec: LogSpec): FightLog {
  const endTick = spec.endTick ?? 1000;
  const downUnit = spec.downUnit ?? 3;
  const downBy = spec.downBy ?? 7;
  const downTick = spec.downTick ?? 400;
  const overtimeTick = spec.overtimeTick ?? 900;
  const winner = spec.winner ?? 1;
  const units: FightUnitInfo[] = [...spec.home, ...spec.away].map((u, i) => ({
    index: i,
    side: i < 5 ? 0 : 1,
    fighterId: u.fighterId as FightUnitInfo['fighterId'],
    clubId: u.clubId as FightUnitInfo['clubId'],
    classId: u.classId as FightUnitInfo['classId'],
    slot: u.slot,
    row: u.row,
    isCaptain: u.isCaptain,
  }));
  const header: FightHeader = {
    format: FIGHT_LOG_FORMAT,
    engineVersion: 2,
    contentHash: 'test',
    seed: 'test-round-seed',
    round: spec.round ?? 1,
    tickMs: 50,
    frameEvery: 2,
    arena: LOG_ARENA,
    units,
    logFormat: 2,
  };
  const events: FightEvent[] = [];
  let seq = 0;
  const push = <E extends FightEvent>(e: Omit<E, 'seq'>): void => {
    events.push({ ...e, seq: seq++ } as E);
  };
  const pos = (i: number): [number, number] => [i < 5 ? 800 : 2400, 300 + (i % 5) * 300];
  push({ tick: 0, type: 'fight.start', data: { units: units.map((u) => ({ unit: u.index, x: pos(u.index)[0], y: pos(u.index)[1], hp: 100, maxHp: 100, focus: 50, freshness: 100 })) } });
  const decideTicks = spec.decideTicks ?? [100, 300, 600];
  const trace = (rule: number): RuleTraceEntry[] =>
    rule === 0
      ? [{ rule: 0, fired: true, skip: null, reason: null }]
      : [
          { rule: 0, fired: false, skip: 'condition_false', reason: 'cond_false', cond: 0, observed: 8200 },
          { rule: 1, fired: true, skip: null, reason: null },
        ];
  for (let tick = 0; tick <= endTick; tick += 2) {
    const decideIdx = decideTicks.indexOf(tick);
    if (decideIdx >= 0 && tick > 0) {
      const rule = decideIdx % 2 === 0 ? 1 : 0;
      push({ tick, type: 'unit.decide', unit: 0, data: { rule, action: rule === 0 ? 'attack' : 'ability:a1', targetUnit: 5, reactTicks: 4, reactCauses: ['enemy_in_range'], commitTick: tick, trace: trace(rule) } });
    }
    if (tick === downTick) {
      push({ tick, type: 'unit.down', unit: downUnit, target: downBy, data: { by: downBy, ability: spec.abilityId as never, hit: 30, overkill: 5, assists: [] } });
    }
    if (tick === overtimeTick) push({ tick, type: 'overtime.start', data: {} });
    const frame: FrameUnit[] = units.map((u) => {
      const [x, y] = pos(u.index);
      const dead = u.index === downUnit && tick >= downTick;
      return [x, y, dead ? 0 : 100, dead ? 16 : 0, 0, 50];
    });
    push({ tick, type: 'frame', data: { u: frame } });
  }
  push({ tick: endTick, type: 'fight.end', data: { winner, reason: 'elimination', tiebreakStep: null } });
  return { header, events, hash: hashEventStream(header, events) };
}

/**
 * The same log cut after `tick` (no later event, so no `fight.end`), with the SAME hash string: the leak test renders
 * a screen with each and compares the DOM, so any read past the head shows up as a difference.
 */
export function truncateLog(log: FightLog, tick: number): FightLog {
  return { header: log.header, events: log.events.filter((e) => e.tick <= tick), hash: log.hash };
}
