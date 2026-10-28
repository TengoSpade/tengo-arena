/**
 * Scoring observers' answers against the answer key (vis-003: each observer names both sides' tank and healer and the
 * cause of each down in at least 90% of prompts). Observers answer in free text, by fighter name or class name; the
 * matching below is deliberately plain and explained in every result, so a disputed mark can be checked by eye.
 */
import { promptsFor } from './prompts';
import type { FightKey, KeyUnit, ObserverAnswers, PromptKind, PromptResult, ScoreSummary, SideNo } from './types';

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

const NONE = /\b(none|nobody|no one|n a|no tank|no healer|there is no|not any)\b/;
const NO_UNIT_CAUSE = /\b(status|damage over time|dot|bleed|bleeding|burn|burning|poison|poisoned|zone|environment|no one|nobody|unknown)\b/;
const BASIC = /\b(basic|auto|attack|melee|swing|shot|strike|hit)\b/;

function roleUnits(key: FightKey, kind: 'tank' | 'healer', side: SideNo): number[] {
  return (kind === 'tank' ? key.tanks : key.healers)[side];
}

export interface ScoreOptions {
  /** Count a down prompt right only when the ability is named too. Default false: naming the killer is the cause. */
  strictAbility?: boolean;
}

/** Score one fight's answers (prompt id to text). Unanswered prompts are wrong. */
export function scoreFight(key: FightKey, answers: Readonly<Record<string, string>>, opts: ScoreOptions = {}): PromptResult[] {
  const results: PromptResult[] = [];
  for (const p of promptsFor(key)) {
    const answer = (answers[p.id] ?? '').trim();
    const base = { fight: key.fight, prompt: p.id, kind: p.kind, answer };
    if (answer === '') {
      results.push({ ...base, correct: false, why: 'no answer' });
      continue;
    }
    const norm = normalize(answer);
    if (p.kind === 'tank' || p.kind === 'healer') {
      const holders = roleUnits(key, p.kind, p.side);
      if (holders.length === 0) {
        const none = NONE.test(norm);
        results.push({ ...base, correct: none, why: none ? `none, as the side has no ${p.kind}` : `the side has no ${p.kind}; the answer names one` });
        continue;
      }
      const named = unitsMentioned(answer, key.units).filter((u) => key.units[u]!.side === p.side);
      const right = named.length > 0 && named.every((u) => holders.includes(u));
      const holderNames = holders.map((u) => key.units[u]!.name).join(' / ');
      results.push({ ...base, correct: right, why: right ? `${named.map((u) => key.units[u]!.name).join(', ')} holds the ${p.kind} role` : named.length === 0 ? `names no fighter of that side (the ${p.kind}: ${holderNames})` : `names ${named.map((u) => key.units[u]!.name).join(', ')}, who ${named.length > 1 ? 'are not all' : 'is not'} the ${p.kind} (the ${p.kind}: ${holderNames})` });
      continue;
    }
    // down
    const d = key.downs[Number(p.id.split('.')[1]) - 1]!;
    const victim = key.units[d.victim]!;
    const ability = d.abilityName;
    const abilityNamed = ability === null ? BASIC.test(norm) : normalize(answer).includes(normalize(ability));
    if (d.killer === null) {
      const ok = NO_UNIT_CAUSE.test(norm);
      results.push({ ...base, correct: ok, why: ok ? 'no unit struck the last blow, as answered' : 'no unit struck the last blow (status or zone damage); the answer names a fighter', abilityNamed });
      continue;
    }
    const killer = key.units[d.killer]!;
    const named = unitsMentioned(answer, key.units).filter((u) => key.units[u]!.side !== victim.side);
    const killerOk = named.includes(d.killer) && named.length <= 3;
    const correct = killerOk && (opts.strictAbility ? abilityNamed : true);
    results.push({
      ...base,
      correct,
      abilityNamed,
      why: killerOk
        ? `${killer.name} (${killer.className}) struck the last blow${ability ? ` with ${ability}` : ''}${opts.strictAbility && !abilityNamed ? '; the ability is not named' : ''}`
        : named.length > 3
          ? 'names more than three enemies'
          : `the last blow was ${killer.name} (${killer.className})${ability ? ` with ${ability}` : ''}; the answer ${named.length ? `names ${named.map((u) => key.units[u]!.name).join(', ')}` : 'names no enemy fighter'}`,
    });
  }
  return results;
}

export function summarize(observer: string, results: readonly PromptResult[]): ScoreSummary {
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
    unanswered: results.filter((r) => r.why === 'no answer').length,
  };
}

/** Score an observer's whole answer file against the keys of the fights. Fights the observer did not answer count as unanswered. */
export function scoreObserver(keys: readonly FightKey[], answers: ObserverAnswers, opts: ScoreOptions = {}): { results: PromptResult[]; summary: ScoreSummary } {
  const results = keys.flatMap((k) => scoreFight(k, answers.fights[String(k.fight)] ?? {}, opts));
  return { results, summary: summarize(answers.observer, results) };
}
