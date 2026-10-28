/**
 * Reading observers' answer files. An agent observer replies with one JSON object per fight (the brief asks for
 * `{ observer, fight, answers }`), possibly inside a code fence or after a line of prose; a person's transcription may be
 * one file with every fight. Both are accepted and merged per observer. In a fight's answers the four role prompts are
 * strings and `downs` is the list of downs the observer saw, each `{ victim, cause }`. Pure.
 */
import type { DownAnswer, FightAnswers, ObserverAnswers } from './types';

/** The first balanced JSON object in the text, parsed; throws when there is none. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('no JSON object found');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error('the JSON object is not closed');
}

const text = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : JSON.stringify(v));

/** A listed down: `{ victim, cause }`, or a line "Victim: cause" / "Victim by cause" / "Victim -> cause". */
function asDown(v: unknown): DownAnswer | null {
  if (v && typeof v === 'object') {
    const o = v as { victim?: unknown; cause?: unknown };
    const down = { victim: text(o.victim).trim(), cause: text(o.cause).trim() };
    return down.victim === '' && down.cause === '' ? null : down;
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const m = /^(.*?)\s*(?::|->|→|\bdowned by\b|\bkilled by\b|\bby\b)\s*(.*)$/i.exec(v.trim());
    return m ? { victim: m[1]!.trim(), cause: m[2]!.trim() } : { victim: v.trim(), cause: '' };
  }
  return null;
}

function asFightAnswers(value: unknown): FightAnswers {
  const roles: Record<string, string> = {};
  let downs: DownAnswer[] = [];
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'downs') downs = (Array.isArray(v) ? v : []).map(asDown).filter((d): d is DownAnswer => d !== null);
      else roles[k] = text(v);
    }
  }
  return { roles, downs };
}

/** One file's worth of answers: `{ observer, fights: { "1": {...} } }` or `{ observer, fight: 1, answers: {...} }`. */
export function parseAnswerFile(source: string, fallbackObserver = 'observer'): ObserverAnswers {
  const raw = extractJson(source) as { observer?: unknown; fight?: unknown; answers?: unknown; fights?: unknown; notes?: unknown };
  const observer = typeof raw.observer === 'string' && raw.observer.trim() && !raw.observer.startsWith('<') ? raw.observer.trim() : fallbackObserver;
  const fights: ObserverAnswers['fights'] = {};
  if (raw.fights && typeof raw.fights === 'object') {
    for (const [n, a] of Object.entries(raw.fights as Record<string, unknown>)) fights[String(n)] = asFightAnswers(a);
  } else if (raw.fight !== undefined && raw.answers) {
    fights[String(raw.fight)] = asFightAnswers(raw.answers);
  } else {
    throw new Error('expected { observer, fight, answers } or { observer, fights }');
  }
  return { observer, fights, ...(typeof raw.notes === 'string' ? { notes: raw.notes } : {}) };
}

/** Merge parts by observer name; for the same fight a later part's role answers add to the earlier ones and its downs replace them. */
export function mergeAnswers(parts: readonly ObserverAnswers[]): ObserverAnswers[] {
  const byName = new Map<string, ObserverAnswers>();
  for (const p of parts) {
    const into = byName.get(p.observer) ?? { observer: p.observer, fights: {} };
    for (const [n, a] of Object.entries(p.fights)) {
      const before = into.fights[n];
      into.fights[n] = { roles: { ...(before?.roles ?? {}), ...a.roles }, downs: a.downs.length > 0 || !before ? a.downs : before.downs };
    }
    if (p.notes) into.notes = [into.notes, p.notes].filter(Boolean).join('\n');
    byName.set(p.observer, into);
  }
  return [...byName.values()];
}
