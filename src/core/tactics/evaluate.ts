/**
 * Rule evaluation and deterministic targeting (03 sys-tactics, sys-targeting).
 *
 * Pure: reads only the BattleView, never mutates it, never draws randomness.
 * First valid rule wins; the stance is the unremovable fallback. Every rule
 * before the chosen one records its first failing check, in the published
 * order: rule_cooldown -> cond_false -> cooldown -> no_focus -> silenced ->
 * no_target -> out_of_range.
 */
import type { UnitIndex } from '../model';
import type { CAction, CCond, CPredicate, CRule, CSelector, CompiledInternal } from './compile';
import type { BattleView, Decision, Evaluation, TraceEntry } from './index';

/** Observed value of the last condition checked (trace detail), reset per condition. */
let observed: number | null = null;

const NO_UNIT = -1;

function isEnemy(view: BattleView, me: UnitIndex, other: UnitIndex): boolean {
  return view.side(other) !== view.side(me);
}

function hasStatusOrCategory(view: BattleView, unit: UnitIndex, status: string | null, category: string | null): boolean {
  if (status !== null) return view.hasStatus(unit, status);
  if (category !== null) return view.hasStatusCategory(unit, category);
  return false;
}

function hasRole(view: BattleView, unit: UnitIndex, role: string | null): boolean {
  if (role === null) return true;
  const roles = view.roles(unit);
  for (const r of roles) if (r === role) return true;
  return false;
}

/** The enemy a unit is aiming at (its committed target when that is an enemy). */
function aimOf(view: BattleView, unit: UnitIndex): UnitIndex | null {
  const t = view.currentTarget(unit);
  if (t === null || !view.standing(t) || !isEnemy(view, unit, t)) return null;
  return t;
}

function nearestEnemyGap(view: BattleView, me: UnitIndex): number {
  let best = Number.MAX_SAFE_INTEGER;
  for (let u = 0; u < view.unitCount; u++) {
    if (!view.standing(u) || !isEnemy(view, me, u)) continue;
    const g = view.gapMm(me, u);
    if (g < best) best = g;
  }
  return best;
}

// ---- Conditions --------------------------------------------------------------------------

function checkCond(c: CCond, view: BattleView, me: UnitIndex): boolean {
  observed = null;
  const side = view.side(me);
  const n = view.unitCount;
  switch (c.code) {
    case 0: // always
      return true;
    case 1: // self_hp_below
      observed = view.hpBp(me);
      return observed < c.hpBp;
    case 2: { // ally_hp_below
      let low = Number.MAX_SAFE_INTEGER;
      for (let u = 0; u < n; u++) {
        if (!view.standing(u) || view.side(u) !== side || (u === me && !c.includeSelf)) continue;
        const hp = view.hpBp(u);
        if (hp < low) low = hp;
      }
      observed = low === Number.MAX_SAFE_INTEGER ? null : low;
      return low < c.hpBp;
    }
    case 3: { // allies_hp_below
      let count = 0;
      for (let u = 0; u < n; u++) {
        if (!view.standing(u) || view.side(u) !== side) continue;
        if (c.bandMm >= 0 && u !== me && view.gapMm(me, u) > c.bandMm) continue;
        if (view.hpBp(u) < c.hpBp) count++;
      }
      observed = count;
      return count >= c.count;
    }
    case 4: { // enemy_hp_below
      let low = Number.MAX_SAFE_INTEGER;
      for (let u = 0; u < n; u++) {
        if (!view.standing(u) || view.side(u) === side) continue;
        if (c.bandMm >= 0 && view.gapMm(me, u) > c.bandMm) continue;
        const hp = view.hpBp(u);
        if (hp < low) low = hp;
      }
      observed = low === Number.MAX_SAFE_INTEGER ? null : low;
      return low < c.hpBp;
    }
    case 5: { // enemy_within
      const g = nearestEnemyGap(view, me);
      observed = g === Number.MAX_SAFE_INTEGER ? null : g;
      return g <= c.bandMm;
    }
    case 6: { // enemies_within
      let count = 0;
      for (let u = 0; u < n; u++) {
        if (view.standing(u) && view.side(u) !== side && view.gapMm(me, u) <= c.bandMm) count++;
      }
      observed = count;
      return count >= c.count;
    }
    case 7: // enemies_clustered
    case 8: { // allies_clustered
      const wantSide = c.code === 7 ? (side === 0 ? 1 : 0) : side;
      let best = 0;
      for (let u = 0; u < n; u++) {
        if (!view.standing(u) || view.side(u) !== wantSide) continue;
        const k = 1 + view.neighboursWithin(u, c.radiusMm, wantSide);
        if (k > best) best = k;
      }
      observed = best;
      return best >= c.count;
    }
    case 9: { // self_targeted
      const k = view.targetersOf(me).length;
      observed = k;
      return k >= c.count;
    }
    case 10: { // ally_targeted
      let best = 0;
      for (let u = 0; u < n; u++) {
        if (u === me || !view.standing(u) || view.side(u) !== side || !hasRole(view, u, c.role)) continue;
        const k = view.targetersOf(u).length;
        if (k > best) best = k;
      }
      observed = best;
      return best >= c.count;
    }
    case 11: { // enemy_casting
      for (let u = 0; u < n; u++) {
        if (view.standing(u) && view.side(u) !== side && view.isCasting(u) && view.gapMm(me, u) <= c.bandMm) return true;
      }
      return false;
    }
    case 12: // self_has_status
      return hasStatusOrCategory(view, me, c.status, c.category);
    case 13: { // ally_has_status
      for (let u = 0; u < n; u++) {
        if (view.standing(u) && view.side(u) === side && hasStatusOrCategory(view, u, c.status, c.category)) return true;
      }
      return false;
    }
    case 14: { // enemy_has_status
      for (let u = 0; u < n; u++) {
        if (!view.standing(u) || view.side(u) === side) continue;
        if (c.bandMm >= 0 && view.gapMm(me, u) > c.bandMm) continue;
        if (hasStatusOrCategory(view, u, c.status, c.category)) return true;
      }
      return false;
    }
    case 15: // fight_time_below
      observed = view.fightTicks;
      return view.fightTicks < c.ticks;
    case 16: // focus_at_least
      observed = view.focus(me);
      return observed >= c.amount;
    case 17: { // outnumbered
      const mine = view.standingCount(side);
      const theirs = view.standingCount(side === 0 ? 1 : 0);
      observed = mine - theirs;
      return mine < theirs;
    }
    case 18: // allies_down
      observed = view.downedCount(side);
      return observed >= c.count;
    case 19: { // enemy_role_within
      for (let u = 0; u < n; u++) {
        if (view.standing(u) && view.side(u) !== side && hasRole(view, u, c.role) && view.gapMm(me, u) <= c.bandMm) return true;
      }
      return false;
    }
    case 20: // captain_alive
      return view.captainOf(side) !== null;
    default:
      return false;
  }
}

// ---- Predicates (ONLY / PREFER) -------------------------------------------------------------

function checkPred(p: CPredicate, view: BattleView, me: UnitIndex, cand: UnitIndex, action: CAction): boolean {
  switch (p.code) {
    case 0: // in_range
      return inActionRange(view, me, cand, action);
    case 1: // within
      return view.gapMm(me, cand) <= p.bandMm;
    case 2: // hp_below
      return view.hpBp(cand) < p.hpBp;
    case 3: // hp_above
      return view.hpBp(cand) > p.hpBp;
    case 4: // has_status
      if (p.status !== null) return view.statusStacks(cand, p.status) >= p.minStacks;
      return hasStatusOrCategory(view, cand, null, p.category);
    case 5: // lacks_status
      return !hasStatusOrCategory(view, cand, p.status, p.category);
    case 6: // has_buff
      return view.hasBuff(cand);
    case 7: // role
      return hasRole(view, cand, p.role);
    case 8: // not_role
      return !hasRole(view, cand, p.role);
    case 9: { // not_targeted_by_ally
      const side = view.side(me);
      for (const t of view.targetersOf(cand)) if (view.side(t) === side && t !== me) return false;
      return true;
    }
    case 10: // targeting_me
      return aimOf(view, cand) === me;
    case 11: // not_self
      return cand !== me;
    default:
      return false;
  }
}

function inActionRange(view: BattleView, me: UnitIndex, cand: UnitIndex, action: CAction): boolean {
  if (action.type === 'ability' && action.slot !== null) return view.abilityInRange(me, action.slot, cand);
  if (cand === me) return true;
  return view.basicInRange(me, cand);
}

// ---- Selectors -----------------------------------------------------------------------------


/** Scratch buffers (fixed size, explicit counts: no array length writes in the hot path). */
const MAX_UNITS = 64;
const candidates = new Int32Array(MAX_UNITS);
const keys = new Float64Array(MAX_UNITS);
const preferred = new Int32Array(MAX_UNITS);
const preferredKeys = new Float64Array(MAX_UNITS);
let nCand = 0;

function buildPool(sel: CSelector, action: CAction, selfOk: boolean, view: BattleView, me: UnitIndex): void {
  nCand = 0;
  const side = view.side(me);
  const pool = action.pool === 'any' ? sel.pool : action.pool;
  if (pool === 'self') {
    candidates[nCand++] = me;
    return;
  }
  const n = view.unitCount;
  for (let u = 0; u < n; u++) {
    if (!view.standing(u)) continue;
    if (pool === 'enemies') {
      if (view.side(u) !== side) candidates[nCand++] = u;
    } else if (view.side(u) === side) {
      if (u === me && !selfOk) continue;
      candidates[nCand++] = u;
    }
  }
}

function hasCandidate(u: UnitIndex): boolean {
  for (let i = 0; i < nCand; i++) if (candidates[i] === u) return true;
  return false;
}

/** Selector filter (before ONLY); returns whether the candidate stays. */
function selectorFilter(sel: CSelector, view: BattleView, me: UnitIndex, cand: UnitIndex): boolean {
  switch (sel.code) {
    case 5: // enemy_targeting_me
      return aimOf(view, cand) === me;
    case 6: { // enemy_targeting_ally
      const victim = aimOf(view, cand);
      return victim !== null && victim !== me && hasRole(view, victim, sel.role);
    }
    case 7: // casting_enemy
      return view.isCasting(cand);
    case 10: // marked_enemy
      return view.hasStatus(cand, 'marked');
    case 11: // enemy_role
    case 14: // ally_role
      return hasRole(view, cand, sel.role);
    case 12: // lowest_hp_ally
      return sel.withinMm < 0 || cand === me || view.gapMm(me, cand) <= sel.withinMm;
    default:
      return true;
  }
}

function primaryKey(sel: CSelector, view: BattleView, me: UnitIndex, cand: UnitIndex): number {
  switch (sel.code) {
    case 1: // nearest_enemy
    case 5: // enemy_targeting_me
    case 7: // casting_enemy
    case 10: // marked_enemy
    case 11: // enemy_role
    case 14: // ally_role
      return view.gapMm(me, cand);
    case 2: // furthest_enemy
      return -view.gapMm(me, cand);
    case 3: // lowest_hp_enemy
    case 12: // lowest_hp_ally
      return view.hpBp(cand);
    case 4: // top_damage_enemy
      return -view.damageDealt(cand);
    case 6: { // enemy_targeting_ally
      const victim = aimOf(view, cand);
      return victim === null ? Number.MAX_SAFE_INTEGER : view.hpBp(victim);
    }
    case 8: // densest_enemy
    case 15: // densest_ally
      return -view.neighboursWithin(cand, sel.radiusMm, view.side(cand));
    case 13: // most_targeted_ally
      return -view.targetersOf(cand).length;
    default:
      return 0;
  }
}

/** Published tie-breaks: primary key, stickiness, smaller gap, lower HP fraction, lower slot. */
function pickBest(
  ct: CompiledInternal,
  sel: CSelector,
  view: BattleView,
  me: UnitIndex,
  pool: Int32Array,
  poolKeys: Float64Array,
  count: number,
): UnitIndex {
  let best = NO_UNIT;
  let bestKey = 0;
  let bestGap = 0;
  let bestHp = 0;
  for (let i = 0; i < count; i++) {
    const u = pool[i]!;
    const k = poolKeys[i]!;
    const g = u === me ? 0 : view.gapMm(me, u);
    const hp = view.hpBp(u);
    if (
      best === NO_UNIT ||
      k < bestKey ||
      (k === bestKey && (g < bestGap || (g === bestGap && (hp < bestHp || (hp === bestHp && u < best)))))
    ) {
      best = u;
      bestKey = k;
      bestGap = g;
      bestHp = hp;
    }
  }
  const current = view.currentTarget(me);
  if (current !== null && current !== best) {
    let idx = -1;
    for (let i = 0; i < count; i++) if (pool[i] === current) idx = i;
    if (idx >= 0) {
      const tol = sel.keyKind === 0 ? ct.stickGapMm : sel.keyKind === 1 ? ct.stickHpBp : 0;
      if (poolKeys[idx]! - bestKey <= tol) return current;
    }
  }
  return best;
}

/** select() result codes: a unit index, or one of these. */
const NO_TARGET = -1;
const ONLY_FILTERED = -2;

function select(ct: CompiledInternal, rule: CRule, view: BattleView, me: UnitIndex): number {
  const sel = rule.sel;
  const action = rule.action;
  const side = view.side(me);
  const selfOk = ct.selfAllowed[rule.index]!;
  // Single-unit selectors.
  let single: UnitIndex | null | undefined;
  switch (sel.code) {
    case 0: // self
      single = me;
      break;
    case 9: { // captain_target
      const t = view.captainTarget(side);
      single = t !== null && view.standing(t) && view.side(t) !== side ? t : null;
      break;
    }
    case 17: { // current_target
      single = aimOf(view, me);
      break;
    }
    case 16: { // captain
      const c = view.captainOf(side);
      single = c;
      break;
    }
    default:
      single = undefined;
  }
  if (single !== undefined) {
    if (single === null) return NO_TARGET;
    buildPool(sel, action, selfOk, view, me);
    if (!hasCandidate(single)) return NO_TARGET;
    if (rule.only && !checkPred(rule.only, view, me, single, action)) return ONLY_FILTERED;
    return single;
  }

  buildPool(sel, action, selfOk, view, me);
  // Selector filter.
  let w = 0;
  for (let i = 0; i < nCand; i++) {
    const u = candidates[i]!;
    if (selectorFilter(sel, view, me, u)) candidates[w++] = u;
  }
  nCand = w;
  if (w === 0) return NO_TARGET;
  if (rule.only) {
    w = 0;
    for (let i = 0; i < nCand; i++) {
      const u = candidates[i]!;
      if (checkPred(rule.only, view, me, u, action)) candidates[w++] = u;
    }
    nCand = w;
    if (w === 0) return ONLY_FILTERED;
  }
  for (let i = 0; i < nCand; i++) keys[i] = primaryKey(sel, view, me, candidates[i]!);
  if (rule.prefer) {
    let np = 0;
    for (let i = 0; i < nCand; i++) {
      const u = candidates[i]!;
      if (checkPred(rule.prefer, view, me, u, action)) {
        preferred[np] = u;
        preferredKeys[np] = keys[i]!;
        np++;
      }
    }
    if (np > 0) return pickBest(ct, sel, view, me, preferred, preferredKeys, np);
  }
  return pickBest(ct, sel, view, me, candidates, keys, nCand);
}

/** The stance's target: the nearest enemy with the published tie-breaks. */
function stanceTarget(ct: CompiledInternal, view: BattleView, me: UnitIndex): UnitIndex | null {
  nCand = 0;
  const side = view.side(me);
  const n = view.unitCount;
  for (let u = 0; u < n; u++) if (view.standing(u) && view.side(u) !== side) candidates[nCand++] = u;
  if (nCand === 0) return null;
  for (let i = 0; i < nCand; i++) keys[i] = view.gapMm(me, candidates[i]!);
  return pickBest(ct, NEAREST, view, me, candidates, keys, nCand);
}

const NEAREST: CSelector = { code: 1, id: 'nearest_enemy', pool: 'enemies', keyKind: 0, includeSelf: false, withinMm: -1, radiusMm: 0, role: null };

// ---- Evaluation ----------------------------------------------------------------------------

const EMPTY_TRACE: TraceEntry[] = [];

/** `withTrace` false skips building the trace (the sim's per-interval fast path; same decision). */
export function evaluate(ct: CompiledInternal, view: BattleView, me: UnitIndex, withTrace = true): Evaluation {
  const trace: TraceEntry[] | null = withTrace ? [] : null;
  const taunter = view.tauntedBy ? view.tauntedBy(me) : null;
  if (taunter !== null && taunter !== undefined && view.standing(taunter)) {
    return {
      decision: { rule: -1, action: 'attack', slot: null, target: taunter, band: null },
      trace: trace ?? EMPTY_TRACE,
      forced: 'taunted',
    };
  }
  const rules = ct.rules;
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]!;
    if (!view.ruleReady(me, i)) {
      if (trace) trace.push({ rule: i, fired: false, skip: 'rule_cooldown', reason: 'rule_cooldown' });
      continue;
    }
    let failed = -1;
    for (let c = 0; c < rule.conds.length; c++) {
      const cond = rule.conds[c]!;
      const v = checkCond(cond, view, me);
      if (v === cond.not) {
        failed = c;
        break;
      }
    }
    if (failed >= 0) {
      if (trace) trace.push({ rule: i, fired: false, skip: 'condition_false', reason: 'cond_false', cond: failed, observed });
      continue;
    }
    const action = rule.action;
    if (action.type === 'ability' && action.slot !== null) {
      if (!view.abilityReady(me, action.slot)) {
        if (trace) {
          const ready = view.abilityReadyInTicks ? view.abilityReadyInTicks(me, action.slot) : undefined;
          trace.push({ rule: i, fired: false, skip: 'on_cooldown', reason: 'cooldown', readyInTicks: ready });
        }
        continue;
      }
      if (view.focus(me) < action.focusCost) {
        if (trace) trace.push({ rule: i, fired: false, skip: 'no_focus', reason: 'no_focus', observed: view.focus(me) });
        continue;
      }
      if (view.hasStatus(me, 'silence')) {
        if (trace) trace.push({ rule: i, fired: false, skip: 'blocked', reason: 'silenced' });
        continue;
      }
      if (view.abilityBlocked && view.abilityBlocked(me, action.slot)) {
        if (trace) trace.push({ rule: i, fired: false, skip: 'blocked', reason: 'blocked' });
        continue;
      }
    }
    const pick = select(ct, rule, view, me);
    if (pick < 0) {
      if (trace) {
        trace.push({
          rule: i,
          fired: false,
          skip: pick === NO_TARGET ? 'no_target' : 'only_filtered_all',
          reason: pick === NO_TARGET ? 'no_target' : 'only_filtered',
        });
      }
      continue;
    }
    if (action.type === 'ability' && action.slot !== null && !action.approach && !view.abilityInRange(me, action.slot, pick)) {
      if (trace) trace.push({ rule: i, fired: false, skip: 'out_of_range', reason: 'out_of_range' });
      continue;
    }
    if (trace) trace.push({ rule: i, fired: true, skip: null, reason: null });
    const decision: Decision = {
      rule: i,
      action: action.type,
      slot: action.slot,
      target: pick,
      band: action.band,
    };
    return { decision, trace: trace ?? EMPTY_TRACE, forced: null };
  }
  if (trace) trace.push({ rule: rules.length, fired: true, skip: null, reason: null });
  return {
    decision: { rule: rules.length, action: 'stance', slot: null, target: stanceTarget(ct, view, me), band: null },
    trace: trace ?? EMPTY_TRACE,
    forced: null,
  };
}
