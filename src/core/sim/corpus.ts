/**
 * A seeded corpus of varied rounds for tests (log format 2, the probe, the replay-hash guards): random 5v5 drafts from
 * every class and preset with ability ranks, perks, Freshness and fresh entries, captains and vice captains. Pure and
 * deterministic in (content, index). Not used by the engine.
 */
import type { ContentDB } from '../content';
import { asId, type AbilityRanks, type PerkId, type RoundInput } from '../model';
import { Rng } from '../rng';
import { sideInput, type FighterSpec } from './build';
import { eligiblePerks } from './skills';

export interface CorpusRound {
  input: RoundInput;
  seed: string;
}

export function corpusRound(content: ContentDB, index: number): CorpusRound {
  const rng = Rng.create('sim-corpus', 'draft', index);
  const classes = content.classes.list;
  const pick = <T>(xs: readonly T[]): T => xs[rng.int(0, xs.length - 1)]!;
  const side = (clubId: string) => {
    const specs: FighterSpec[] = [];
    for (let i = 0; i < 5; i++) {
      const k = pick(classes);
      specs.push({ classId: k.id, baseStat: rng.int(6, 16), presetId: pick(k.presetIds), row: k.startingRow, captainQuality: rng.int(10, 90) });
    }
    const s = sideInput(content, clubId, specs, rng.int(0, 4), rng.int(0, 1) === 0 ? null : rng.int(0, 4));
    s.fighters = s.fighters.map((f) => {
      const k = content.classes.require(f.classId);
      const ranks: AbilityRanks = { a1: 1, a2: 1, passive: 1 };
      for (const slot of ['a1', 'a2', 'passive'] as const) {
        if (content.abilityRanks(k.abilities[slot])?.rankable) ranks[slot] = rng.int(1, 3) as 1 | 2 | 3;
      }
      const held: string[] = [];
      for (let j = rng.int(0, 3); j > 0; j--) {
        const options = eligiblePerks(content, f.classId, held, f.stats);
        if (options.length === 0) break;
        held.push(pick(options).id);
      }
      return { ...f, abilityRanks: ranks, perkIds: held.map((h) => asId<PerkId>(h)), freshness: rng.int(20, 100), enteredThisRound: rng.int(0, 5) === 0 };
    });
    return s;
  };
  return { input: { round: 1 + (index % 3), home: side('home'), away: side('away') }, seed: `corpus-${index}` };
}
