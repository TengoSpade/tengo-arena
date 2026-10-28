/**
 * Indexing: one pass over a full-level log builds the per-unit interval lists, frame table and effect list that
 * `sampleAt` and the queries read. PURE; never simulates and draws no randomness.
 *
 * Principle (no future leaks, review B1): every interval ends at the first of (its own planned end, a terminating
 * event). A sample at tick T treats an interval as active when start ≤ T < end, so it never depends on an event
 * with tick > T: a log truncated after T samples the same at T (tested), apart from positions that interpolate toward
 * the next frame.
 */
import type { ContentDB } from '../../core/content';
import type { AbilityId, FightEvent, FightLog, Side, UnitIndex, UnitSpawn } from '../../core/model';
import { InvariantError } from '../../core/util';
import { areaCenterOf, collectEffects } from '../cues';
import type { AbilityCue, CueTable, EffectKind, EffectRenderState, KeyMoment } from '../types';
import type { CaptainChange, CastRec, DecisionRec, DisplaceRec, DownRec, ProjectileRec, StatusSeg, TimelineData, ZoneRec } from './data';
import { COMPANION_ID_OFFSET, EFFECT_LIFETIME_TICKS, companionId, type EffectRec } from './effects';
import { MOVE_MIN_CM2, buildFrameTable, positionAt, type FrameTable, type Pos } from './frames';

/** A chain ability's later hits on other targets are arcs from the previous target while they follow its release within this many ticks. */
const CHAIN_WINDOW_TICKS = 40;

interface StatusInst {
  status: string;
  stacking: string;
  source: number;
  ability: string | null;
  endsTick: number;
  seg: StatusSeg;
}

interface ReleaseNote {
  unit: UnitIndex;
  side: Side;
  ability: AbilityId;
  cue: AbilityCue;
}

function sortedEvents(events: readonly FightEvent[]): readonly FightEvent[] {
  for (let i = 1; i < events.length; i++) {
    if (events[i]!.tick < events[i - 1]!.tick) return [...events].sort((a, b) => a.tick - b.tick || a.seq - b.seq);
  }
  return events;
}

/** Heading per frame: the direction of the last real movement, ignoring knockbacks and pulls (the unit does not turn for them). */
function computeHeadings(ft: FrameTable, sides: readonly Side[], displaces: readonly (readonly DisplaceRec[])[]): void {
  for (let u = 0; u < ft.heading.length; u++) {
    const xs = ft.x[u]!;
    const ys = ft.y[u]!;
    const out = ft.heading[u]!;
    const forced = displaces[u]!.filter((d) => d.kind === 'knockback' || d.kind === 'pull');
    let h = sides[u] === 1 ? Math.PI : 0;
    let fi = 0;
    for (let k = 0; k < ft.count; k++) {
      if (k > 0) {
        const t0 = ft.ticks[k - 1]!;
        const t1 = ft.ticks[k]!;
        while (fi < forced.length && forced[fi]!.end <= t0) fi++;
        let pushed = false;
        for (let j = fi; j < forced.length && forced[j]!.start < t1; j++) if (forced[j]!.end > t0) pushed = true;
        const dx = xs[k]! - xs[k - 1]!;
        const dy = ys[k]! - ys[k - 1]!;
        if (!pushed && dx * dx + dy * dy >= MOVE_MIN_CM2) h = Math.atan2(dy, dx);
      }
      out[k] = h;
    }
  }
}

export function buildTimelineData(log: FightLog, content: ContentDB, cues: CueTable, kind: 'live' | 'replay'): TimelineData {
  const header = log.header;
  const events = sortedEvents(log.events);
  const unitCount = header.units.reduce((m, u) => Math.max(m, u.index + 1), 0);
  if (unitCount === 0) throw new InvariantError('indexFightLog: the log header has no units');
  if (events.length >= COMPANION_ID_OFFSET) throw new InvariantError(`indexFightLog: a log of ${events.length} events exceeds the effect id space`);

  let startEvent: Extract<FightEvent, { type: 'fight.start' }> | null = null;
  const frameEvents: FightEvent[] = [];
  for (const ev of events) {
    if (ev.type === 'fight.start' && !startEvent) startEvent = ev;
    else if (ev.type === 'frame') frameEvents.push(ev);
  }
  if (!startEvent?.data) throw new InvariantError('indexFightLog: the log has no fight.start; the viewer needs a full-level log (record: full)');
  if (frameEvents.length === 0) throw new InvariantError('indexFightLog: the log has no frame events; the viewer needs a full-level log (record: full), not a summary');

  const spawns: readonly UnitSpawn[] = startEvent.data.units;
  const sides: Side[] = Array.from({ length: unitCount }, () => 0 as Side);
  const classOf: (string | null)[] = Array.from({ length: unitCount }, () => null);
  for (const u of header.units) {
    sides[u.index] = u.side;
    classOf[u.index] = u.classId;
  }
  const maxHp: number[] = Array.from({ length: unitCount }, () => 0);
  for (const s of spawns) maxHp[s.unit] = s.maxHp;

  const frames = buildFrameTable(frameEvents, spawns, unitCount);
  const tickSeconds = header.tickMs / 1000;
  const tps = 1000 / header.tickMs;
  const ticksOf = (seconds: number): number => Math.max(1, Math.round(seconds * tps));

  const casts: CastRec[][] = Array.from({ length: unitCount }, () => []);
  const displaces: DisplaceRec[][] = Array.from({ length: unitCount }, () => []);
  const statuses: StatusSeg[][] = Array.from({ length: unitCount }, () => []);
  const decisions: DecisionRec[][] = Array.from({ length: unitCount }, () => []);
  const hitTicks: number[][] = Array.from({ length: unitCount }, () => []);
  const downTick: (number | null)[] = Array.from({ length: unitCount }, () => null);
  const openCast: (CastRec | null)[] = Array.from({ length: unitCount }, () => null);
  const openInst: StatusInst[][] = Array.from({ length: unitCount }, () => []);
  const projectiles: ProjectileRec[] = [];
  const zones: ZoneRec[] = [];
  const openZones: ZoneRec[][] = Array.from({ length: unitCount }, () => []);
  const effects: EffectRec[] = [];
  const moments: KeyMoment[] = [];
  const downs: DownRec[] = [];
  const captainDowns: DownRec[] = [];
  const captains: [CaptainChange[], CaptainChange[]] = [[{ tick: -1, unit: null }], [{ tick: -1, unit: null }]];
  for (const u of header.units) if (u.isCaptain) captains[u.side][0] = { tick: -1, unit: u.index };
  let overtimeTick: number | null = null;
  let overtimeSeq = -1;
  let endTick: number | null = null;
  let lastTick = frames.ticks[frames.count - 1]!;

  const pos: Pos = { x: 0, y: 0 };
  const at = (unit: number | undefined, tick: number): Pos => {
    if (unit === undefined || unit < 0 || unit >= unitCount) {
      pos.x = 0;
      pos.y = 0;
      return pos;
    }
    positionAt(frames, unit, tick, pos);
    return pos;
  };

  const cueOf = (ability: string | null | undefined): AbilityCue | null => {
    if (!ability) return null;
    return content.abilities.has(ability) ? cues.ability(ability as AbilityId) : null;
  };

  const pushEffect = (
    kindOf: EffectKind,
    ev: FightEvent,
    slot: number,
    where: { x: number; y: number },
    fields: { unit?: number | null; target?: number | null; ability?: AbilityId | null; amount?: number | null; crit?: boolean; tone?: EffectRenderState['tone']; life?: number } = {},
  ): EffectRec => {
    const rec: EffectRec = {
      id: companionId(ev.seq, slot),
      kind: kindOf,
      unit: fields.unit === undefined ? (ev.unit ?? null) : fields.unit,
      target: fields.target === undefined ? (ev.target ?? null) : fields.target,
      ability: fields.ability ?? null,
      x: where.x,
      y: where.y,
      amount: fields.amount ?? null,
      crit: fields.crit ?? false,
      tone: fields.tone ?? 'neutral',
      tick: ev.tick,
      end: ev.tick + Math.max(1, fields.life ?? EFFECT_LIFETIME_TICKS[kindOf]),
    };
    effects.push(rec);
    return rec;
  };

  /** End a unit's open windup, cast or channel at `tick`. */
  const closeOpen = (unit: number, tick: number): void => {
    const c = openCast[unit];
    if (!c) return;
    if (tick < c.end) c.end = Math.max(c.start, tick);
    openCast[unit] = null;
  };
  const beginCast = (unit: number, rec: CastRec): void => {
    closeOpen(unit, rec.start);
    openCast[unit] = rec;
    casts[unit]!.push(rec);
  };

  // ---- status bookkeeping --------------------------------------------------------------------------------
  const incapacitation = (status: string): StatusSeg['incapacitates'] => {
    const def = content.statuses.get(status);
    const blocks = def?.blocks ?? [];
    if (!blocks.includes('move') || !blocks.includes('attack') || !blocks.includes('ability')) return null;
    return def?.breakOnDamagePct !== undefined ? 'asleep' : 'stunned';
  };
  const newSeg = (status: string, category: string, stacking: string, tick: number, appliedTick: number, endsTick: number, stacks: number, seq: number): StatusSeg => ({
    status,
    category,
    from: tick,
    to: Infinity,
    appliedTick,
    endsTick,
    stacks,
    stacking,
    seq,
    incapacitates: incapacitation(status),
  });
  const closeInst = (unit: number, inst: StatusInst, tick: number): void => {
    inst.seg.to = Math.max(inst.seg.from, tick);
    const list = openInst[unit]!;
    const i = list.indexOf(inst);
    if (i >= 0) list.splice(i, 1);
  };
  const closeAllStatuses = (unit: number, tick: number): void => {
    for (const inst of [...openInst[unit]!]) closeInst(unit, inst, tick);
  };

  let releaseTick = -1;
  let releases: ReleaseNote[] = [];
  const cleansed = new Set<string>();
  const chainWatch = new Map<number, { ability: AbilityId; until: number; last: number }>();

  const keyMoment = (ev: FightEvent, momentKind: KeyMoment['kind'], unit: number | null, target: number | null, ability: AbilityId | null): void => {
    moments.push({ tick: ev.tick, seq: ev.seq, kind: momentKind, unit, target, ability });
  };

  for (const ev of events) {
    if (ev.tick > lastTick) lastTick = ev.tick;
    if (ev.tick !== releaseTick) {
      releaseTick = ev.tick;
      releases = [];
      cleansed.clear();
    }
    switch (ev.type) {
      case 'unit.decide': {
        const u = ev.unit;
        if (u === undefined || !ev.data || u >= unitCount) break;
        decisions[u]!.push({ tick: ev.data.commitTick ?? ev.tick, seq: ev.seq, event: ev });
        break;
      }
      case 'attack.start': {
        const u = ev.unit;
        if (u === undefined || !ev.data || u >= unitCount) break;
        const classId = classOf[u];
        if (!classId) break;
        const basic = content.classAbility(classId, 'basic');
        const planned = ev.tick + Math.max(1, ev.data.windupTicks);
        beginCast(u, { kind: 'windup', ability: basic.id as AbilityId, start: ev.tick, planned, end: planned, target: ev.target ?? null, center: null });
        break;
      }
      case 'attack.cancel': {
        if (ev.unit !== undefined && ev.unit < unitCount) closeOpen(ev.unit, ev.tick);
        break;
      }
      case 'cast.start': {
        const u = ev.unit;
        if (u === undefined || !ev.data || u >= unitCount) break;
        if (ev.data.castTicks <= 0) {
          closeOpen(u, ev.tick);
          break;
        }
        const def = content.abilities.get(ev.data.ability);
        const planned = ev.tick + ev.data.castTicks;
        beginCast(u, { kind: 'cast', ability: ev.data.ability, start: ev.tick, planned, end: planned, target: ev.target ?? null, center: def ? areaCenterOf(def) : null });
        break;
      }
      case 'cast.release': {
        const u = ev.unit;
        if (u === undefined || !ev.data || u >= unitCount) break;
        const ability = ev.data.ability;
        closeOpen(u, ev.tick);
        const def = content.abilities.get(ability);
        const cue = cueOf(ability);
        const target = ev.target ?? u;
        if (def?.channel) {
          const planned = ev.tick + ticksOf(def.channel.durationS);
          beginCast(u, { kind: 'channel', ability, start: ev.tick, planned, end: planned, target: ev.target ?? null, center: areaCenterOf(def) });
        }
        if (!cue) break;
        releases.push({ unit: u, side: sides[u]!, ability, cue });
        if (cue.effects.some((e) => e.type === 'chain')) chainWatch.set(u, { ability, until: ev.tick + CHAIN_WINDOW_TICKS, last: target });
        switch (cue.release) {
          case 'swing':
            pushEffect('swing', ev, 0, at(target, ev.tick), { unit: u, target, ability, tone: cue.tone });
            break;
          case 'beam':
            pushEffect('beam', ev, 0, at(target, ev.tick), { unit: u, target, ability, tone: cue.tone });
            break;
          case 'area-flash': {
            const centre = def?.area?.center === 'target' ? target : u;
            pushEffect('splash', ev, 0, at(centre, ev.tick), { unit: u, target, ability, tone: cue.tone });
            break;
          }
          case 'self-pulse':
            pushEffect('splash', ev, 0, at(u, ev.tick), { unit: u, target: u, ability, tone: cue.tone });
            break;
          case 'projectile':
          case 'dash-trail':
          case 'none':
            break;
        }
        if (cue.effects.some((e) => e.type === 'splash') && cue.release !== 'area-flash' && cue.release !== 'self-pulse') {
          pushEffect('splash', ev, 2, at(target, ev.tick), { unit: u, target, ability, tone: cue.tone });
        }
        if (cue.effects.some((e) => e.type === 'guard') && def) {
          const guard = collectEffects(def).find((e) => e.type === 'guard');
          if (guard && guard.type === 'guard' && target !== u) {
            pushEffect('guard-link', ev, 0, at(target, ev.tick), { unit: u, target, ability, life: ticksOf(guard.durationS) });
          }
        }
        break;
      }
      case 'cast.interrupt': {
        const u = ev.unit;
        if (u === undefined || !ev.data || u >= unitCount) break;
        closeOpen(u, ev.tick);
        if (ev.data.by !== null) {
          pushEffect('interrupt', ev, 0, at(u, ev.tick), { unit: ev.data.by, target: u, ability: ev.data.ability });
          keyMoment(ev, 'interrupt', ev.data.by, u, ev.data.ability);
        }
        break;
      }
      case 'projectile.launch': {
        const u = ev.unit;
        if (u === undefined || !ev.data || u >= unitCount) break;
        const p = at(u, ev.tick);
        projectiles.push({
          id: ev.seq,
          ability: ev.data.ability,
          source: u,
          target: ev.target ?? null,
          launch: ev.tick,
          land: Math.max(ev.data.landTick, ev.tick + 1),
          sx: p.x,
          sy: p.y,
        });
        break;
      }
      case 'hit': {
        const recv = ev.target;
        const d = ev.data;
        if (recv === undefined || !d || recv >= unitCount) break;
        hitTicks[recv]!.push(ev.tick);
        const where = at(recv, ev.tick);
        const ability = d.ability;
        pushEffect('impact', ev, 0, where, { unit: ev.unit ?? null, target: recv, ability, crit: d.crit, tone: d.damageType });
        const total = d.amount + d.toShield;
        if (total > 0) pushEffect('number', ev, 1, where, { unit: ev.unit ?? null, target: recv, ability, amount: total, crit: d.crit, tone: d.damageType });
        const watch = ev.unit === undefined ? undefined : chainWatch.get(ev.unit);
        if (watch && watch.ability === ability && ev.tick <= watch.until) {
          if (recv !== watch.last) {
            pushEffect('chain-arc', ev, 2, where, { unit: watch.last, target: recv, ability, tone: d.damageType });
            watch.last = recv;
          }
        }
        break;
      }
      case 'evade': {
        if (ev.unit === undefined || ev.unit >= unitCount) break;
        pushEffect('evade', ev, 0, at(ev.unit, ev.tick), { unit: ev.unit, target: ev.target ?? null, ability: ev.data?.ability ?? null });
        break;
      }
      case 'heal': {
        const healed = ev.target;
        const d = ev.data;
        if (healed === undefined || !d || healed >= unitCount || d.amount <= 0) break;
        const where = at(healed, ev.tick);
        pushEffect('heal-pulse', ev, 0, where, { unit: ev.unit ?? null, target: healed, ability: d.ability, tone: 'heal' });
        pushEffect('number', ev, 1, where, { unit: ev.unit ?? null, target: healed, ability: d.ability, amount: d.amount, tone: 'heal' });
        break;
      }
      case 'shield.gain': {
        if (ev.unit === undefined || ev.unit >= unitCount || !ev.data) break;
        pushEffect('shield-gain', ev, 0, at(ev.unit, ev.tick), { unit: ev.target ?? null, target: ev.unit, ability: ev.data.ability, tone: 'shield' });
        break;
      }
      case 'shield.break': {
        if (ev.unit === undefined || ev.unit >= unitCount) break;
        pushEffect('shield-break', ev, 0, at(ev.unit, ev.tick), { unit: ev.target ?? null, target: ev.unit, tone: 'shield' });
        break;
      }
      case 'status.apply': {
        const u = ev.unit;
        const d = ev.data;
        if (u === undefined || !d || u >= unitCount) break;
        const def = content.statuses.get(d.status);
        const stacking = def?.stacking ?? 'refresh';
        const category = def?.category ?? 'special';
        const source = ev.target ?? -1;
        const ability = d.ability ?? null;
        const ends = ev.tick + d.durationTicks;
        const list = openInst[u]!;
        let inst = list.find((i) => i.status === d.status && (stacking === 'refresh' || stacking === 'latest' || (i.source === source && i.ability === ability))) ?? null;
        if (inst && stacking === 'latest') {
          closeInst(u, inst, ev.tick);
          inst = null;
        }
        if (inst) {
          // A refresh or another stack: a new version of the instance (its first application stays the applied tick).
          const applied = inst.seg.appliedTick;
          inst.seg.to = Math.max(inst.seg.from, ev.tick);
          inst.endsTick = Math.max(inst.endsTick, ends);
          inst.seg = newSeg(inst.status, category, stacking, ev.tick, applied, inst.endsTick, d.stacks, ev.seq);
          statuses[u]!.push(inst.seg);
        } else {
          const seg = newSeg(d.status, category, stacking, ev.tick, ev.tick, ends, d.stacks, ev.seq);
          statuses[u]!.push(seg);
          list.push({ status: d.status, stacking, source, ability, endsTick: ends, seg });
        }
        // Applied by an ability (not by the captain model): a flash on the target. Control reads stronger through the ability's cue.
        if (ability !== null) pushEffect('status-apply', ev, 0, at(u, ev.tick), { unit: ev.target ?? null, target: u, ability });
        break;
      }
      case 'status.expire': {
        const u = ev.unit;
        const d = ev.data;
        if (u === undefined || !d || u >= unitCount) break;
        const candidates = openInst[u]!.filter((i) => i.status === d.status);
        if (candidates.length === 0) break;
        const natural = candidates.filter((i) => i.endsTick < ev.tick).sort((a, b) => a.endsTick - b.endsTick);
        const pick = natural[0] ?? [...candidates].sort((a, b) => b.endsTick - a.endsTick)[0]!;
        closeInst(u, pick, ev.tick);
        if (ev.tick <= pick.endsTick) {
          // Removed before its time. A cleanse or dispel when a release of this very tick carries one; damage-broken sleep and consumed stacks do not.
          const def = content.statuses.get(d.status);
          if (def && def.breakOnDamagePct === undefined) {
            for (const r of releases) {
              const wantKind: EffectKind | null =
                def.polarity === 'debuff' && sides[u] === r.side && r.cue.effects.some((e) => e.type === 'cleanse')
                  ? 'cleanse'
                  : def.polarity === 'buff' && sides[u] !== r.side && r.cue.effects.some((e) => e.type === 'dispel')
                    ? 'dispel'
                    : null;
              if (!wantKind) continue;
              const key = `${wantKind}:${u}`;
              if (cleansed.has(key)) break;
              cleansed.add(key);
              pushEffect(wantKind, ev, 0, at(u, ev.tick), { unit: r.unit, target: u, ability: r.ability });
              break;
            }
          }
        }
        break;
      }
      case 'status.resist': {
        if (ev.unit === undefined || ev.unit >= unitCount) break;
        pushEffect('status-resist', ev, 0, at(ev.unit, ev.tick), { unit: ev.target ?? null, target: ev.unit });
        break;
      }
      case 'displace': {
        const u = ev.unit;
        const d = ev.data;
        if (u === undefined || !d || u >= unitCount) break;
        const ticks = Math.max(1, d.ticks);
        displaces[u]!.push({ kind: d.kind, start: ev.tick, end: ev.tick + ticks });
        const life = Math.max(6, ticks + 4);
        const from = { x: d.from[0], y: d.from[1] };
        if (d.kind === 'dash' || d.kind === 'leap') pushEffect('dash-trail', ev, 0, from, { unit: u, target: ev.target ?? null, life });
        else pushEffect('displace', ev, 0, from, { unit: u, target: ev.target ?? null, life });
        break;
      }
      case 'zone.spawn': {
        const owner = ev.unit;
        const d = ev.data;
        if (owner === undefined || !d || owner >= unitCount) break;
        const def = content.abilities.get(d.ability);
        const zoneEffects = def ? collectEffects(def).flatMap((e) => (e.type === 'zone' ? [e.zone] : [])) : [];
        const zone = zoneEffects.find((z) => Math.round(z.radiusM * 100) === d.radius) ?? zoneEffects[0] ?? null;
        const mine = openZones[owner]!.filter((z) => z.ability === d.ability);
        if (zone?.maxActive != null && mine.length >= zone.maxActive) {
          // The oldest zone of this ability is replaced without an expire event.
          const oldest = mine[0]!;
          oldest.expire = ev.tick;
          openZones[owner]!.splice(openZones[owner]!.indexOf(oldest), 1);
        }
        const rec: ZoneRec = {
          id: ev.seq,
          ability: d.ability,
          owner,
          side: sides[owner]!,
          x: d.x,
          y: d.y,
          radius: d.radius,
          spawn: ev.tick,
          expire: Infinity,
          endsTick: zone ? ev.tick + ticksOf(zone.durationS) : null,
          follow: zone?.follow === 'caster',
        };
        zones.push(rec);
        openZones[owner]!.push(rec);
        break;
      }
      case 'zone.expire': {
        const owner = ev.unit;
        if (owner === undefined || owner >= unitCount) break;
        const list = openZones[owner]!;
        if (list.length === 0) break;
        let best = list[0]!;
        for (const z of list) if ((z.endsTick ?? Infinity) < (best.endsTick ?? Infinity)) best = z;
        best.expire = ev.tick;
        list.splice(list.indexOf(best), 1);
        break;
      }
      case 'zone.trigger': {
        const owner = ev.unit;
        if (owner === undefined || owner >= unitCount) break;
        const list = openZones[owner]!;
        if (list.length === 0) break;
        const who = at(ev.target, ev.tick);
        const wx = who.x;
        const wy = who.y;
        let best = list[0]!;
        let bestD = Infinity;
        for (const z of list) {
          const zp = z.follow ? at(owner, ev.tick) : { x: z.x, y: z.y };
          const dd = (zp.x - wx) ** 2 + (zp.y - wy) ** 2;
          if (dd < bestD) {
            bestD = dd;
            best = z;
          }
        }
        const c = best.follow ? at(owner, ev.tick) : { x: best.x, y: best.y };
        pushEffect('zone-trigger', ev, 0, { x: c.x, y: c.y }, { unit: owner, target: ev.target ?? null, ability: best.ability });
        break;
      }
      case 'unit.down': {
        const u = ev.unit;
        const d = ev.data;
        if (u === undefined || !d || u >= unitCount) break;
        if (downTick[u] === null) downTick[u] = ev.tick;
        downs.push({ tick: ev.tick, seq: ev.seq, unit: u, side: sides[u]! });
        closeOpen(u, ev.tick);
        for (let o = 0; o < unitCount; o++) {
          const c = openCast[o];
          if (c && c.kind === 'channel' && c.target === u) closeOpen(o, ev.tick);
        }
        closeAllStatuses(u, ev.tick);
        for (const z of openZones[u]!.filter((zz) => zz.follow)) {
          z.expire = ev.tick;
          openZones[u]!.splice(openZones[u]!.indexOf(z), 1);
        }
        pushEffect('down', ev, 0, at(u, ev.tick), { unit: u, target: d.by, ability: d.ability });
        keyMoment(ev, 'down', d.by, u, d.ability);
        break;
      }
      case 'deathward.save': {
        const u = ev.unit;
        if (u === undefined || u >= unitCount) break;
        pushEffect('deathward', ev, 0, at(u, ev.tick), { unit: u, target: ev.data?.by ?? null });
        keyMoment(ev, 'deathward', ev.data?.by ?? null, u, null);
        break;
      }
      case 'captain.rally': {
        const u = ev.unit;
        if (u === undefined || u >= unitCount) break;
        pushEffect('rally', ev, 0, at(u, ev.tick), { unit: u, target: null });
        keyMoment(ev, 'rally', u, null, null);
        break;
      }
      case 'captain.down': {
        const u = ev.unit;
        if (u === undefined || u >= unitCount) break;
        captains[sides[u]!].push({ tick: ev.tick, unit: null });
        captainDowns.push({ tick: ev.tick, seq: ev.seq, unit: u, side: sides[u]! });
        pushEffect('captain-down', ev, 0, at(u, ev.tick), { unit: u, target: null });
        keyMoment(ev, 'captain-down', u, null, null);
        break;
      }
      case 'captain.handover': {
        const u = ev.data?.newCaptain ?? ev.unit;
        if (u === undefined || u >= unitCount) break;
        captains[sides[u]!].push({ tick: ev.tick, unit: u });
        keyMoment(ev, 'handover', u, null, null);
        break;
      }
      case 'overtime.start': {
        if (overtimeTick === null) {
          overtimeTick = ev.tick;
          overtimeSeq = ev.seq;
        }
        keyMoment(ev, 'overtime', null, null, null);
        break;
      }
      case 'call.issue': {
        const u = ev.unit;
        if (u === undefined || u >= unitCount) break;
        pushEffect('call', ev, 0, at(u, ev.tick), { unit: u, target: ev.data?.target ?? null });
        keyMoment(ev, 'call', u, ev.data?.target ?? null, null);
        break;
      }
      case 'fight.end': {
        if (endTick === null) endTick = ev.tick;
        keyMoment(ev, 'end', null, null, null);
        break;
      }
      case 'fight.start':
      case 'frame':
      case 'perk.proc':
      case 'round.summary':
        break;
      default: {
        // An event type this build does not know (a newer log format): ignored, never fatal.
        break;
      }
    }
  }

  // Guard links end when either fighter goes down.
  for (const e of effects) {
    if (e.kind !== 'guard-link') continue;
    for (const u of [e.unit, e.target]) {
      const d = u === null ? null : downTick[u];
      if (d !== null && d !== undefined && d >= e.tick && d < e.end) e.end = d;
    }
  }
  // Projectiles' flights and effects' lifetimes bound the windows a sample scans.
  let maxFlight = 1;
  for (const p of projectiles) maxFlight = Math.max(maxFlight, p.land - p.launch);
  let maxEffectLife = 1;
  for (const e of effects) maxEffectLife = Math.max(maxEffectLife, e.end - e.tick);

  computeHeadings(frames, sides, displaces);

  const decisionsSorted = decisions.map((list) => (list.every((d, i) => i === 0 || d.tick >= list[i - 1]!.tick) ? list : [...list].sort((a, b) => a.tick - b.tick || a.seq - b.seq)));

  const eventTicks = new Float64Array(events.length);
  for (let i = 0; i < events.length; i++) eventTicks[i] = events[i]!.tick;
  const effectTicks = new Float64Array(effects.length);
  for (let i = 0; i < effects.length; i++) effectTicks[i] = effects[i]!.tick;
  const momentTicks = new Float64Array(moments.length);
  for (let i = 0; i < moments.length; i++) momentTicks[i] = moments[i]!.tick;

  return {
    header,
    kind,
    logFormat: header.logFormat ?? 1,
    events,
    eventTicks,
    unitCount,
    sides,
    maxHp,
    frames,
    casts,
    displaces,
    statuses,
    decisions: decisionsSorted,
    hitTicks,
    downTick,
    projectiles,
    maxFlight,
    zones,
    effects,
    effectTicks,
    maxEffectLife,
    captains,
    overtimeTick,
    overtimeSeq,
    endTick,
    lastTick,
    moments,
    momentTicks,
    downs,
    captainDowns,
    cues,
    tickSeconds,
  };
}
