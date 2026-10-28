/**
 * Scoring observers' answers against the answer key (vis-003: each observer names both sides' tank and healer and the
 * cause of each down in at least 90% of prompts). Observers answer in free text, by fighter name or class name; the
 * matching below is deliberately plain and explained in every result, so a disputed mark can be checked by eye.
 *
 * The rules, the same as PROTOCOL.md and SCORE-SHEET.md say:
 * - tank / healer: right when every fighter of that side the answer names holds the role (a hybrid holds both). "None" is
 *   right when the side has none. Naming a fighter without the role, or one with it and one without, is wrong.
 * - down: the observer lists the downs they saw (victim and cause). A key down is right when a listed entry names its victim
 *   and its cause names the fighter credited with the down (the one whose single largest hit that tick took the victim down;
 *   assists are not credited) and no other enemy fighter. Naming several enemies is wrong. The ability only counts in strict
 *   mode. A down with no fighter behind it (status or zone) is right when the cause says so.
 * - "unclear", "unknown" and blanks are wrong everywhere. A listed down that matches no key down is reported, not counted.
 */
import { promptsFor } from './prompts';
import type { DownAnswer, FightAnswers, FightKey, KeyDown, KeyUnit, ObserverAnswers, PromptKind, PromptResult, ScoreSummary, SideNo } from './types';

/** Lowercase, letters and digits only, single spaces. */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function mentionsPhrase(normalizedText: string, phrase: string): boolean {
  const p = normalize(phrase);
  if (!p) return false;
  return ` ${normalizedText} `.includes(` ${p} `);
}

/** What an observer may call a unit: the full name, a first name (when no other fighter shares it), the class name. */
export function aliasesOf(unit: KeyUnit, all: readonly KeyUnit[]): string[] {
  const out = [unit.name, unit.className];
  const first = normalize(unit.name).split(' ')[0] ?? '';
  if (first.length >= 3 && normalize(unit.name) !== first) {
    const shared = all.filter((u) => u.unit !== unit.unit && (normalize(u.name).split(' ')[0] ?? '') === first);
    if (shared.length === 0) out.push(first);
  }
  return out.filter((a) => normalize(a).length > 0);
}

/** The units an answer names. A full name names one unit; a class name names every unit of that class. */
export function unitsMentioned(text: string, units: readonly KeyUnit[]): number[] {
  const t = normalize(text);
  const pinned = new Set<number>();
  for (const u of units) if (mentionsPhrase(t, u.name) || aliasesOf(u, units).slice(2).some((a) => mentionsPhrase(t, a))) pinned.add(u.unit);
  const named = new Set(pinned);
  // A class name names every unit of that class, unless a name already pinned down one of its class-mates.
  for (const u of units) {
    if (pinned.has(u.unit) || !mentionsPhrase(t, u.className)) continue;
    if (!units.some((x) => x.className === u.className && pinned.has(x.unit))) named.add(u.unit);
  }
  return [...named].sort((a, b) => a - b);
}

const UNCLEAR = /^(unclear|unknown|not sure|no idea|dont know|don t know|i dont know|i don t know|cant tell|can t tell|cannot tell|dunno|n a|na|)$/;
const NONE = /\b(none|nobody|no one|no tank|no healer|there is no|not any)\b/;
const NO_UNIT_CAUSE = /\b(status|damage over time|dot|bleed|bleeding|burn|burning|poison|poisoned|zone|environment|no fighter)\b/;
const BASIC = /\b(basic|auto|attack|melee|swing|shot|strike|hit)\b/;

/** An answer that says it does not know ("unclear", "unknown", blank...). */
export function isUnclear(text: string): boolean {
  return UNCLEAR.test(normalize(text));
}

function roleUnits(key: FightKey, kind: 'tank' | 'healer', side: SideNo): number[] {
  return (kind === 'tank' ? key.tanks : key.healers)[side];
}

export interface ScoreOptions {
  /** Count a down right only when the ability is named too. Default false: naming the credited fighter is the cause. */
  strictAbility?: boolean;
}

/** The text with the credited ability's name taken out, so a name inside an ability's name is not read as a fighter. */
function withoutAbility(text: string, abilityName: string | null): string {
  if (!abilityName) return text;
  const a = normalize(abilityName);
  return a ? ` ${normalize(text)} `.split(` ${a} `).join(' ') : text;
}

/** Several classes named at once: an answer that names more than one kind of fighter is naming several. */
function severalKinds(units: readonly number[], all: readonly KeyUnit[]): boolean {
  return new Set(units.map((u) => all[u]!.className)).size > 1;
}

interface CauseVerdict {
  correct: boolean;
  why: string;
  abilityNamed: boolean;
}

function scoreCause(key: FightKey, d: KeyDown, causeText: string, opts: ScoreOptions): CauseVerdict {
  const victim = key.units[d.victim]!;
  const ability = d.abilityName;
  const norm = normalize(causeText);
  const abilityNamed = ability === null ? BASIC.test(norm) : norm.includes(normalize(ability));
  if (isUnclear(causeText)) return { correct: false, why: 'the cause is unclear', abilityNamed };
  if (d.killer === null) {
    const ok = NO_UNIT_CAUSE.test(norm);
    return { correct: ok, why: ok ? 'no fighter is credited (status or zone damage), as answered' : 'no fighter is credited (status or zone damage); the answer names a fighter or something else', abilityNamed };
  }
  const killer = key.units[d.killer]!;
  const named = unitsMentioned(withoutAbility(causeText, ability), key.units).filter((u) => key.units[u]!.side !== victim.side);
  const credited = `${killer.name}${killer.name === killer.className ? '' : ` (${killer.className})`}${ability ? ` with ${ability}` : ''}`;
  if (severalKinds(named, key.units)) return { correct: false, why: `names several enemies (${named.map((u) => key.units[u]!.name).join(', ')}); the credited fighter is ${credited}`, abilityNamed };
  if (!named.includes(d.killer)) return { correct: false, why: `the credited fighter is ${credited}; the answer ${named.length ? `names ${named.map((u) => key.units[u]!.name).join(', ')}` : 'names no enemy fighter'}`, abilityNamed };
  if (opts.strictAbility && !abilityNamed) return { correct: false, why: `${credited} is the credited fighter; the ability is not named`, abilityNamed };
  return { correct: true, why: `${credited} is the credited fighter`, abilityNamed };
}

/** Does this listed victim name the key's victim (and not several different fighters)? */
function victimMatches(key: FightKey, d: KeyDown, victimText: string): { ok: boolean; exact: boolean } {
  if (isUnclear(victimText)) return { ok: false, exact: false };
  const named = unitsMentioned(victimText, key.units);
  if (!named.includes(d.victim) || severalKinds(named, key.units)) return { ok: false, exact: false };
  return { ok: true, exact: named.length === 1 };
}

export interface FightScore {
  results: PromptResult[];
  /** Listed downs that matched no key down. */
  extraDowns: number;
}

/** Score one fight's answers. Unanswered prompts and downs the observer did not list are wrong. */
export function scoreFightDetailed(key: FightKey, answers: FightAnswers, opts: ScoreOptions = {}): FightScore {
  const results: PromptResult[] = [];
  const used = new Set<number>();
  for (const p of promptsFor(key)) {
    if (p.kind === 'tank' || p.kind === 'healer') {
      const answer = (answers.roles[p.id] ?? '').trim();
      const base = { fight: key.fight, prompt: p.id, kind: p.kind, answer };
      if (answer === '') {
        results.push({ ...base, correct: false, why: 'no answer' });
        continue;
      }
      if (isUnclear(answer)) {
        results.push({ ...base, correct: false, why: 'unclear' });
        continue;
      }
      const holders = roleUnits(key, p.kind, p.side);
      if (holders.length === 0) {
        const none = NONE.test(normalize(answer));
        results.push({ ...base, correct: none, why: none ? `none, as the side has no ${p.kind}` : `the side has no ${p.kind}; the answer names one` });
        continue;
      }
      const named = unitsMentioned(answer, key.units).filter((u) => key.units[u]!.side === p.side);
      const right = named.length > 0 && named.every((u) => holders.includes(u));
      const holderNames = holders.map((u) => key.units[u]!.name).join(' / ');
      results.push({
        ...base,
        correct: right,
        why: right
          ? `${named.map((u) => key.units[u]!.name).join(', ')} holds the ${p.kind} role`
          : named.length === 0
            ? `names no fighter of that side (the ${p.kind}: ${holderNames})`
            : `names ${named.map((u) => key.units[u]!.name).join(', ')}, who ${named.length > 1 ? 'are not all' : 'is not'} the ${p.kind} (the ${p.kind}: ${holderNames})`,
      });
      continue;
    }
    // down: find the observer's entry for this victim, then judge its cause
    const d = key.downs[Number(p.id.split('.')[1]) - 1]!;
    const victim = key.units[d.victim]!;
    let pick = -1;
    let pickExact = false;
    answers.downs.forEach((e, i) => {
      if (used.has(i)) return;
      const m = victimMatches(key, d, e.victim);
      if (m.ok && (pick < 0 || (m.exact && !pickExact))) {
        pick = i;
        pickExact = m.exact;
      }
    });
    if (pick < 0) {
      results.push({ fight: key.fight, prompt: p.id, kind: 'down', answer: '', correct: false, why: `no listed down names ${victim.name}${victim.name === victim.className ? '' : ` (${victim.className})`}` });
      continue;
    }
    used.add(pick);
    const entry: DownAnswer = answers.downs[pick]!;
    const v = scoreCause(key, d, entry.cause, opts);
    results.push({ fight: key.fight, prompt: p.id, kind: 'down', answer: `${entry.victim}: ${entry.cause}`, correct: v.correct, why: v.why, abilityNamed: v.abilityNamed });
  }
  return { results, extraDowns: answers.downs.length - used.size };
}

export function scoreFight(key: FightKey, answers: FightAnswers, opts: ScoreOptions = {}): PromptResult[] {
  return scoreFightDetailed(key, answers, opts).results;
}

export const NO_ANSWERS: FightAnswers = { roles: {}, downs: [] };

export function summarize(observer: string, results: readonly PromptResult[], extraDowns = 0): ScoreSummary {
  const byKind: ScoreSummary['byKind'] = { tank: { correct: 0, total: 0 }, healer: { correct: 0, total: 0 }, down: { correct: 0, total: 0 } };
  const fights = new Map<number, { correct: number; total: number }>();
  let correct = 0;
  for (const r of results) {
    const k = byKind[r.kind as PromptKind];
    k.total++;
    const f = fights.get(r.fight) ?? { correct: 0, total: 0 };
    f.total++;
    if (r.correct) {
      k.correct++;
      f.correct++;
      correct++;
    }
    fights.set(r.fight, f);
  }
  const total = results.length;
  return {
    observer,
    correct,
    total,
    rate: total > 0 ? correct / total : 0,
    byKind,
    byFight: [...fights.entries()].sort((a, b) => a[0] - b[0]).map(([fight, v]) => ({ fight, ...v })),
    pass: total > 0 && correct / total >= 0.9,
    unanswered: results.filter((r) => r.why === 'no answer' || r.why.startsWith('no listed down')).length,
    extraDowns,
  };
}

/** Score an observer's whole answer file against the keys of the fights. Fights the observer did not answer count as unanswered. */
export function scoreObserver(keys: readonly FightKey[], answers: ObserverAnswers, opts: ScoreOptions = {}): { results: PromptResult[]; summary: ScoreSummary } {
  const scored = keys.map((k) => scoreFightDetailed(k, answers.fights[String(k.fight)] ?? NO_ANSWERS, opts));
  const results = scored.flatMap((s) => s.results);
  return { results, summary: summarize(answers.observer, results, scored.reduce((n, s) => n + s.extraDowns, 0)) };
}
