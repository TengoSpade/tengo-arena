/**
 * The player's squad "Auto-pick" (suggestLineup) accounts for Freshness the way the AI's rotation does:
 * it is the AI's own lineup rule (ai/policy.ts lineupFrom -> rotate, levels.json aiRotation), not a second
 * copy of it. A Spent starter is rested, a Tired one where a comparable fighter of his role family is rested,
 * and the two reserves are rested fighters.
 */
import { describe, expect, it } from 'vitest';
import { chooseLineup } from '../ai';
import { freshnessOf } from '../fighters';
import { asId, type ClubId, type Command, type Fighter, type FighterId, type Fixture, type GameState } from '../model';
import { buildFixtureWorld, fixtureContent, withFreshness } from '../testkit';
import { createGameEngine, realGamePorts } from './index';

const content = fixtureContent();
const engine = createGameEngine(realGamePorts);
const rot = content.levels.aiRotation;
const threshold = content.levels.freshness.threshold;

/** Two clubs of ten and the next match between them: a league match (default) or a Reckoning quarterfinal. */
function world(stage: Fixture['stage'] = 'league'): GameState {
  const s = buildFixtureWorld({ clubLimit: 2, fightersPerClub: 10, squadReserves: 2 });
  const [home, away] = Object.keys(s.clubs) as ClubId[];
  const fixture: Fixture = {
    id: asId('lg:1:t:1'),
    competitionId: asId('lg:1:t'),
    season: 1,
    tierId: s.clubs[home!]!.tierId,
    weekIndex: s.calendar.weekIndex,
    weekId: s.calendar.weekId!,
    stage,
    matchweek: 1,
    wing: null,
    homeClubId: home!,
    awayClubId: away!,
    bestOf: 3,
    venueId: null,
    status: 'scheduled',
  };
  s.fixtures[fixture.id] = fixture;
  return s;
}

function squadOf(state: GameState, clubId: ClubId): { starters: FighterId[]; reserves: FighterId[]; cmd: Extract<Command, { type: 'squad.set' }> } {
  const cmd = engine.suggestLineup(state, clubId, content);
  if (cmd.type !== 'squad.set') throw new Error(`suggestLineup gave ${cmd.type}`);
  return { starters: cmd.fighters.map((e) => e.fighterId), reserves: [...cmd.reserves], cmd };
}

function setFreshness(state: GameState, id: FighterId, value: number): void {
  state.fighters[id] = withFreshness(state.fighters[id]!, value) as Fighter;
}

describe('Auto-pick and Freshness (suggestLineup)', () => {
  it('the content thresholds the tests below are written against', () => {
    expect([rot.spentFloorAtLock, rot.spentFloorAltMin, threshold]).toEqual([15, 25, 50]);
  });

  it('a rested club keeps its best five and names two rested reserves', () => {
    const s = world();
    const club = s.playerClubId!;
    const { starters, reserves } = squadOf(s, club);
    expect(starters).toHaveLength(5);
    expect(reserves).toHaveLength(2);
    for (const id of [...starters, ...reserves]) expect(freshnessOf(s.fighters[id]!)).toBe(100);
  });

  it('rotates a Spent starter out (Freshness 10) and names someone rested in his place; he is not a reserve either', () => {
    const s = world();
    const club = s.playerClubId!;
    const base = squadOf(s, club);
    for (const spentId of base.starters) {
      const draft = structuredClone(s);
      setFreshness(draft, spentId, 10);
      expect(freshnessOf(draft.fighters[spentId]!)).toBeLessThan(rot.spentFloorAtLock);
      const next = squadOf(draft, club);
      expect(next.starters, `${spentId} stays a starter`).not.toContain(spentId);
      expect(next.reserves, `${spentId} is named a reserve`).not.toContain(spentId);
      expect(next.starters).toHaveLength(5);
      // Everyone who came in is a rested fighter (the floor asks for at least spentFloorAltMin, the Tired step for the threshold).
      for (const id of next.starters.filter((x) => !base.starters.includes(x))) expect(freshnessOf(draft.fighters[id]!)).toBeGreaterThanOrEqual(rot.spentFloorAltMin);
      // The command is one the rulebook accepts as is.
      const applied = engine.applyCommand(draft, next.cmd, content);
      expect(applied.ok).toBe(true);
      if (applied.ok) expect(applied.value.state.clubs[club]!.lineup.fighters.map((e) => e.fighterId)).toEqual(next.starters);
    }
  });

  it('is the AI lineup rule, not a copy: the suggestion equals ai.chooseLineup for the same state', () => {
    const s = world();
    const club = s.playerClubId!;
    const ids = squadOf(s, club).starters;
    setFreshness(s, ids[1]!, 12);
    setFreshness(s, ids[3]!, 52);
    const suggestion = squadOf(s, club);
    const ai = chooseLineup(s, club, content);
    expect(suggestion.starters).toEqual(ai.fighters.map((e) => e.fighterId));
    expect(suggestion.reserves).toEqual(ai.reserves);
  });

  it('rests a Tired starter when a comparable fighter of his role family is rested (the other healer takes over), not otherwise', () => {
    const s = world();
    const club = s.playerClubId!;
    const base = squadOf(s, club);
    const roster = Object.values(s.fighters).filter((f) => f.clubId === club);
    const byClass = (classId: string, starter: boolean): Fighter => roster.find((f) => f.classId === classId && base.starters.includes(f.id) === starter)!;
    // The fixture club fields one healer (Chirurgeon) and has a second one on the bench, one rating point below.
    const healer = byClass('chirurgeon', true);
    const spareHealer = byClass('chirurgeon', false);
    expect(spareHealer).toBeDefined();
    const tired = structuredClone(s);
    setFreshness(tired, healer.id, 45); // Tired, above the spent floor: only the comparable-alternative step can rest him
    expect(freshnessOf(tired.fighters[healer.id]!)).toBeGreaterThanOrEqual(rot.spentFloorAtLock);
    const rotated = squadOf(tired, club);
    expect(rotated.starters).not.toContain(healer.id);
    expect(rotated.starters).toContain(spareHealer.id);
    expect(rotated.reserves).not.toContain(healer.id); // 45 is below the threshold: not a reserve either
    // The Oathguard has no tank on the bench: nobody comparable is rested, so a Tired Oathguard stays.
    const tank = byClass('oathguard', true);
    const tankTired = structuredClone(s);
    setFreshness(tankTired, tank.id, 45);
    expect(squadOf(tankTired, club).starters).toContain(tank.id);
    // With the whole club Tired nobody is rested: the best five stay and no reserve is named below the threshold.
    const allTired = structuredClone(s);
    for (const f of roster) setFreshness(allTired, f.id, 45);
    const stuck = squadOf(allTired, club);
    expect(stuck.starters).toEqual(base.starters);
    expect(stuck.reserves).toEqual([]);
  });

  it('in a Reckoning week the rest threshold is lower (Tired 30 stays, 20 goes), as in the AI rule', () => {
    const s = world('quarterfinal');
    const club = s.playerClubId!;
    const base = squadOf(s, club);
    const roster = Object.values(s.fighters).filter((f) => f.clubId === club);
    const healer = roster.find((f) => f.classId === 'chirurgeon' && base.starters.includes(f.id))!;
    const spareHealer = roster.find((f) => f.classId === 'chirurgeon' && !base.starters.includes(f.id))!;
    expect(rot.tournamentRestBelow).toBe(25);
    const at30 = structuredClone(s);
    setFreshness(at30, healer.id, 30);
    expect(squadOf(at30, club).starters).toContain(healer.id);
    const at20 = structuredClone(s);
    setFreshness(at20, healer.id, 20);
    const rotated = squadOf(at20, club);
    expect(rotated.starters).not.toContain(healer.id);
    expect(rotated.starters).toContain(spareHealer.id);
  });

  it('reserves are rested fighters: a bench fighter below the Freshness threshold is not named, a rested one is', () => {
    const s = world();
    const club = s.playerClubId!;
    const base = squadOf(s, club);
    const [first, second] = base.reserves;
    const draft = structuredClone(s);
    setFreshness(draft, first!, 30);
    const next = squadOf(draft, club);
    expect(next.reserves).not.toContain(first!);
    expect(next.reserves).toContain(second!);
    for (const id of next.reserves) expect(freshnessOf(draft.fighters[id]!)).toBeGreaterThanOrEqual(threshold);
    expect(next.starters).toEqual(base.starters);
  });
});
