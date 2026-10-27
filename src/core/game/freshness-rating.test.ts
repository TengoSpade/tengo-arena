/**
 * R2-T002 at the game level: FighterView carries the Freshness, the effective rating and the delta (real ports), and the
 * severity curve core/fighters re-derives equals the one the sim applies (the round recap's fatigueBp).
 */
import { describe, expect, it } from 'vitest';
import { freshnessSeverityBp } from '../fighters';
import { asId, type ClubId, type PerkId } from '../model';
import { simulateRound, sideInput, type FighterSpec } from '../sim';
import { buildFixtureWorld, fixtureContent, withFreshness } from '../testkit';
import { createGameEngine, realGamePorts } from './index';

const content = fixtureContent();

describe('FighterView: Freshness and effective rating (R2-T002)', () => {
  const engine = createGameEngine(realGamePorts);
  const s = buildFixtureWorld({ clubLimit: 2, fightersPerClub: 8 });
  const club = Object.keys(s.clubs)[0] as ClubId;

  it('a rested fighter: effective rating = rating, delta 0, Freshness 100', () => {
    const id = engine.roster(s, club, content)[0]!.id;
    const v = engine.fighterView(s, id, content);
    expect(v).toMatchObject({ freshness: 100, effectiveRating: v.rating, freshnessRatingDelta: 0 });
    expect(v.freshnessRating).toMatchObject({ freshness: 100, severityBp: 0, rating: v.rating, effectiveRating: v.rating, delta: 0 });
  });

  it('a spent fighter: the view shows his Freshness and a clearly lower effective rating; the rating column is untouched', () => {
    const id = engine.roster(s, club, content)[0]!.id;
    const rested = engine.fighterView(s, id, content);
    const spent: typeof s = { ...s, fighters: { ...s.fighters, [id]: withFreshness(s.fighters[id]!, 8) } };
    const v = engine.fighterView(spent, id, content);
    expect(v.rating).toBe(rested.rating);
    expect(v.freshness).toBe(8);
    expect(v.freshnessRatingDelta).toBeLessThanOrEqual(-3);
    expect(v.effectiveRating).toBe(v.rating + v.freshnessRatingDelta!);
    expect(v.freshnessRating!.severityBp).toBe(10_000);
    // 59 is the first Tired-by-the-sim step: a sliver of penalty, and 60 none.
    for (const [fresh, severity] of [[60, 0], [59, 200], [35, 5_000]] as const) {
      const w = engine.fighterView({ ...s, fighters: { ...s.fighters, [id]: withFreshness(s.fighters[id]!, fresh) } }, id, content);
      expect(w.freshnessRating!.severityBp).toBe(severity);
    }
  });

  it('every fighter on a roster has the fields (the roster table reads them per row)', () => {
    for (const f of engine.roster(s, club, content)) {
      const v = engine.fighterView(s, f.id, content);
      expect(v.effectiveRating).toBeLessThanOrEqual(v.rating);
      expect(v.freshnessRatingDelta).toBe(v.effectiveRating! - v.rating);
    }
  });
});

describe('the severity curve equals the sim\'s (round recap fatigueBp)', () => {
  const specs: FighterSpec[] = ['oathguard', 'gutterknife', 'longeye', 'rimebinder', 'chirurgeon'].map((classId) => ({ classId }));

  it('for every Freshness 0-100, with and without Long Wind', () => {
    const away = sideInput(content, 'a', specs);
    for (const perks of [[], ['g_long_wind']]) {
      const resist = perks.length > 0 ? 0.4 : 0;
      for (let fresh = 0; fresh <= 100; fresh += 1) {
        const home = sideInput(content, 'h', specs);
        home.fighters[0] = { ...home.fighters[0]!, freshness: fresh, perkIds: perks.map((p) => asId<PerkId>(p)) };
        const out = simulateRound({ round: 1, home, away }, `sev-${fresh}`, content, { record: 'summary' });
        const recap = out.log!.events.find((e) => e.type === 'round.summary')!.data!.units[0] as unknown as { freshness: number; fatigueBp: number };
        expect(recap.freshness).toBe(fresh);
        expect(freshnessSeverityBp(fresh, resist, content), `F ${fresh} resist ${resist}`).toBe(recap.fatigueBp);
      }
    }
  });
});
