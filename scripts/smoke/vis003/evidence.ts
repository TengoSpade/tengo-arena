/**
 * The automated half of the vis-003 pre-check: from what the screen showed (the text, live regions and role glyph
 * carriers captured with each screenshot) and the fight log's key, is each tank and healer identifiable, and is the
 * cause of each down named on screen? No judgement here: a role is identifiable when the glyph the screen shows for every
 * fighter of the side agrees with the class's roles; a cause is named when the victim, the killer and the ability appear
 * on screen within the callout's life after the down. The agent observer (the other half) looks at the pictures.
 */
import { normalize, unitsMentioned } from './score';
import type { FightKey, KeyUnit, PromptKind, ScreenEvidence, SideNo } from './types';

export interface EvidenceCapture {
  tick: number;
  reason: string;
  evidence: ScreenEvidence | null;
}

export interface EvidenceResult {
  fight: number;
  prompt: string;
  kind: PromptKind;
  identifiable: boolean;
  why: string;
  /** down: the cause was still in the live feed well after the callout faded (04 §4 "a persistent entry in the live feed"). */
  persistent?: boolean;
}

/** The callout shows for 2 s (A5); captures run up to a few ticks late. */
export const CALLOUT_TICKS = 40;
export const CAPTURE_LAG_TICKS = 8;

/** The roles each fighter's row on screen carries, by unit. A row names one fighter, or fighters of one class. */
export function shownRoles(units: readonly KeyUnit[], evidence: ScreenEvidence): Map<number, Set<string>> {
  const out = new Map<number, Set<string>>();
  for (const r of evidence.roles) {
    if (!r.role) continue;
    const named = unitsMentioned(r.row, units);
    // A row naming fighters of different classes is not one fighter's row (a team strip heading, say): skip it.
    if (named.length === 0 || new Set(named.map((u) => units[u]!.className)).size > 1) continue;
    for (const u of named) {
      const set = out.get(u) ?? new Set<string>();
      set.add(r.role);
      out.set(u, set);
    }
  }
  return out;
}

function roleIdentifiable(key: FightKey, role: 'tank' | 'healer', side: SideNo, captures: readonly EvidenceCapture[]): { ok: boolean; why: string } {
  const sideUnits = key.units.filter((u) => u.side === side);
  const holders = sideUnits.filter((u) => u.roles.includes(role));
  let best = 'no capture carried role glyphs';
  for (const c of captures) {
    if (!c.evidence) continue;
    const shown = shownRoles(key.units, c.evidence);
    if (shown.size === 0) continue;
    const missing = sideUnits.filter((u) => !shown.has(u.unit));
    if (missing.length > 0) {
      best = `the screen shows role glyphs for ${shown.size} fighters, not for ${missing.map((u) => u.name).join(', ')}`;
      continue;
    }
    const wrong = sideUnits.filter((u) => shown.get(u.unit)!.has(role) !== u.roles.includes(role));
    if (wrong.length === 0) {
      return { ok: true, why: holders.length === 0 ? `no ${role} on this side, and none is shown` : `${holders.map((u) => u.name).join(' / ')} shown with the ${role} glyph, nobody else on the side` };
    }
    best = `the ${role} glyph on screen disagrees with the class roles for ${wrong.map((u) => u.name).join(', ')}`;
  }
  return { ok: false, why: best };
}

const NO_UNIT = /status|damage over time|dot\b|bleed|burn|poison|zone/i;

function causeNamed(key: FightKey, downIndex: number, captures: readonly EvidenceCapture[]): { ok: boolean; why: string; persistent: boolean } {
  const d = key.downs[downIndex]!;
  const victim = key.units[d.victim]!;
  const killer = d.killer === null ? null : key.units[d.killer]!;
  const names = (u: KeyUnit): string[] => [u.name, u.className];
  const has = (hay: string, needles: string[]): boolean => needles.some((n) => ` ${normalize(hay)} `.includes(` ${normalize(n)} `));
  const textOf = (e: ScreenEvidence): string => [e.text, ...e.live].join('\n');
  const reads = (e: ScreenEvidence): { victim: boolean; killer: boolean; ability: boolean } => {
    // Look line by line: the cause is one callout or feed entry, not words scattered over the screen.
    let best = { victim: false, killer: false, ability: false };
    for (const line of textOf(e).split('\n')) {
      const v = has(line, names(victim));
      const k = killer ? has(line, names(killer)) : NO_UNIT.test(line);
      const a = d.abilityName ? has(line, [d.abilityName]) : true;
      if (v && k && (a || (best.victim && best.killer && !best.ability))) return { victim: v, killer: k, ability: a };
      if ([v, k, a].filter(Boolean).length > [best.victim, best.killer, best.ability].filter(Boolean).length) best = { victim: v, killer: k, ability: a };
    }
    return best;
  };
  let nearest = 'no capture within the callout window of the down';
  for (const c of captures) {
    if (!c.evidence || c.tick < d.tick || c.tick > d.tick + CALLOUT_TICKS + CAPTURE_LAG_TICKS) continue;
    const r = reads(c.evidence);
    if (r.victim && r.killer && r.ability) {
      const later = captures.some((x) => x.evidence && x.tick > d.tick + CALLOUT_TICKS + CAPTURE_LAG_TICKS && x.evidence.live.some((l) => has(l, names(victim)) && (killer ? has(l, names(killer)) : true)));
      return { ok: true, why: `named on screen at tick ${c.tick}`, persistent: later };
    }
    nearest = `at tick ${c.tick} the screen ${r.victim ? 'names the victim' : 'does not name the victim'}, ${r.killer ? 'names the killer' : 'does not name the killer'}${d.abilityName ? `, ${r.ability ? 'names the ability' : `does not name the ability (${d.abilityName})`}` : ''}`;
  }
  return { ok: false, why: nearest, persistent: false };
}

export interface EvidenceSummary {
  results: EvidenceResult[];
  roles: { identifiable: number; total: number };
  causes: { named: number; total: number; persistent: number };
  /** 100% of both: the automated proxy of vis-003 ("cause named on every down", glyphs on every token). */
  pass: boolean;
}

export function scoreEvidence(key: FightKey, captures: readonly EvidenceCapture[]): EvidenceResult[] {
  const out: EvidenceResult[] = [];
  const ours: SideNo = key.ourSide ?? 0;
  const theirs: SideNo = ours === 0 ? 1 : 0;
  for (const role of ['tank', 'healer'] as const) {
    for (const [tag, side] of [
      ['us', ours],
      ['them', theirs],
    ] as const) {
      const r = roleIdentifiable(key, role, side, captures);
      out.push({ fight: key.fight, prompt: `${role}.${tag}`, kind: role, identifiable: r.ok, why: r.why });
    }
  }
  key.downs.forEach((d, i) => {
    const r = causeNamed(key, i, captures);
    out.push({ fight: key.fight, prompt: `down.${d.index}`, kind: 'down', identifiable: r.ok, why: r.why, persistent: r.persistent });
  });
  return out;
}

export function summarizeEvidence(results: readonly EvidenceResult[]): EvidenceSummary {
  const roles = results.filter((r) => r.kind !== 'down');
  const causes = results.filter((r) => r.kind === 'down');
  const summary = {
    results: [...results],
    roles: { identifiable: roles.filter((r) => r.identifiable).length, total: roles.length },
    causes: { named: causes.filter((r) => r.identifiable).length, total: causes.length, persistent: causes.filter((r) => r.persistent).length },
  };
  return { ...summary, pass: roles.length > 0 && summary.roles.identifiable === roles.length && summary.causes.named === causes.length };
}
