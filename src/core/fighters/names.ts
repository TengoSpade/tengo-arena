/**
 * Names (sys-fighters "Names", names.json rules). A pattern by weight per
 * race, parts concatenated, first letter of each assembled word upper-cased.
 * Rejected and retried (rules.maxAttempts) on a blocklisted word, three
 * identical letters in a row, a given name outside the length bounds, or a
 * full name already held by a living fighter; on exhaustion a roman numeral
 * (II, III, ...) is appended to the last attempt.
 */
import type { ContentDB, RaceNames } from '../content';
import type { GameState, PersonName, RaceId } from '../model';
import type { Rng } from '../rng';
import { bp } from './fixed';

const ROMAN = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

export function livingNames(state: GameState): Set<string> {
  const out = new Set<string>();
  for (const f of Object.values(state.fighters)) if (f.status !== 'retired') out.add(f.name.full);
  return out;
}

function cap(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

function pickPart(rng: Rng, list: readonly string[]): string {
  return rng.pick(list);
}

function makeGiven(rng: Rng, names: RaceNames): string {
  const g = names.given;
  const middle = g.middles && g.middles.length > 0 ? pickPart(rng, g.middles) : '';
  return cap(pickPart(rng, g.prefixes) + middle + pickPart(rng, g.suffixes));
}

function makeFamily(rng: Rng, names: RaceNames): string {
  return cap(pickPart(rng, names.family.prefixes) + pickPart(rng, names.family.suffixes));
}

interface Attempt {
  name: PersonName;
}

function attempt(rng: Rng, names: RaceNames): Attempt {
  const pattern = rng.weighted(names.patterns, (p) => bp(p.weight));
  const format = pattern.format;
  let given = '';
  let familyA = '';
  const full = format.replace(/\{(\w+)\}/g, (_m, key: string) => {
    switch (key) {
      case 'given':
        given = makeGiven(rng, names);
        return given;
      case 'given2':
        return makeGiven(rng, names);
      case 'family':
        return makeFamily(rng, names);
      case 'familyA':
        familyA = makeFamily(rng, names);
        return familyA;
      case 'familyB': {
        let b = makeFamily(rng, names);
        for (let i = 0; i < 8 && b === familyA; i++) b = makeFamily(rng, names);
        return b;
      }
      default: {
        const list = (names as Record<string, unknown>)[key];
        return Array.isArray(list) && list.length > 0 ? cap(String(pickPart(rng, list as string[]))) : key;
      }
    }
  });
  const rest = given && full.startsWith(given) ? full.slice(given.length).trim() : full;
  const familyLike = /\{(family|familyA|familyB|given2)\}/.test(format);
  return {
    name: {
      given,
      family: familyLike && rest ? rest : null,
      epithet: !familyLike && rest ? rest : null,
      full,
    },
  };
}

function rejected(name: PersonName, content: ContentDB, living: ReadonlySet<string>): boolean {
  const rules = content.names.rules;
  if (name.given.length < rules.minGivenLength || name.given.length > rules.maxGivenLength) return true;
  const lower = name.full.toLowerCase();
  if (rules.rejectTripleLetters && /([a-z])\1\1/.test(lower)) return true;
  for (const word of rules.blocklist) {
    const w = rules.blocklistCaseInsensitive ? word.toLowerCase() : word;
    if ((rules.blocklistCaseInsensitive ? lower : name.full).includes(w)) return true;
  }
  if (rules.uniqueFullNameAmongLivingFighters && living.has(name.full)) return true;
  return false;
}

/** Generate a name for a race from `rng`. `living` holds the full names already in use. */
export function generateNameWith(rng: Rng, raceId: RaceId, content: ContentDB, living: ReadonlySet<string>): PersonName {
  const race = content.races.require(raceId);
  const names = content.names.races[race.namesKey];
  if (!names) throw new RangeError(`names.json has no entry "${race.namesKey}"`);
  let last: PersonName | null = null;
  for (let i = 0; i < content.names.rules.maxAttempts; i++) {
    const { name } = attempt(rng, names);
    last = name;
    if (!rejected(name, content, living)) return name;
  }
  const base = last ?? attempt(rng, names).name;
  for (const numeral of ROMAN) {
    const candidate: PersonName = {
      given: base.given,
      family: base.family,
      epithet: base.epithet ? `${base.epithet} ${numeral}` : numeral,
      full: `${base.full} ${numeral}`,
    };
    if (!living.has(candidate.full)) return candidate;
  }
  return { ...base, epithet: base.epithet ? `${base.epithet} ${living.size}` : String(living.size), full: `${base.full} ${living.size}` };
}
