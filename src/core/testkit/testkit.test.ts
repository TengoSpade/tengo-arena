import { describe, expect, it } from 'vitest';
import { cloneJson, stableStringify } from '../util';
import { buildFixtureWorld, fixtureContent } from './index';

describe('buildFixtureWorld', () => {
  it('is deterministic and JSON-safe', () => {
    const a = buildFixtureWorld({ clubLimit: 4 });
    expect(stableStringify(a)).toBe(stableStringify(buildFixtureWorld({ clubLimit: 4 })));
    expect(cloneJson(a)).toEqual(a);
  });

  it('gives every club a full lineup of its own fighters and default presets', () => {
    const content = fixtureContent();
    const state = buildFixtureWorld();
    expect(Object.keys(state.clubs)).toHaveLength(content.clubs.list.length);
    for (const club of Object.values(state.clubs)) {
      expect(club.lineup.fighters).toHaveLength(5);
      for (const entry of club.lineup.fighters) {
        expect(state.fighters[entry.fighterId]?.clubId).toBe(club.id);
        const tactics = club.lineup.tactics[entry.fighterId];
        expect(tactics?.kind).toBe('preset');
        if (tactics?.kind === 'preset') expect(content.presets.has(tactics.presetId)).toBe(true);
      }
    }
    const freeAgents = Object.values(state.fighters).filter((f) => f.status === 'free-agent');
    expect(freeAgents).toHaveLength(12);
    expect(state.playerClubId).not.toBeNull();
  });
});
