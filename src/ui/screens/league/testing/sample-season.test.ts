import { describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent } from '../../../../core/testkit';
import { leagueCompetitionId, reckoningCompetitionId, type TierId } from '../../../../core/model';
import { buildFakeMatchReportFor, makeSampleWorld } from './worlds';
import { standings } from './fake-core';
import { buildSampleSeason } from './sample-season';

describe('WP7 sample season (test data)', () => {
  it('schedules 16 league fixtures per club, 8 at home, one per matchweek', () => {
    const content = fixtureContent();
    const state = buildSampleSeason(buildFixtureWorld(), content, { stage: 'mid' });
    const club = state.playerClubId!;
    const mine = Object.values(state.fixtures).filter((f) => f.season === 2 && f.stage === 'league' && (f.homeClubId === club || f.awayClubId === club));
    expect(mine).toHaveLength(16);
    expect(mine.filter((f) => f.homeClubId === club)).toHaveLength(8);
    expect(new Set(mine.map((f) => f.matchweek)).size).toBe(16);
  });

  it('plays the weeks before the current one and derives standings from them', () => {
    const content = fixtureContent();
    const state = buildSampleSeason(buildFixtureWorld(), content, { stage: 'mid' });
    const tierId = state.clubs[state.playerClubId!]!.tierId as TierId;
    const rows = standings(state, leagueCompetitionId(2, tierId), 'tier', content);
    expect(rows).toHaveLength(16);
    expect(rows.every((r) => r.played === 7)).toBe(true);
    expect(rows[0]!.points).toBeGreaterThanOrEqual(rows[15]!.points);
  });

  it('builds a Reckoning bracket in the tournament and a complete one after the final', () => {
    const content = fixtureContent();
    const t = buildSampleSeason(buildFixtureWorld(), content, { stage: 'tournament' });
    const tierId = t.clubs[t.playerClubId!]!.tierId as TierId;
    const rk = t.competitions[reckoningCompetitionId(2, tierId)]!;
    expect(rk.bracket!.seeds).toHaveLength(8);
    expect(rk.bracket!.rounds[0]!.ties.every((x) => x.winnerClubId)).toBe(true);
    expect(rk.bracket!.championId).toBeNull();
    const done = buildSampleSeason(buildFixtureWorld(), content, { stage: 'season-over' });
    expect(done.competitions[reckoningCompetitionId(2, tierId)]!.bracket!.championId).not.toBeNull();
  });

  it('gives every played match a report the screens can read', () => {
    const { state, content } = makeSampleWorld({ buildFixtureWorld, fixtureContent }, 'mid');
    const fixture = Object.values(state.fixtures).find((f) => state.results[f.id] && f.homeClubId === state.playerClubId)!;
    const report = buildFakeMatchReportFor(state, content, fixture.id);
    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.value.fighters).toHaveLength(10);
      expect(report.value.rounds.length).toBeGreaterThanOrEqual(2);
    }
  });
});
