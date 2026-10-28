/**
 * A scripted fake of the render-state model (the injectable `Timeline`, review B8) with a matching fake content,
 * cue table, camera transform and round context. WP-M2D builds and tests the viewer against it while the real
 * model (WP-M2C) lands; the dev harness drives the real viewer with it in a browser.
 *
 * The "log" is a handful of real-shaped events (unit.down, overtime.start, fight.end); `sampleAt` is a pure
 * function of (events, tick) that moves ten fighters, steps their HP, and raises every kind of cue (casts,
 * telegraphs, projectiles, zones, statuses, effects, downs), so the scene sees what a real round would show.
 * It records what it was asked for, so tests can check that the viewer never looks past the head.
 *
 * This file is test support: nothing in the viewer imports it, so it is not part of the PixiJS chunk.
 */
import type { ContentDB } from '../../../core/content';
import type { FightEvent, FightHeader, FightLog, FightUnitInfo, Side, UnitIndex } from '../../../core/model';
import type { PlaybackIndex, Timeline } from '../../timeline';
import type {
  AbilityCue,
  ArenaFrameState,
  ArenaRoundContext,
  ArenaUnitInfo,
  AutoPauseRules,
  AutoPauseStop,
  CameraConfig,
  CueTable,
  EffectRenderState,
  KeyMoment,
  RoleId,
  StatusCue,
  StatusRenderState,
  TeamColors,
  UnitRenderState,
  ViewTransform,
} from '../../types';

const ARENA = { width: 3200, height: 1800 };

export interface FakeRoundSpec {
  /** Last tick of the round (fight.end). Default 1200. */
  endTick?: number;
  /** Units that go down: tick, the downed unit and who did it. Default: one of each side. */
  downs?: readonly { tick: number; unit: UnitIndex; by: UnitIndex | null; ability?: string }[];
  /** Tick overtime starts; null for none. Default 900. */
  overtimeTick?: number | null;
  /** Changes every event after this tick when set (a re-simulation with a call): the prefix up to it stays identical. */
  divergeAfter?: { tick: number; tag: string };
}

const DEFAULT_DOWNS: readonly { tick: number; unit: UnitIndex; by: UnitIndex | null; ability?: string }[] = [
  { tick: 300, unit: 6, by: 1, ability: 'a.shadowstep' },
  { tick: 600, unit: 2, by: 7, ability: 'a.fireball' },
  { tick: 700, unit: 0, by: 8, ability: 'a.cleave' },
];

/** A fake full-level log: real event envelopes, no frames (the fake sampler does not read frames). */
export function fakeLog(spec: FakeRoundSpec = {}): FightLog {
  const endTick = spec.endTick ?? 1200;
  const downs = spec.downs ?? DEFAULT_DOWNS;
  const overtime = spec.overtimeTick === undefined ? 900 : spec.overtimeTick;
  const units: FightUnitInfo[] = [];
  for (let i = 0; i < 10; i++) {
    units.push({ index: i, side: (i < 5 ? 0 : 1) as Side, fighterId: `f${i}` as never, clubId: (i < 5 ? 'c.home' : 'c.away') as never, classId: `class.${i % 5}` as never, slot: i % 5, row: i % 5 < 2 ? 'front' : 'back', isCaptain: i % 5 === 0 });
  }
  const header: FightHeader = { format: 'arena-league-fight', engineVersion: 2, contentHash: 'fake', seed: 'fake-seed' as never, round: 1, tickMs: 50, frameEvery: 2, arena: ARENA, units };
  const events: Record<string, unknown>[] = [];
  let seq = 0;
  const push = (tick: number, type: string, unit?: number, target?: number, data?: unknown): void => {
    const tag = spec.divergeAfter && tick > spec.divergeAfter.tick ? spec.divergeAfter.tag : '';
    events.push({ seq: seq++, tick, type, unit, target, data: tag ? { ...(data as object), tag } : data });
  };
  push(0, 'fight.start');
  for (const d of downs) push(d.tick, 'unit.down', d.unit, d.by ?? undefined, { by: d.by, ability: d.ability ?? null, hit: 40, overkill: 0, assists: [] });
  if (overtime !== null) push(overtime, 'overtime.start');
  push(endTick, 'fight.end');
  return { header, events: events as unknown as FightEvent[], hash: `fake-${JSON.stringify(events)}` };
}

/** What the fake timeline was asked, for the viewer-logic tests. */
export interface FakeTimelineCalls {
  indexFightLog: number;
  sampleAt: number[];
  autoPauseStops: number[];
  keyMoments: number[];
  decisionAt: number[];
  samePrefix: number[];
}

export interface FakeTimeline extends Timeline {
  readonly calls: FakeTimelineCalls;
  /** The furthest tick any query was asked for. */
  maxTickAsked(): number;
}

interface Script {
  end: number;
  downs: { tick: number; unit: number; by: number | null; ability: string | null; seq: number }[];
  overtime: number | null;
  events: readonly FightEvent[];
}

const scriptOf = (index: PlaybackIndex): Script => index.internal as Script;

function parse(log: FightLog): Script {
  const script: Script = { end: 0, downs: [], overtime: null, events: log.events };
  for (const e of log.events) {
    if (e.type === 'fight.end') script.end = e.tick;
    else if (e.type === 'overtime.start') script.overtime = e.tick;
    else if (e.type === 'unit.down') {
      const d = e.data as { by: number | null; ability: string | null };
      script.downs.push({ tick: e.tick, unit: e.unit ?? 0, by: d.by, ability: d.ability, seq: e.seq });
    }
  }
  return script;
}

export function createFakeTimeline(): FakeTimeline {
  const calls: FakeTimelineCalls = { indexFightLog: 0, sampleAt: [], autoPauseStops: [], keyMoments: [], decisionAt: [], samePrefix: [] };
  const timeline: FakeTimeline = {
    calls,
    maxTickAsked: () => Math.max(0, ...calls.sampleAt, ...calls.autoPauseStops, ...calls.keyMoments, ...calls.decisionAt, ...calls.samePrefix),
    indexFightLog(log, _content, _cues, kind): PlaybackIndex {
      calls.indexFightLog++;
      const script = parse(log);
      return { header: log.header, kind, endTick: kind === 'replay' ? script.end : null, logFormat: 1, internal: script };
    },
    sampleAt(index, tick, _ctx, options): ArenaFrameState {
      calls.sampleAt.push(tick);
      return sample(scriptOf(index), tick, options?.reducedMotion ?? false);
    },
    eventsBetween(index, fromTick, toTick) {
      return scriptOf(index).events.filter((e) => e.tick > fromTick && e.tick <= toTick);
    },
    decisionAt(index, unit, tick) {
      calls.decisionAt.push(tick);
      void index;
      return { unit, rule: 1, action: 'attack', targetUnit: null, commitTick: Math.max(0, Math.floor(tick / 100) * 100), reactTicks: 4, reactCauses: [], trace: [] };
    },
    autoPauseStops(index, rules: AutoPauseRules, ctx, untilTick): readonly AutoPauseStop[] {
      calls.autoPauseStops.push(untilTick);
      const s = scriptOf(index);
      const out: AutoPauseStop[] = [];
      for (const d of s.downs) {
        if (d.tick > untilTick) continue;
        const own = ctx.playerSide !== null && (d.unit < 5 ? 0 : 1) === ctx.playerSide;
        const captain = d.unit % 5 === 0;
        if (own && rules.ownDowned) out.push({ tick: d.tick, reason: 'ownDowned', unit: d.unit, seq: d.seq });
        else if (!own && rules.enemyDowned) out.push({ tick: d.tick, reason: 'enemyDowned', unit: d.unit, seq: d.seq });
        if (own && captain && rules.ownCaptainDown) out.push({ tick: d.tick, reason: 'ownCaptainDown', unit: d.unit, seq: d.seq });
      }
      if (rules.overtime && s.overtime !== null && s.overtime <= untilTick) out.push({ tick: s.overtime, reason: 'overtime', unit: null, seq: 9000 });
      return out.sort((a, b) => a.tick - b.tick || a.seq - b.seq);
    },
    keyMoments(index, _ctx, untilTick): readonly KeyMoment[] {
      calls.keyMoments.push(untilTick);
      const s = scriptOf(index);
      const out: KeyMoment[] = s.downs.filter((d) => d.tick <= untilTick).map((d) => ({ tick: d.tick, seq: d.seq, kind: 'down' as const, unit: d.by, target: d.unit, ability: d.ability as never }));
      if (s.overtime !== null && s.overtime <= untilTick) out.push({ tick: s.overtime, seq: 9000, kind: 'overtime', unit: null, target: null, ability: null });
      if (s.end <= untilTick) out.push({ tick: s.end, seq: 9001, kind: 'end', unit: null, target: null, ability: null });
      return out.sort((a, b) => a.tick - b.tick);
    },
    samePrefix(prev, next, atTick) {
      calls.samePrefix.push(atTick);
      const a = scriptOf(prev).events.filter((e) => e.tick <= atTick);
      const b = scriptOf(next).events.filter((e) => e.tick <= atTick);
      return a.length === b.length && a.every((e, i) => JSON.stringify(e) === JSON.stringify(b[i]));
    },
  };
  return timeline;
}

// ---- the scripted sampler ---------------------------------------------------------------------------------------

const MAX_HP = 1000;

function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Home x 500-1100, away mirrored; two rows; each fighter orbits its post. */
function post(unit: number): { x: number; y: number } {
  const side = unit < 5 ? 0 : 1;
  const slot = unit % 5;
  const front = slot < 2;
  const x = side === 0 ? (front ? 1050 : 650) : ARENA.width - (front ? 1050 : 650);
  const y = 380 + slot * 260;
  return { x, y };
}

function sample(s: Script, tickIn: number, reducedMotion: boolean): ArenaFrameState {
  const tick = Math.max(0, Math.min(tickIn, s.end));
  const downTick = (unit: number): number | null => s.downs.find((d) => d.unit === unit)?.tick ?? null;
  const units: UnitRenderState[] = [];
  const stand = { home: 0, away: 0 };
  for (let i = 0; i < 10; i++) {
    const p = post(i);
    const phase = i * 0.7;
    const t = tick / 20;
    const advance = Math.min(1, tick / 200) * (i < 5 ? 1 : -1) * 320;
    const x = p.x + advance + Math.cos(t * 0.9 + phase) * 140;
    const y = p.y + Math.sin(t * 0.9 + phase) * 140;
    const facing = Math.atan2(Math.cos(t * 0.9 + phase), -Math.sin(t * 0.9 + phase));
    const dt = downTick(i);
    const down = dt !== null && tick >= dt;
    const hp = down ? 0 : Math.max(60, Math.round(MAX_HP - (tick / s.end) * 520 - hash01(i) * 120));
    const statuses: StatusRenderState[] = [];
    if (i === 1 && tick >= 200 && tick < 280) statuses.push({ status: 's.stun', category: 'cc_hard', stacks: 1, appliedTick: 200, endsTick: 280 });
    if (i === 3 && tick >= 100) statuses.push({ status: 's.haste', category: 'buff', stacks: 1, appliedTick: 100, endsTick: null }, { status: 's.burn', category: 'dot', stacks: 2, appliedTick: 120, endsTick: null });
    if (i === 7 && tick >= 150) statuses.push({ status: 's.slow', category: 'cc_soft', stacks: 1, appliedTick: 150, endsTick: null }, { status: 's.weak', category: 'debuff', stacks: 1, appliedTick: 150, endsTick: null }, { status: 's.regen', category: 'hot', stacks: 1, appliedTick: 150, endsTick: null }, { status: 's.mark', category: 'special', stacks: 1, appliedTick: 150, endsTick: null }, { status: 's.ward', category: 'shield', stacks: 1, appliedTick: 150, endsTick: null });
    const casting = i === 3 && tick >= 300 && tick < 340;
    const lastHit = tick >= 40 ? Math.floor((tick - 40 * hash01(i + 3)) / 40) * 40 + Math.floor(40 * hash01(i + 3)) : null;
    const captainAlive = i % 5 === 0 && !down;
    if (!down) {
      if (i < 5) stand.home++;
      else stand.away++;
    }
    units.push({
      unit: i,
      side: (i < 5 ? 0 : 1) as Side,
      x,
      y,
      facing,
      hp,
      maxHp: MAX_HP,
      shield: i === 2 ? (tick > 200 ? 150 : 0) : i === 0 ? null : 0,
      focus: i === 0 ? null : Math.round(50 + 40 * Math.sin(t * 0.5 + i)),
      standing: !down,
      downedTick: down ? dt : null,
      action: down ? 'downed' : statuses.some((x) => x.category === 'cc_hard') ? 'stunned' : casting ? 'cast' : 'move',
      cast: casting ? { ability: 'a.fireball' as never, kind: 'cast', startTick: 300, endTick: 340, progress: (tick - 300) / 40, target: 6 } : null,
      statuses,
      rule: down ? null : { label: `R${1 + (Math.floor(tick / 100) % 4)}`, rule: Math.floor(tick / 100) % 4, sinceTick: Math.floor(tick / 100) * 100, pulse: reducedMotion ? 0 : Math.max(0, 1 - (tick - Math.floor(tick / 100) * 100) / 4.4) },
      isCaptain: captainAlive,
      targetUnit: null,
      lastHitTick: lastHit,
    });
  }
  const telegraphs = [] as ArenaFrameState['telegraphs'][number][];
  if (tick >= 300 && tick < 340) telegraphs.push({ caster: 3, ability: 'a.fireball' as never, shape: 'circle', x: 2100, y: 900, size: 260, spread: 0, direction: 0, progress: (tick - 300) / 40 });
  if (tick >= 400 && tick < 440) telegraphs.push({ caster: 1, ability: 'a.cleave' as never, shape: 'cone', x: units[1]!.x, y: units[1]!.y, size: 320, spread: 1.2, direction: 0.3, progress: (tick - 400) / 40 });
  if (tick >= 500 && tick < 540) telegraphs.push({ caster: 8, ability: 'a.beam' as never, shape: 'line', x: units[8]!.x, y: units[8]!.y, size: 700, spread: 120, direction: Math.PI, progress: (tick - 500) / 40 });
  const projectiles = [] as ArenaFrameState['projectiles'][number][];
  for (let k = 0; k < 3; k++) {
    const launch = 60 + k * 90;
    const cycle = (tick - launch) % 180;
    if (tick >= launch && cycle >= 0 && cycle < 20) {
      const src = units[2 + k]!;
      const dst = units[7 - k]!;
      const progress = cycle / 20;
      projectiles.push({ id: Math.floor((tick - launch) / 180) * 10 + k, ability: 'a.arrow' as never, source: src.unit, target: dst.unit, x: src.x + (dst.x - src.x) * progress, y: src.y + (dst.y - src.y) * progress, progress });
    }
  }
  const zones = tick >= 100 && tick < 400 ? [{ id: 1, ability: 'a.zone' as never, owner: 4, side: 0 as Side, x: 1700, y: 900, radius: 280, spawnTick: 100, endsTick: 400 }] : [];
  const effects: EffectRenderState[] = [];
  const add = (id: number, kind: EffectRenderState['kind'], start: number, life: number, partial: Partial<EffectRenderState>): void => {
    if (tick < start || tick > start + life) return;
    effects.push({ id, kind, unit: null, target: null, ability: null, x: 0, y: 0, amount: null, crit: false, tone: 'neutral', age: (tick - start) / life, ...partial });
  };
  for (let k = 0; k < 24; k++) {
    const start = 30 + k * 45;
    const attacker = units[k % 10]!;
    const victim = units[(k * 3 + 5) % 10]!;
    const common = { unit: attacker.unit, target: victim.unit, x: victim.x, y: victim.y, tone: (k % 3 === 0 ? 'arcane' : 'physical') as EffectRenderState['tone'] };
    // As the real model: x,y is where it lands (the target); the viewer draws a swing at the actor.
    add(1000 + k * 10, 'swing', start, 6, common);
    add(1001 + k * 10, 'impact', start + 2, 6, { ...common, crit: k % 7 === 0 });
    add(1002 + k * 10, 'number', start + 2, 14, { ...common, amount: 40 + (k % 5) * 11, crit: k % 7 === 0 });
    if (k % 4 === 1) add(1003 + k * 10, 'beam', start, 5, common);
    if (k % 5 === 2) add(1004 + k * 10, 'heal-pulse', start, 10, { ...common, unit: 4, target: 3, tone: 'heal' });
    if (k % 5 === 2) add(1005 + k * 10, 'number', start + 1, 14, { ...common, target: 3, tone: 'heal', amount: 55 });
    if (k % 6 === 3) add(1006 + k * 10, 'evade', start + 2, 10, common);
    if (k % 8 === 4) add(1007 + k * 10, 'status-apply', start, 8, common);
    if (k % 9 === 5) add(1008 + k * 10, 'chain-arc', start, 8, common);
    if (k % 6 === 0) add(1009 + k * 10, 'splash', start, 6, { ...common, ability: 'a.fireball' as never });
    if (k % 7 === 3) add(1010 + k * 10, 'splash', start, 6, { ...common, ability: 'a.cleave' as never, x: attacker.x, y: attacker.y });
    if (k % 11 === 4) add(1011 + k * 10, 'displace', start, 8, { ...common, unit: victim.unit, target: attacker.unit, x: victim.x - 120, y: victim.y });
  }
  add(7000, 'zone-trigger', 200, 8, { unit: 4, ability: 'a.zone' as never, x: 1700, y: 900, tone: 'heal' });
  add(7001, 'guard-link', 100, 80, { unit: 0, target: 1 });
  add(7002, 'shield-gain', 195, 8, { unit: 4, target: 2, tone: 'shield' });
  add(7003, 'cleanse', 350, 10, { unit: 4, target: 3, tone: 'heal' });
  add(7004, 'dispel', 420, 10, { unit: 2, target: 7 });
  add(7005, 'deathward', 450, 20, { unit: 4, target: 9, x: units[4]!.x, y: units[4]!.y });
  add(7006, 'rally', 460, 16, { unit: 0, x: units[0]!.x, y: units[0]!.y });
  add(7007, 'interrupt', 330, 8, { unit: 5, target: 3, x: units[3]!.x, y: units[3]!.y });
  for (const d of s.downs) add(5000 + d.seq, 'down', d.tick, 40, { unit: d.unit, target: d.by, ability: d.ability as never, x: units[d.unit]!.x, y: units[d.unit]!.y });
  const ended = tick >= s.end;
  return {
    tick,
    fightSeconds: tick * 0.05,
    overtime: s.overtime !== null && tick >= s.overtime,
    ended,
    endTick: ended ? s.end : null,
    units,
    projectiles,
    zones,
    telegraphs,
    effects,
    standing: stand,
    captains: { home: units.find((u) => u.unit === 0 && u.standing)?.unit ?? null, away: units.find((u) => u.unit === 5 && u.standing)?.unit ?? null },
  };
}

// ---- fake content, cues, transform, context ---------------------------------------------------------------------

/** Just enough of ContentDB for the viewer: ability names and the focus maximum. */
export function fakeContent(): ContentDB {
  return { abilities: { get: (id: string) => ({ id, name: ABILITY_NAMES[id] ?? id }) }, combat: { focus: { max: 100 } } } as unknown as ContentDB;
}
const ABILITY_NAMES: Record<string, string> = { 'a.shadowstep': 'Shadowstep', 'a.fireball': 'Fireball', 'a.cleave': 'Cleave' };

const TELEGRAPHS: Record<string, AbilityCue['telegraph']> = {
  'a.fireball': { shape: 'circle', sizeCm: 260, spread: 0, minTicks: 6 },
  'a.cleave': { shape: 'cone', sizeCm: 320, spread: 1.2, minTicks: 6 },
  'a.beam': { shape: 'line', sizeCm: 700, spread: 120, minTicks: 6 },
};

const STATUS_CATEGORY: Record<string, string> = { 's.stun': 'cc_hard', 's.slow': 'cc_soft', 's.haste': 'buff', 's.weak': 'debuff', 's.burn': 'dot', 's.regen': 'hot', 's.mark': 'special', 's.ward': 'shield' };

/** A cue table with fixed answers (a real one comes from buildCueTable). */
export function fakeCues(): CueTable {
  const ability = (id: string): AbilityCue => ({
    ability: id as never,
    telegraph: TELEGRAPHS[id] ?? null,
    release: 'swing',
    effects: [],
    projectile: id === 'a.arrow' ? { sizePx: 12 } : null,
    tone: id === 'a.fireball' ? 'arcane' : 'physical',
    control: false,
  });
  const status = (id: string): StatusCue => {
    const category = STATUS_CATEGORY[id] ?? 'buff';
    const hard = category === 'cc_hard';
    return { status: id, category, icon: category, ring: hard ? 'grey' : 'none', priority: hard ? 10 : id === 's.mark' ? 2 : id === 's.ward' ? 1 : 5 };
  };
  return { ability, status };
}

/** A letterbox transform like the real one: the arena fits inside the padding, centred. */
export function fakeViewTransform(camera: CameraConfig, viewport: { width: number; height: number }, arenaCm: { width: number; height: number }): ViewTransform {
  const p = camera.padding;
  const availW = Math.max(1, viewport.width - p.left - p.right);
  const availH = Math.max(1, viewport.height - p.top - p.bottom);
  const k = Math.min(availW / arenaCm.width, availH / arenaCm.height);
  const ox = p.left + (availW - arenaCm.width * k) / 2;
  const oy = p.top + (availH - arenaCm.height * k) / 2;
  return {
    pxPerMetre: k * 100,
    toScreen: (x, y) => ({ x: ox + x * k, y: oy + y * k }),
    toWorld: (px, py) => ({ x: (px - ox) / k, y: (py - oy) / k }),
  };
}

const ROLES: readonly (readonly RoleId[])[] = [['tank'], ['melee'], ['ranged'], ['controller'], ['healer']];

export interface FakeContextOptions {
  kind?: 'live' | 'replay';
  startTick?: number;
  playerSide?: Side | null;
}

export function fakeColors(side: Side): TeamColors {
  return side === 0 ? { primary: 0x1a2d5a, secondary: 0xe8d9a0, ring: 0xe6b866, ringStyle: 'solid' } : { primary: 0x7a1f2b, secondary: 0xd9d9d9, ring: 0xa7b4c6, ringStyle: 'double' };
}

export function fakeContext(options: FakeContextOptions = {}): ArenaRoundContext {
  const units: ArenaUnitInfo[] = [];
  for (let i = 0; i < 10; i++) {
    const roles = i === 0 ? (['tank', 'healer'] as RoleId[]) : [...ROLES[i % 5]!];
    units.push({
      unit: i,
      side: (i < 5 ? 0 : 1) as Side,
      fighterId: `f${i}` as never,
      name: `Fighter ${i}`,
      classId: `class.${i % 5}` as never,
      className: ['Knight', 'Duelist', 'Archer', 'Warden', 'Medic'][i % 5]!,
      roles,
      raceId: 'human',
      isHiredBlade: false,
      entered: false,
      freshness: i === 2 ? 52 : i === 7 ? 28 : null,
      fatigueTag: i === 2 ? 'tired' : i === 7 ? 'spent' : null,
      ruleCount: 6,
    });
  }
  const side = (n: 0 | 1): ArenaRoundContext['sides'][number] => ({ clubId: (n === 0 ? 'c.home' : 'c.away') as never, name: n === 0 ? 'Home FC' : 'Away FC', shortName: n === 0 ? 'HOM' : 'AWY', colors: fakeColors(n) });
  return {
    fixtureId: 'fx1',
    round: 1,
    bestOf: 3,
    scoreBefore: { home: 0, away: 0 },
    playerSide: options.playerSide === undefined ? 0 : options.playerSide,
    sides: [side(0), side(1)],
    units,
    kind: options.kind ?? 'live',
    startTick: options.startTick ?? 0,
  };
}
