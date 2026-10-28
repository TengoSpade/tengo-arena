/**
 * Reading observers' answer files. An agent observer replies with one JSON object per fight (the brief asks for
 * `{ observer, fight, answers }`), possibly inside a code fence or after a line of prose; a person's transcription may be
 * one file with every fight. Both are accepted and merged per observer. Pure.
 */
import type { ObserverAnswers } from './types';

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

function asStrings(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = typeof v === 'string' ? v : v === null || v === undefined ? '' : JSON.stringify(v);
  return out;
}

/** One file's worth of answers: `{ observer, fights: { "1": {...} } }` or `{ observer, fight: 1, answers: {...} }`. */
export function parseAnswerFile(text: string, fallbackObserver = 'observer'): ObserverAnswers {
  const raw = extractJson(text) as { observer?: unknown; fight?: unknown; answers?: unknown; fights?: unknown; notes?: unknown };
  const observer = typeof raw.observer === 'string' && raw.observer.trim() && !raw.observer.startsWith('<') ? raw.observer.trim() : fallbackObserver;
  const fights: ObserverAnswers['fights'] = {};
  if (raw.fights && typeof raw.fights === 'object') {
    for (const [n, a] of Object.entries(raw.fights as Record<string, unknown>)) fights[String(n)] = asStrings(a);
  } else if (raw.fight !== undefined && raw.answers) {
    fights[String(raw.fight)] = asStrings(raw.answers);
  } else {
    throw new Error('expected { observer, fight, answers } or { observer, fights }');
  }
  return { observer, fights, ...(typeof raw.notes === 'string' ? { notes: raw.notes } : {}) };
}

/** Merge parts by observer name; a later part's answer for the same prompt wins. */
export function mergeAnswers(parts: readonly ObserverAnswers[]): ObserverAnswers[] {
  const byName = new Map<string, ObserverAnswers>();
  for (const p of parts) {
    const into = byName.get(p.observer) ?? { observer: p.observer, fights: {} };
    for (const [n, a] of Object.entries(p.fights)) into.fights[n] = { ...(into.fights[n] ?? {}), ...a };
    if (p.notes) into.notes = [into.notes, p.notes].filter(Boolean).join('\n');
    byName.set(p.observer, into);
  }
  return [...byName.values()];
}
