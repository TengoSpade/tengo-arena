/**
 * WP3 acceptance (05 §9.2): a full fixture list for all 48 clubs is generated
 * deterministically in < 50 ms. Own file, so the timed call runs on a cold
 * module (no earlier test has warmed the schedule code). Vitest fails a
 * synchronous test that overruns its timeout, so the 50 ms is enforced.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { GameState } from '../model';
import { buildFixtureWorld, fixtureContent } from '../testkit';
import { cloneJson, stableStringify } from '../util';
import { setupSeason } from './index';

const content = fixtureContent();
let world: GameState;
let timed: GameState;

beforeAll(() => {
  world = buildFixtureWorld();
  timed = cloneJson(world);
});

describe('48-club fixture generation budget', () => {
  it('generates every season-1 fixture of all 3 tiers within 50 ms', () => {
    setupSeason(timed, 1, content);
    expect(Object.keys(timed.fixtures)).toHaveLength(384);
  }, 50);

  it('generates the identical list again from the same world', () => {
    const again = cloneJson(world);
    setupSeason(again, 1, content);
    expect(stableStringify(again)).toBe(stableStringify(timed));
  });
});
