/** Small shared helpers of core/league (internal). */
import type { ContentDB, TierDef } from '../content';
import { asId, type ClubId, type Competition, type CompetitionKind, type Fixture, type GameState, type TierId } from '../model';
import { compareStrings, invariant } from '../util';

/** Tiers from the top (level 1) down. */
export function tiersByLevel(content: ContentDB): TierDef[] {
  return [...content.leagues.tiers].sort((a, b) => a.level - b.level);
}

/** Clubs currently in a tier, by club id. */
export function clubsInTier(state: GameState, tierId: TierId): ClubId[] {
  return Object.values(state.clubs)
    .filter((c) => c.tierId === tierId)
    .map((c) => c.id)
    .sort(compareStrings);
}

/** Competitions of a season (optionally of one kind), by competition id. */
export function seasonCompetitions(state: GameState, season: number, kind?: CompetitionKind): Competition[] {
  return Object.values(state.competitions)
    .filter((c) => c.season === season && (kind === undefined || c.kind === kind))
    .sort((a, b) => compareStrings(a.id, b.id));
}

/** Every fixture of the season's competitions (unordered). */
export function seasonFixtures(state: GameState, season: number): Fixture[] {
  const out: Fixture[] = [];
  for (const comp of seasonCompetitions(state, season)) {
    for (const id of comp.fixtureIds) {
      const f = state.fixtures[id];
      invariant(f, `competition ${comp.id} lists unknown fixture ${id}`);
      out.push(f);
    }
  }
  return out;
}

/** Schedule order: week, then fixture id. */
export function compareFixtures(a: Fixture, b: Fixture): number {
  return a.weekIndex - b.weekIndex || compareStrings(a.id, b.id);
}

export function requireCompetition(state: GameState, id: string): Competition {
  const comp = state.competitions[asId<Competition['id']>(id)];
  invariant(comp, `unknown competition ${id}`);
  return comp;
}

/** Tier one level above / below, or null at the ends of the ladder. */
export function adjacentTier(content: ContentDB, tierId: TierId, offset: -1 | 1): TierDef | null {
  const level = content.tiers.require(tierId).level + offset;
  return content.leagues.tiers.find((t) => t.level === level) ?? null;
}
