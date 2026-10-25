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
  switch (c.id) {
    case 'always':
      return true;
    case 'self_hp_below':
      observed = view.hpBp(me);
      return observed < c.hpBp;
    case 'ally_hp_below': {
      let low = Number.MAX_SAFE_INTEGER;
      for (let u = 0; u < n; u++) {
        if (!view.standing(u) || view.side(u) !== side || (u === me && !c.includeSelf)) continue;
        const hp = view.hpBp(u);
        if (hp < low) low = hp;
      }
      observed = low === Number.MAX_SAFE_INTEGER ? null : low;
      return low < c.hpBp;
    }
    case 'allies_hp_below': {
      let count = 0;
      for (let u = 0; u < n; u++) {
        if (!view.standing(u) || view.side(u) !== side) continue;
        if (c.bandMm >= 0 && u !== me && view.gapMm(me, u) > c.bandMm) continue;
        if (view.hpBp(u) < c.hpBp) count++;
      }
      observed = count;
      return count >= c.count;
    }
    case 'enemy_hp_below': {
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
    case 'enemy_within': {
      const g = nearestEnemyGap(view, me);
      observed = g === Number.MAX_SAFE_INTEGER ? null : g;
      return g <= c.bandMm;
    }
    case 'enemies_within': {
      let count = 0;
      for (let u = 0; u < n; u++) {
        if (view.standing(u) && view.side(u) !== side && view.gapMm(me, u) <= c.bandMm) count++;
      }
      observed = count;
      return count >= c.count;
    }
    case 'enemies_clustered':
    case 'allies_clustered': {
      const wantSide = c.id === 'enemies_clustered' ? (side === 0 ? 1 : 0) : side;
      let best = 0;
      for (let u = 0; u < n; u++) {
        if (!view.standing(u) || view.side(u) !== wantSide) continue;
        const k = 1 + view.neighboursWithin(u, c.radiusMm, wantSide);
        if (k > best) best = k;
      }
      observed = best;
      return best >= c.count;
    }
    case 'self_targeted': {
      const k = view.targetersOf(me).length;
      observed = k;
      return k >= c.count;
    }
    case 'ally_targeted': {
      let best = 0;
      for (let u = 0; u < n; u++) {
        if (u === me || !view.standing(u) || view.side(u) !== side || !hasRole(view, u, c.role)) continue;
        const k = view.targetersOf(u).length;
        if (k > best) best = k;
      }
      observed = best;
      return best >= c.count;
    }
    case 'enemy_casting': {
      for (let u = 0; u < n; u++) {
        if (view.standing(u) && view.side(u) !== side && view.isCasting(u) && view.gapMm(me, u) <= c.bandMm) return true;
      }
      return false;
    }
    case 'self_has_status':
      return hasStatusOrCategory(view, me, c.status, c.category);
    case 'ally_has_status': {
      for (let u = 0; u < n; u++) {
        if (view.standing(u) && view.side(u) === side && hasStatusOrCategory(view, u, c.status, c.category)) return true;
      }
      return false;
    }
    case 'enemy_has_status': {
      for (let u = 0; u < n; u++) {
        if (!view.standing(u) || view.side(u) === side) continue;
        if (c.bandMm >= 0 && view.gapMm(me, u) > c.bandMm) continue;
        if (hasStatusOrCategory(view, u, c.status, c.category)) return true;
      }
      return false;
    }
    case 'fight_time_below':
      observed = view.fightTicks;
      return view.fightTicks < c.ticks;
    case 'focus_at_least':
      observed = view.focus(me);
      return observed >= c.amount;
    case 'outnumbered': {
      const mine = view.standingCount(side);
      const theirs = view.standingCount(side === 0 ? 1 : 0);
      observed = mine - theirs;
      return mine < theirs;
    }
    case 'allies_down':
      observed = view.downedCount(side);
      return observed >= c.count;
    case 'enemy_role_within': {
      for (let u = 0; u < n; u++) {
        if (view.standing(u) && view.side(u) !== side && hasRole(view, u, c.role) && view.gapMm(me, u) <= c.bandMm) return true;
      }
      return false;
    }
    case 'captain_alive':
      return view.captainOf(side) !== null;
    default:
      return false;
  }
}

// ---- Predicates (ONLY / PREFER) -------------------------------------------------------------

function checkPred(p: CPredicate, view: BattleView, me: UnitIndex, cand: UnitIndex, action: CAction): boolean {
  switch (p.id) {
    case 'in_range':
      return inActionRange(view, me, cand, action);
    case 'within':
      return view.gapMm(me, cand) <= p.bandMm;
    case 'hp_below':
      return view.hpBp(cand) < p.hpBp;
    case 'hp_above':
      return view.hpBp(cand) > p.hpBp;
    case 'has_status':
      if (p.status !== null) return view.statusStacks(cand, p.status) >= p.minStacks;
      return hasStatusOrCategory(view, cand, null, p.category);
    case 'lacks_status':
      return !hasStatusOrCategory(view, cand, p.status, p.category);
    case 'has_buff':
      return view.hasBuff(cand);
    case 'role':
      return hasRole(view, cand, p.role);
    case 'not_role':
      return !hasRole(view, cand, p.role);
    case 'not_targeted_by_ally': {
      const side = view.side(me);
      for (const t of view.targetersOf(cand)) if (view.side(t) === side && t !== me) return false;
      return true;
    }
    case 'targeting_me':
      return aimOf(view, cand) === me;
    case 'not_self':
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

/** Kind of primary key, for stickiness tolerance. */
type KeyKind = 'gap' | 'hp' | 'count';

const candidates: UnitIndex[] = [];
const keys: number[] = [];

function buildPool(sel: CSelector, action: CAction, view: BattleView, me: UnitIndex): void {
  candidates.length = 0;
  const side = view.side(me);
  const pool = action.pool === 'any' ? poolOfSelector(sel.id) : action.pool;
  if (pool === 'self') {
    candidates.push(me);
    return;
  }
  for (let u = 0; u < view.unitCount; u++) {
    if (!view.standing(u)) continue;
    if (pool === 'enemies') {
      if (view.side(u) !== side) candidates.push(u);
    } else if (view.side(u) === side) {
      if (u === me && !allowsSelf(sel, action)) continue;
      candidates.push(u);
    }
  }
}

function poolOfSelector(id: string): 'enemies' | 'allies' | 'self' {
  if (id === 'self') return 'self';
  if (id === 'lowest_hp_ally' || id === 'most_targeted_ally' || id === 'ally_role' || id === 'densest_ally' || id === 'captain') {
    return 'allies';
  }
  return 'enemies';
}

function allowsSelf(sel: CSelector, action: CAction): boolean {
  if (action.type === 'protect' || action.type === 'regroup') return false;
  if (action.type === 'ability' && !action.selfAllowed) return false;
  switch (sel.id) {
    case 'lowest_hp_ally':
    case 'most_targeted_ally':
      return sel.includeSelf;
    case 'captain':
      return action.type === 'ability' ? action.selfAllowed : true;
    case 'self':
      return true;
    default:
      return false;
  }
}

/** Selector filter (before ONLY); returns whether the candidate stays. */
function selectorFilter(sel: CSelector, view: BattleView, me: UnitIndex, cand: UnitIndex): boolean {
  switch (sel.id) {
    case 'enemy_targeting_me':
      return aimOf(view, cand) === me;
    case 'enemy_targeting_ally': {
      const victim = aimOf(view, cand);
      return victim !== null && victim !== me && hasRole(view, victim, sel.role);
    }
    case 'casting_enemy':
      return view.isCasting(cand);
    case 'marked_enemy':
      return view.hasStatus(cand, 'marked');
    case 'enemy_role':
    case 'ally_role':
      return hasRole(view, cand, sel.role);
    case 'lowest_hp_ally':
      return sel.withinMm < 0 || cand === me || view.gapMm(me, cand) <= sel.withinMm;
    default:
      return true;
  }
}

function primaryKey(sel: CSelector, view: BattleView, me: UnitIndex, cand: UnitIndex): number {
  switch (sel.id) {
    case 'nearest_enemy':
    case 'enemy_targeting_me':
    case 'casting_enemy':
    case 'marked_enemy':
    case 'enemy_role':
    case 'ally_role':
      return view.gapMm(me, cand);
    case 'furthest_enemy':
      return -view.gapMm(me, cand);
    case 'lowest_hp_enemy':
    case 'lowest_hp_ally':
      return view.hpBp(cand);
    case 'top_damage_enemy':
      return -view.damageDealt(cand);
    case 'enemy_targeting_ally': {
      const victim = aimOf(view, cand);
      return victim === null ? Number.MAX_SAFE_INTEGER : view.hpBp(victim);
    }
    case 'densest_enemy':
    case 'densest_ally':
      return -view.neighboursWithin(cand, sel.radiusMm, view.side(cand));
    case 'most_targeted_ally':
      return -view.targetersOf(cand).length;
    default:
      return 0;
  }
}

function keyKind(id: string): KeyKind {
  switch (id) {
    case 'nearest_enemy':
    case 'furthest_enemy':
    case 'enemy_targeting_me':
    case 'casting_enemy':
    case 'marked_enemy':
    case 'enemy_role':
    case 'ally_role':
      return 'gap';
    case 'lowest_hp_enemy':
    case 'lowest_hp_ally':
    case 'enemy_targeting_ally':
      return 'hp';
    default:
      return 'count';
  }
}

/** Published tie-breaks: primary key, stickiness, smaller gap, lower HP fraction, lower slot. */
function pickBest(
  ct: CompiledInternal,
  sel: CSelector,
  view: BattleView,
  me: UnitIndex,
  pool: readonly UnitIndex[],
  poolKeys: readonly number[],
): UnitIndex {
  let best = NO_UNIT;
  let bestKey = 0;
  let bestGap = 0;
  let bestHp = 0;
  for (let i = 0; i < pool.length; i++) {
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
    const idx = pool.indexOf(current);
    if (idx >= 0) {
      const kind = keyKind(sel.id);
      const tol = kind === 'gap' ? ct.stickGapMm : kind === 'hp' ? ct.stickHpBp : 0;
      if (poolKeys[idx]! - bestKey <= tol) return current;
    }
  }
  return best;
}

type SelectOutcome = { target: UnitIndex; reason: null } | { target: typeof NO_UNIT; reason: 'no_target' | 'only_filtered' };

const preferred: UnitIndex[] = [];
const preferredKeys: number[] = [];

function select(ct: CompiledInternal, rule: CRule, view: BattleView, me: UnitIndex): SelectOutcome {
  const sel = rule.sel;
  const action = rule.action;
  const side = view.side(me);
  // Single-unit selectors.
  let single: UnitIndex | null | undefined;
  switch (sel.id) {
    case 'self':
      single = me;
      break;
    case 'captain_target': {
      const t = view.captainTarget(side);
      single = t !== null && view.standing(t) && view.side(t) !== side ? t : null;
      break;
    }
    case 'current_target': {
      single = aimOf(view, me);
      break;
    }
    case 'captain': {
      const c = view.captainOf(side);
      single = c;
      break;
    }
    default:
      single = undefined;
  }
  if (single !== undefined) {
    if (single === null) return { target: NO_UNIT, reason: 'no_target' };
    buildPool(sel, action, view, me);
    if (!candidates.includes(single)) return { target: NO_UNIT, reason: 'no_target' };
    if (rule.only && !checkPred(rule.only, view, me, single, action)) return { target: NO_UNIT, reason: 'only_filtered' };
    return { target: single, reason: null };
  }

  buildPool(sel, action, view, me);
  // Selector filter.
  let w = 0;
  for (let i = 0; i < candidates.length; i++) {
    const u = candidates[i]!;
    if (selectorFilter(sel, view, me, u)) candidates[w++] = u;
  }
  candidates.length = w;
  if (w === 0) return { target: NO_UNIT, reason: 'no_target' };
  if (rule.only) {
    w = 0;
    for (let i = 0; i < candidates.length; i++) {
      const u = candidates[i]!;
      if (checkPred(rule.only, view, me, u, action)) candidates[w++] = u;
    }
    candidates.length = w;
    if (w === 0) return { target: NO_UNIT, reason: 'only_filtered' };
  }
  keys.length = candidates.length;
  for (let i = 0; i < candidates.length; i++) keys[i] = primaryKey(sel, view, me, candidates[i]!);
  if (rule.prefer) {
    preferred.length = 0;
    preferredKeys.length = 0;
    for (let i = 0; i < candidates.length; i++) {
      const u = candidates[i]!;
      if (checkPred(rule.prefer, view, me, u, action)) {
        preferred.push(u);
        preferredKeys.push(keys[i]!);
      }
    }
    if (preferred.length > 0) return { target: pickBest(ct, sel, view, me, preferred, preferredKeys), reason: null };
  }
  return { target: pickBest(ct, sel, view, me, candidates, keys), reason: null };
}

/** The stance's target: the nearest enemy with the published tie-breaks. */
function stanceTarget(ct: CompiledInternal, view: BattleView, me: UnitIndex): UnitIndex | null {
  candidates.length = 0;
  const side = view.side(me);
  for (let u = 0; u < view.unitCount; u++) if (view.standing(u) && view.side(u) !== side) candidates.push(u);
  if (candidates.length === 0) return null;
  keys.length = candidates.length;
  for (let i = 0; i < candidates.length; i++) keys[i] = view.gapMm(me, candidates[i]!);
  return pickBest(ct, NEAREST, view, me, candidates, keys);
}

const NEAREST: CSelector = { id: 'nearest_enemy', includeSelf: false, withinMm: -1, radiusMm: 0, role: null };

// ---- Evaluation ----------------------------------------------------------------------------

export function evaluate(ct: CompiledInternal, view: BattleView, me: UnitIndex): Evaluation {
  const trace: TraceEntry[] = [];
  const taunter = view.tauntedBy ? view.tauntedBy(me) : null;
  if (taunter !== null && taunter !== undefined && view.standing(taunter)) {
    return {
      decision: { rule: -1, action: 'attack', slot: null, target: taunter, band: null },
      trace,
      forced: 'taunted',
    };
  }
  const rules = ct.rules;
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]!;
    if (!view.ruleReady(me, i)) {
      trace.push({ rule: i, fired: false, skip: 'rule_cooldown', reason: 'rule_cooldown' });
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
      trace.push({ rule: i, fired: false, skip: 'condition_false', reason: 'cond_false', cond: failed, observed });
      continue;
    }
    const action = rule.action;
    if (action.type === 'ability' && action.slot !== null) {
      if (!view.abilityReady(me, action.slot)) {
        const ready = view.abilityReadyInTicks ? view.abilityReadyInTicks(me, action.slot) : undefined;
        trace.push({ rule: i, fired: false, skip: 'on_cooldown', reason: 'cooldown', readyInTicks: ready });
        continue;
      }
      if (view.focus(me) < action.focusCost) {
        trace.push({ rule: i, fired: false, skip: 'no_focus', reason: 'no_focus', observed: view.focus(me) });
        continue;
      }
      if (view.hasStatus(me, 'silence')) {
        trace.push({ rule: i, fired: false, skip: 'blocked', reason: 'silenced' });
        continue;
      }
      if (view.abilityBlocked && view.abilityBlocked(me, action.slot)) {
        trace.push({ rule: i, fired: false, skip: 'blocked', reason: 'blocked' });
        continue;
      }
    }
    const pick = select(ct, rule, view, me);
    if (pick.reason !== null) {
      trace.push({
        rule: i,
        fired: false,
        skip: pick.reason === 'no_target' ? 'no_target' : 'only_filtered_all',
        reason: pick.reason,
      });
      continue;
    }
    if (action.type === 'ability' && action.slot !== null && !action.approach && !view.abilityInRange(me, action.slot, pick.target)) {
      trace.push({ rule: i, fired: false, skip: 'out_of_range', reason: 'out_of_range' });
      continue;
    }
    trace.push({ rule: i, fired: true, skip: null, reason: null });
    const decision: Decision = {
      rule: i,
      action: action.type,
      slot: action.slot,
      target: pick.target,
      band: action.band,
    };
    return { decision, trace, forced: null };
  }
  trace.push({ rule: rules.length, fired: true, skip: null, reason: null });
  return {
    decision: { rule: rules.length, action: 'stance', slot: null, target: stanceTarget(ct, view, me), band: null },
    trace,
    forced: null,
  };
}
