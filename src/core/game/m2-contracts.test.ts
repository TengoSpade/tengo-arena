/**
 * M2 contracts phase (docs/design/_drafts/05-technical-m2.md §A3, review finding B2): the round the player watches
 * is the round that is committed. prepareRound is the one builder of a round's input; playRound plays exactly
 * what it returns; and no command the player may send while his match is live can change the next round's input.
 * The watch flow itself is WP-M2B's.
 */
import { describe, expect, it } from 'vitest';
import { asId, type ClubId, type Command, type FighterId, type GameState } from '../model';
import { simulateRound } from '../sim';
import { buildFixtureWorld, fixtureContent, fixtureMatchState } from '../testkit';
import { cloneJson, stableStringify } from '../util';
import { LIVE_MATCH_ALLOWED } from './commands';
import { createGameEngine, playRound, prepareRound, realGamePorts } from './index';

const content = fixtureContent();
const engine = createGameEngine(realGamePorts);

/** A world whose player club has a live match waiting for round 1 (phase round_pending), as a watched match will. */
function liveWorld(): { s: GameState; c: ClubId } {
  const s = buildFixtureWorld({ clubLimit: 4, fightersPerClub: 8, squadReserves: 2 });
  const c = s.playerClubId!;
  s.liveMatch = fixtureMatchState(s, c, Object.keys(s.clubs).find((x) => x !== c) as ClubId, content);
  return { s, c };
}

const inputKey = (s: GameState): string => stableStringify(prepareRound(realGamePorts, s, s.liveMatch!, content));

describe('prepareRound: the one builder of a round input (watched = committed)', () => {
  it('is read-only and repeatable', () => {
    const { s } = liveWorld();
    const before = stableStringify(s);
    const a = prepareRound(realGamePorts, s, s.liveMatch!, content);
    const b = prepareRound(realGamePorts, s, s.liveMatch!, content);
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(stableStringify(s)).toBe(before);
    expect(a.round).toBe(1);
    expect(a.input.home.fighters).toHaveLength(5);
    expect(a.input.away.fighters).toHaveLength(5);
  });

  it('playRound plays exactly the prepared round: same lineup record, seed and checksum', () => {
    const { s } = liveWorld();
    const prepared = prepareRound(realGamePorts, s, s.liveMatch!, content);
    const draft = cloneJson(s);
    const outcome = playRound(realGamePorts, draft, draft.liveMatch!, content);
    const played = draft.liveMatch!;
    expect(outcome.result.seed).toBe(prepared.seed);
    const { freshnessAfter: _h, ...homeLineup } = played.roundLineups[0]!.home;
    const { freshnessAfter: _a, ...awayLineup } = played.roundLineups[0]!.away;
    expect(stableStringify({ ...played.roundLineups[0]!, home: homeLineup, away: awayLineup })).toBe(stableStringify(prepared.lineups));
    // What a viewer would be shown (the same input at 'full') is the round that was committed.
    const viewed = simulateRound(prepared.input, prepared.seed, content, { record: 'full' });
    expect(viewed.result.checksum).toBe(outcome.result.checksum);
    expect(viewed.log?.hash).toBeTruthy();
  });
});

describe('commands allowed during a live match never touch the next round input', () => {
  it('covers every command in LIVE_MATCH_ALLOWED; match.swap is refused while a round is pending', () => {
    const { s, c } = liveWorld();
    const other = Object.values(s.fighters).find((f) => f.clubId !== c)!.id as FighterId;
    const commands: Record<string, Command> = {
      'match.swap': { type: 'match.swap', clubId: c, fixtureId: s.liveMatch!.fixtureId, afterRound: 0, swaps: [] },
      'news.markRead': { type: 'news.markRead', newsIds: [] },
      'news.setRead': { type: 'news.setRead', newsIds: [], read: false },
      'shortlist.toggle': { type: 'shortlist.toggle', clubId: c, fighterId: other },
      'levelup.policy': { type: 'levelup.policy', clubId: c, fighterId: null, mode: 'auto' },
      'autoswap.set': { type: 'autoswap.set', clubId: c, rules: { ...s.clubs[c]!.autoSwap, freshnessBelow: 70, lostRoundBonus: 0 } },
      'pacing.set': { type: 'pacing.set', clubId: c, levelUpPacing: 'fast', pauseBetweenRounds: 'never' },
    };
    expect(Object.keys(commands).sort()).toEqual([...LIVE_MATCH_ALLOWED].sort());

    const before = inputKey(s);
    for (const [type, command] of Object.entries(commands)) {
      const r = engine.applyCommand(s, command, content);
      if (type === 'match.swap') {
        expect(r.ok ? null : r.error.code).toBe('match.not-between-rounds');
        continue;
      }
      expect(r.ok, `${type}: ${r.ok ? '' : r.error.code}`).toBe(true);
      if (r.ok) expect(inputKey(r.value.state), type).toBe(before);
    }
    // Everything else waits until the match is over (a squad change, for one).
    const ids = Object.values(s.fighters).filter((f) => f.clubId === c).map((f) => asId<FighterId>(f.id));
    const squad = engine.applyCommand(s, { type: 'squad.set', clubId: c, fighters: ids.slice(0, 5).map((fighterId) => ({ fighterId, row: 'front' })), reserves: [], matchCaptainId: null }, content);
    expect(squad.ok ? null : squad.error.code).toBe('match.in-progress');
  });
});
