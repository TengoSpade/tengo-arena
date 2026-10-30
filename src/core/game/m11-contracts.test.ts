/**
 * M1.1 contracts phase: the new commands (squad.set, levelup.policy,
 * autoswap.set, pacing.set, match.swap, levelup.choose validation), swap
 * legality (combat-skills.md sys-match sw-002 .. sw-004) and the replay
 * record (roundInputOf). The orchestrator itself is WP-C's.
 */
import { describe, expect, it } from 'vitest';
import { asId, type ClubId, type Command, type FighterId, type GameState, type MatchResult, type SwapDecision } from '../model';
import { buildFixtureWorld, fixtureContent, fixtureMatchState, fixturePendingLevelUp, withFreshness } from '../testkit';
import { cloneJson } from '../util';
import { checkSwaps, createGameEngine, realGamePorts, roundInputOf } from './index';

const content = fixtureContent();
const engine = createGameEngine(realGamePorts);
const world = (): GameState => buildFixtureWorld({ clubLimit: 4, fightersPerClub: 8, squadReserves: 2 });

function code(state: GameState, command: Command): string | null {
  const r = engine.applyCommand(state, command, content);
  return r.ok ? null : r.error.code;
}
function apply(state: GameState, command: Command): GameState {
  const r = engine.applyCommand(state, command, content);
  if (!r.ok) throw new Error(`${command.type}: ${r.error.code} ${r.error.message}`);
  return r.value.state;
}
const player = (s: GameState): ClubId => s.playerClubId!;
const rosterIds = (s: GameState, c: ClubId): FighterId[] => Object.values(s.fighters).filter((f) => f.clubId === c).map((f) => f.id).sort();

describe('squad.set (5 starters + 0-2 reserves)', () => {
  it('sets starters and reserves; lineup.set keeps the reserves who are not starting', () => {
    const s = world();
    const c = player(s);
    const ids = rosterIds(s, c);
    const fighters = ids.slice(0, 5).map((fighterId) => ({ fighterId, row: 'front' as const }));
    const a = apply(s, { type: 'squad.set', clubId: c, fighters, reserves: [ids[5]!, ids[6]!], matchCaptainId: null });
    expect(a.clubs[c]!.lineup.reserves).toEqual([ids[5], ids[6]]);
    const b = apply(a, { type: 'lineup.set', clubId: c, fighters: [...fighters.slice(0, 4), { fighterId: ids[5]!, row: 'back' }], matchCaptainId: null });
    expect(b.clubs[c]!.lineup.reserves).toEqual([ids[6]]);
  });

  it('refuses a third reserve, a duplicate, a fighter off the roster, an injured reserve (sw-001)', () => {
    const s = world();
    const c = player(s);
    const ids = rosterIds(s, c);
    const fighters = ids.slice(0, 5).map((fighterId) => ({ fighterId, row: 'front' as const }));
    const other = rosterIds(s, Object.keys(s.clubs).find((x) => x !== c) as ClubId)[0]!;
    expect(code(s, { type: 'squad.set', clubId: c, fighters, reserves: [ids[5]!, ids[6]!, ids[7]!], matchCaptainId: null })).toBe('squad.reserves-size');
    expect(code(s, { type: 'squad.set', clubId: c, fighters, reserves: [ids[0]!], matchCaptainId: null })).toBe('squad.duplicate');
    expect(code(s, { type: 'squad.set', clubId: c, fighters, reserves: [other], matchCaptainId: null })).toBe('squad.not-on-roster');
    const hurt = cloneJson(s);
    hurt.fighters[ids[5]!]!.injury = { severity: 'minor', weeksOut: 2, fixtureId: null, round: null, causeFighterId: null, damageBp: 0, since: { season: 1, weekIndex: 1 } };
    expect(code(hurt, { type: 'squad.set', clubId: c, fighters, reserves: [ids[5]!], matchCaptainId: null })).toBe('squad.reserve-unfit');
  });
});

describe('settings commands', () => {
  it('levelup.policy per fighter and as the club default (never "inherit")', () => {
    const s = world();
    const c = player(s);
    const f = rosterIds(s, c)[0]!;
    expect(apply(s, { type: 'levelup.policy', clubId: c, fighterId: f, mode: 'auto_skills' }).fighters[f]!.levelUpMode).toBe('auto_skills');
    expect(apply(s, { type: 'levelup.policy', clubId: c, fighterId: null, mode: 'auto' }).clubs[c]!.levelUpDefault).toBe('auto');
    expect(code(s, { type: 'levelup.policy', clubId: c, fighterId: null, mode: 'inherit' })).toBe('levelup.mode');
  });

  it('autoswap.set validates the rules; pacing.set the two enums', () => {
    const s = world();
    const c = player(s);
    const rules = { ...s.clubs[c]!.autoSwap, mode: 'injured_only' as const, freshnessBelow: 50 };
    expect(apply(s, { type: 'autoswap.set', clubId: c, rules }).clubs[c]!.autoSwap).toEqual(rules);
    expect(code(s, { type: 'autoswap.set', clubId: c, rules: { ...rules, freshnessBelow: 101 } })).toBe('autoswap.rules');
    expect(code(s, { type: 'autoswap.set', clubId: c, rules: { ...rules, mode: 'always' as never } })).toBe('autoswap.rules');
    const p = apply(s, { type: 'pacing.set', clubId: c, levelUpPacing: 'fast', pauseBetweenRounds: 'when_urgent' }).clubs[c]!;
    expect([p.levelUpPacing, p.pauseBetweenRounds]).toEqual(['fast', 'when_urgent']);
    expect(code(s, { type: 'pacing.set', clubId: c, levelUpPacing: 'slow' as never, pauseBetweenRounds: 'never' })).toBe('pacing.level-up');
  });

  it('the player club gets the player defaults; AI clubs the AI defaults (levels.json, combat.json)', () => {
    const s = world();
    const c = s.clubs[player(s)]!;
    expect([c.levelUpDefault, c.levelUpPacing, c.pauseBetweenRounds, c.autoSwap.freshnessBelow, c.autoSwap.lostRoundBonus]).toEqual(['manual', 'detailed', 'always', 50, 10]);
    for (const k of Object.values(s.clubs)) if (k.id !== c.id) expect(k.levelUpDefault).toBe('auto');
  });
});

describe('levelup.choose validation (resolution is WP-B)', () => {
  it('unknown level and match in progress are refused before core/fighters runs', () => {
    const s = world();
    const c = player(s);
    const f = rosterIds(s, c)[0]!;
    expect(code(s, { type: 'levelup.choose', clubId: c, fighterId: f, level: 99, optionIndex: 0, traitIndex: null })).toBe('levelup.unknown');
    const live = cloneJson(s);
    live.fighters[f]!.pendingLevelUps = [fixturePendingLevelUp(live.fighters[f]!, content)];
    live.liveMatch = fixtureMatchState(live, c, Object.keys(live.clubs).find((x) => x !== c) as ClubId, content);
    expect(code(live, { type: 'levelup.choose', clubId: c, fighterId: f, level: live.fighters[f]!.pendingLevelUps[0]!.level, optionIndex: 0, traitIndex: null })).toBe('levelup.match-in-progress');
  });

  it('fixturePendingLevelUp: 3 options, a perk on every 3rd level', () => {
    const f = Object.values(world().fighters)[0]!;
    expect(fixturePendingLevelUp(f, content, { level: 22 }).options.map((o) => o.kind)).toEqual(['stat', 'stat', 'stat']);
    expect(fixturePendingLevelUp(f, content, { level: 24 }).options.map((o) => o.kind)).toEqual(['stat', 'stat', 'perk']);
  });
});

describe('swap legality (checkSwaps) and match.swap', () => {
  function between(): { s: GameState; c: ClubId } {
    const s = world();
    const c = player(s);
    const ms = fixtureMatchState(s, c, Object.keys(s.clubs).find((x) => x !== c) as ClubId, content);
    ms.phase = 'between_rounds';
    ms.score = { home: 0, away: 1 };
    ms.rounds = [{ round: 1 } as never];
    s.liveMatch = ms;
    return { s, c };
  }

  it('sw-002: a withdrawn fighter can never return (not_a_reserve); swaps run out at 2; first failure wins', () => {
    const { s } = between();
    const ms = s.liveMatch!;
    const h = ms.home;
    const [a, b] = [h.active[1]!, h.active[2]!];
    const [r1, r2] = [h.unusedReserves[0]!, h.unusedReserves[1]!];
    expect(checkSwaps(ms, 'home', [{ out: a, in: r1 }], 2).accepted).toHaveLength(1);
    // After that swap: A withdrawn, R1 active.
    h.active[1] = r1;
    h.withdrawn = [a];
    h.unusedReserves = [r2];
    h.swapsUsed = 1;
    expect(checkSwaps(ms, 'home', [{ out: r1, in: a }], 2).rejected[0]!.reason).toBe('not_a_reserve');
    expect(checkSwaps(ms, 'home', [{ out: a, in: r2 }], 2).rejected[0]!.reason).toBe('not_active');
    const two = checkSwaps(ms, 'home', [{ out: b, in: r2 }, { out: r1, in: r2 }], 2);
    expect(two.accepted).toHaveLength(1);
    expect(two.rejected[0]!.reason).toBe('no_swaps_left');
  });

  it('reserve_unfit, duplicate and match_decided', () => {
    const { s } = between();
    const ms = s.liveMatch!;
    const h = ms.home;
    const r1 = h.unusedReserves[0]!;
    const dup: SwapDecision[] = [{ out: h.active[0]!, in: r1 }, { out: h.active[0]!, in: h.unusedReserves[1]! }];
    expect(checkSwaps(ms, 'home', dup, 2).rejected[0]!.reason).toBe('duplicate');
    expect(checkSwaps(ms, 'home', [{ out: h.active[0]!, in: r1 }], 2, (id) => id === r1).rejected[0]!.reason).toBe('reserve_unfit');
    ms.score = { home: 0, away: 2 };
    expect(checkSwaps(ms, 'home', [{ out: h.active[0]!, in: r1 }], 2).rejected[0]!.reason).toBe('match_decided');
  });

  it('match.swap records the player decisions on the live match, refuses illegal ones, and needs a live match', () => {
    const { s, c } = between();
    const ms = s.liveMatch!;
    const swap = { out: ms.home.active[0]!, in: ms.home.unusedReserves[0]! };
    const after = apply(s, { type: 'match.swap', clubId: c, fixtureId: ms.fixtureId, afterRound: 1, swaps: [swap] });
    expect(after.liveMatch!.playerDecisions).toEqual([swap]);
    expect(code(s, { type: 'match.swap', clubId: c, fixtureId: ms.fixtureId, afterRound: 1, swaps: [{ out: swap.in, in: swap.out }] })).toBe('swap.not_active');
    expect(code(s, { type: 'match.swap', clubId: c, fixtureId: ms.fixtureId, afterRound: 2, swaps: [] })).toBe('match.not-between-rounds');
    expect(code(world(), { type: 'match.swap', clubId: c, fixtureId: ms.fixtureId, afterRound: 1, swaps: [] })).toBe('match.not-live');
  });

  it("match.swap is the player's alone: the opponent's club, a club that does not play, and any club without a player are refused with match.not-player-club", () => {
    const { s, c } = between();
    const ms = s.liveMatch!;
    const opponent = ms.away.clubId;
    const bystander = Object.keys(s.clubs).find((x) => x !== c && x !== opponent) as ClubId;
    // A legal swap for the opponent's side: it would be accepted if the command did not check who sends it.
    const theirs = { out: ms.away.active[0]!, in: ms.away.unusedReserves[0]! };
    expect(checkSwaps(ms, 'away', [theirs], 2).accepted).toHaveLength(1);
    for (const clubId of [opponent, bystander]) {
      const r = engine.applyCommand(s, { type: 'match.swap', clubId, fixtureId: ms.fixtureId, afterRound: 1, swaps: clubId === opponent ? [theirs] : [] }, content);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatchObject({ code: 'match.not-player-club', details: { clubId } });
    }
    // The refused command changed nothing: the player's decision slot is still empty.
    expect(s.liveMatch!.playerDecisions).toBeNull();
    // No player club (a headless or spectated match): nobody may send swaps.
    const headless = cloneJson(s);
    headless.playerClubId = null;
    expect(code(headless, { type: 'match.swap', clubId: c, fixtureId: ms.fixtureId, afterRound: 1, swaps: [] })).toBe('match.not-player-club');
    // The player's own club still works, and the check comes before the match state is looked at.
    expect(code(s, { type: 'match.swap', clubId: c, fixtureId: ms.fixtureId, afterRound: 1, swaps: [] })).toBeNull();
    expect(code(world(), { type: 'match.swap', clubId: opponent, fixtureId: ms.fixtureId, afterRound: 1, swaps: [] })).toBe('match.not-player-club');
  });
});

describe('replay record (roundInputOf)', () => {
  it('an M1 result replays every round from its input; a v3 record rebuilds slot, row, freshness, entry and acting-captain CQ', () => {
    const s = world();
    const c = player(s);
    const ms = fixtureMatchState(s, c, Object.keys(s.clubs).find((x) => x !== c) as ClubId, content);
    const result = { fixtureId: ms.fixtureId, input: ms.input } as MatchResult;
    expect(roundInputOf(result, 2)).toEqual({ round: 2, home: ms.input.home, away: ms.input.away });
    const reserve = ms.inputsById[ms.home.squad.reserves[0]!]!;
    const ids = [...ms.home.active];
    ids[3] = reserve.fighterId;
    const v3 = {
      ...result,
      reserveInputs: { home: [reserve], away: [] },
      roundLineups: [
        {
          round: 2,
          home: { fighterIds: ids, rows: ['front', 'front', 'back', 'back', 'back'], captainIndex: 1, viceCaptainIndex: null, captainQuality: 37, freshness: [90, 80, 70, 95, 60], entered: [false, false, false, true, false] },
          away: { fighterIds: ms.away.active, rows: ms.input.away.fighters.map((f) => f.row), captainIndex: 0, viceCaptainIndex: 1, captainQuality: 50, freshness: [100, 100, 100, 100, 100], entered: [false, false, false, false, false] },
        },
      ],
    } as MatchResult;
    const ri = roundInputOf(v3, 2);
    expect(ri.home.fighters[3]).toMatchObject({ fighterId: reserve.fighterId, slot: 3, row: 'back', freshness: 95, enteredThisRound: true });
    expect(ri.home.fighters[1]!.captainQuality).toBe(37);
    expect(ri.home.captainIndex).toBe(1);
    expect(ri.home.chemistry).toBe(ms.input.home.chemistry);
  });

  it('withFreshness sets tenths', () => {
    expect(withFreshness(Object.values(world().fighters)[0]!, 53.1).freshness10).toBe(531);
    expect(asId('x')).toBe('x');
  });
});
