/**
 * Internal adapter to core/fighters (WP2): the only place economy reads
 * fighters' derived values or creates fighters. Economy never computes
 * ratings itself (05 §3.1: "reads fighters' derived values").
 *
 * WP2 is merged (m1/wp2-fighters 5b46bf2): these call the real functions.
 * Unit tests that pin the 03 worked examples replace core/fighters with the
 * doubles in ./testing.ts (vi.mock); integration.test.ts uses the real module.
 */
import type { ContentDB } from '../content';
import { createFighter, humanAge100, isFit, potential, rating, type FighterSpec } from '../fighters';
import type { Fighter, FighterId, GameState } from '../model';

export function fighterRating(fighter: Fighter, content: ContentDB): number {
  return rating(fighter, content);
}

export function fighterPotential(fighter: Fighter, content: ContentDB): number {
  return potential(fighter, content);
}

/** Whole human-years: floor(age × 80 / lifespan) (03-league-economy merge note L1). */
export function fighterHumanAge(fighter: Fighter, content: ContentDB): number {
  return Math.floor(humanAge100(fighter, content) / 100);
}

export function fighterIsFit(fighter: Fighter): boolean {
  return isFit(fighter);
}

export function generateFighter(draft: GameState, spec: FighterSpec, content: ContentDB): FighterId {
  return createFighter(draft, spec, content);
}

export type { FighterSpec };
