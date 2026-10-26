/**
 * M1.1 lifecycle acceptance (progression.md §8): bench XP (bxp-001 … bxp-005), levels and offers
 * (lvl-002 … lvl-014; lvl-001, lvl-004 and lvl-005 are in levels.test.ts), Freshness (frs-001 … frs-010),
 * immediate injuries (inj-010), Losing the Room rests (cap-011), chemistry kept at the lock (chem-003),
 * Stamina generation and aging (sta-001, sta-002).
 */
import { describe, expect, it } from 'vitest';
import { buildFixtureWorld, fixtureContent, fixtureMatchState, makeFixtureFighter, withFreshness } from '../testkit';
import { cloneJson } from '../util';
import { putResult } from '../model';
import type {
  ClassId,
  ClubId,
  Fighter,
  FighterId,
  GameState,
  MatchResult,
  PaceId,
  PendingLevelUp,
  PerkId,
  RaceId,
  RoundAftermath,
  RoundOutcome,
  StatId,
  TraitId,
  WeekId,
} from '../model';

import {
  autoPickChoice,
  effectiveStats,
  freshnessAfterRound,
  freshnessBetweenRounds,
  injuriesAfterRound,
  levelEtaMatches,
  lineupChemistry,
  lineupLock,
  matchEndProgression,
  offseasonRecovery,
  potential,
  rating,
  resolveLevelUp,
  seasonEndDevelopment,
  typicalRoundDrain10,
  weeklyLifecycle,
  weeklyRest10,
  xpAfterRound,
} from './index';
import { benchXpFor, checkLevelUps, clubMatchXp, type MatchProgressionOutcome } from './progression';
import { generateOffer, optionScore } from './offers';
import { roundDrain10 } from './freshness';
import { roundInjuryChanceBp } from './injury';
import { physicalWeightShare, trainedRating, xpNeededFor } from './levels';
import { staminaCap100 } from './generation';
import { applySeasonWear } from './development';
import { maturityBp } from './stats';
import { makeResult, withStats } from './testing';

const content = fixtureContent();
const STA = 'stamina' as StatId;
const all = (v: number): Record<StatId, number> => Object.fromEntries(content.stats.list.map((s) => [s.id, v])) as Record<StatId, number>;

function at(s: GameState, weekIndex: number, season = 1): void {
  const w = content.weekByIndex(weekIndex);
  s.calendar = { season, weekIndex, weekId: w.id as WeekId, phase: w.phase };
}

function world(): { s: GameState; a: ClubId; b: ClubId } {
  const s = buildFixtureWorld({ clubLimit: 2, squadReserves: 2 });
  at(s, 9);
  const [a, b] = Object.keys(s.clubs) as ClubId[];
  return { s, a: a!, b: b! };
}

function after(fighterId: FighterId, side: 'home' | 'away', o: Partial<RoundAftermath> = {}): RoundAftermath {
  return { fighterId, side, damageTaken: 600, maxHp: 1000, downed: false, largestHit: 100, downCause: null, downsInflicted: 0, ...o };
}

function outcome(round: number, winner: 'home' | 'away', aftermath: RoundAftermath[], durationS = 30): RoundOutcome {
  return {
    result: {
      round,
      seed: 'r',
      winner,
      endReason: 'elimination',
      tiebreakStep: null,
      durationTicks: durationS * 20,
      survivors: { home: 0, away: 0 },
      downs: { home: 0, away: 0 },
      finalHp: [],
      checksum: '0',
      eventHash: null,
    },
    aftermath,
  };
}

/** A fighter with exact effective stats (all 10 unless given), steady human Oathguard. */
function plain(stats: Record<string, number> = {}, extra: Partial<Fighter> = {}): Fighter {
  return { ...withStats(makeFixtureFighter(1, content, { raceId: 'human' as RaceId, classId: 'oathguard' as ClassId, age: 26, paceId: 'steady' as PaceId }), content, stats), ...extra };
}

const empty = (): MatchProgressionOutcome => ({ benchXp: {}, levelUps: [], autoResolved: [], newsIds: [] });

// ---- bench XP (T004) ---------------------------------------------------------------------------------

describe('bench XP (T004)', () => {
  it('bxp-001: a 2-1 win worth 196 club XP gives a bench fighter floor(196 × 3,333 ÷ 50,000) = 13; Glory-Hungry 15', () => {
    const f = plain();
    expect(benchXpFor(f, 196, content)).toBe(13);
    expect(benchXpFor({ ...f, traits: [{ id: 'glory_hungry' as TraitId, gainedSeason: 1, source: 'rolled' }] }, 196, content)).toBe(15);
    expect(benchXpFor(f, 146, content)).toBe(9); // a 2-0 sweep
  });

  function playedResult(s: GameState, a: ClubId, b: ClubId, opts: { swapOutAfter1?: FighterId; reserveIn?: FighterId } = {}): MatchResult {
    const home = s.clubs[a]!.lineup.fighters.map((e) => e.fighterId);
    const away = s.clubs[b]!.lineup.fighters.map((e) => e.fighterId);
    const r = makeResult(s, content, { homeClubId: a, awayClubId: b, home, away, rounds: [{ winner: 'away' }, { winner: 'home' }, { winner: 'home' }] });
    const reserves = s.clubs[a]!.lineup.reserves;
    const side = (ids: FighterId[]) => ({ fighterIds: ids, rows: ids.map(() => 'front' as const), captainIndex: 0, viceCaptainIndex: null, captainQuality: 50, freshness: ids.map(() => 100), entered: ids.map(() => false) });
    const later = opts.swapOutAfter1 && opts.reserveIn ? home.map((id) => (id === opts.swapOutAfter1 ? opts.reserveIn! : id)) : home;
    r.roundLineups = [1, 2, 3].map((round) => ({ round, home: side(round === 1 ? home : later), away: side(away) }));
    r.squads = {
      home: { starters: home, reserves, rows: {}, captainId: s.clubs[a]!.captainId, viceCaptainId: s.clubs[a]!.viceCaptainId },
      away: { starters: away, reserves: s.clubs[b]!.lineup.reserves, rows: {}, captainId: null, viceCaptainId: null },
    };
    if (opts.swapOutAfter1 && opts.reserveIn) {
      r.fighterStats[opts.swapOutAfter1]!.roundsPlayed = 1;
      r.fighterStats[opts.reserveIn] = { ...r.fighterStats[opts.swapOutAfter1]!, roundsPlayed: 2 };
    }
    return r;
  }

  it('bxp-001 / bxp-002 / bxp-003 at match end: bench and unused reserves get ⅓ of a slot, injured 0; reserves rest 80%', () => {
    const { s, a, b } = world();
    const res = s.clubs[a]!.lineup.reserves[0]!;
    const outside = Object.values(s.fighters).find((f) => f.clubId === a && !s.clubs[a]!.lineup.fighters.some((e) => e.fighterId === f.id) && !s.clubs[a]!.lineup.reserves.includes(f.id))!;
    const hurt = s.clubs[a]!.lineup.reserves[1]!;
    s.fighters[hurt]!.injury = { severity: 'minor', weeksOut: 2, fixtureId: null, round: 1, causeFighterId: null, damageBp: 0, since: { season: 1, weekIndex: 7 } };
    const r = playedResult(s, a, b);
    const expected = benchXpFor(s.fighters[res]!, clubMatchXp(r, a, content), content);
    const out = matchEndProgression(s, r, content);
    expect(expected).toBeGreaterThan(0);
    expect(out.benchXp[res]).toBe(expected);
    expect(out.benchXp[outside.id]).toBe(expected);
    expect(out.benchXp[hurt] ?? 0).toBe(0); // bxp-003
    expect(s.fighters[res]!.season.benchXp).toBe(expected);
    expect(s.fighters[res]!.season.squadReserveMatches).toBe(1);
    // bxp-002: at this week's processing the unused reserve rests 80%, the outside fighter 100%.
    putResult(s, r);
    for (const id of [res, outside.id]) s.fighters[id] = withFreshness(s.fighters[id]!, 50);
    const restReserve = weeklyRest10(s.fighters[res]!, content, true);
    const restOutside = weeklyRest10(s.fighters[outside.id]!, content, false);
    weeklyLifecycle(s, content);
    expect(s.fighters[res]!.freshness10).toBe(500 + restReserve);
    expect(s.fighters[outside.id]!.freshness10).toBe(500 + restOutside);
    const starter = r.roundLineups![0]!.home.fighterIds[0]!;
    expect(s.fighters[starter]!.season.restWeeks).toBe(0); // started a round: no rest that week
  });

  it('bxp-004 / bxp-005: a starter swapped out after a lost round 1 keeps 10 XP and no bench XP; the entering reserve earns 15 + 15', () => {
    const { s, a, b } = world();
    const ms = fixtureMatchState(s, a, b, content);
    const out1 = ms.home.active[1]!;
    const inR = ms.home.unusedReserves[0]!;
    // Round 1 lost, he is downed with no credit.
    xpAfterRound(s, ms, outcome(1, 'away', [after(out1, 'home', { downed: true })]), content);
    expect(s.fighters[out1]!.season.roundXp).toBe(10);
    // Rounds 2 and 3 won by the reserve with a down credit each, not downed.
    xpAfterRound(s, ms, outcome(2, 'home', [after(inR, 'home', { downsInflicted: 1 })]), content);
    xpAfterRound(s, ms, outcome(3, 'home', [after(inR, 'home', { downsInflicted: 1 })]), content);
    expect(s.fighters[inR]!.season.roundXp).toBe(30);
    const r = playedResult(s, a, b, { swapOutAfter1: out1, reserveIn: inR });
    const prog = matchEndProgression(s, r, content);
    expect(prog.benchXp[out1]).toBeUndefined();
    expect(prog.benchXp[inR]).toBeUndefined();
    expect(s.fighters[out1]!.season.benchXp).toBe(0);
    expect(s.fighters[inR]!.season.roundsStarted).toBe(2);
    expect(s.fighters[out1]!.season.roundsStarted).toBe(1);
  });
});

// ---- levels and XP per level ------------------------------------------------------------------------

describe('XP per level (worked examples on fixture classes)', () => {
  const caps = all(1300);
  const base = (classId: string, age: number, extra: Partial<Fighter> = {}) =>
    makeFixtureFighter(1, content, { raceId: 'human' as RaceId, classId: classId as ClassId, age, paceId: 'steady' as PaceId, cap100: caps, train100: all(1100), traits: [], ...extra });

  it('lvl-002 shape: a 19-year-old Brisk ranged prospect with gap ≥ 15: (115.6 + 0.6 L) × A × 0.9 ÷ 1.15; Quick Study and an A captain divide it', () => {
    const w = physicalWeightShare('longeye', content);
    const f = base('longeye', 19, { paceId: 'brisk' as PaceId, level: 8, train100: all(1000) });
    expect(potential(f, content) - trainedRating(f, content)).toBe(15); // G = 0.9 (15-21)
    const a = w * 0.72 + (1 - w) * 0.85;
    const round5 = (x: number) => Math.max(60, 5 * Math.round(x / 5));
    expect(xpNeededFor(f, content)).toBe(round5((115 + 0.6 * 8) * a * 0.9 / 1.15));
    const qs = { ...f, traits: [{ id: 'quick_study' as TraitId, gainedSeason: 1, source: 'rolled' as const }] };
    expect(xpNeededFor(qs, content)).toBe(round5((115 + 0.6 * 8) * a * 0.9 / (1.15 * (w + (1 - w) * 1.2))));
    expect(xpNeededFor(f, content, { mentor: 1.08 })).toBe(round5((115 + 0.6 * 8) * a * 0.9 / (1.15 * 1.08)));
  });

  it('lvl-003: Chirurgeon human 33, Steady, level 34, gap 1 -> 135.4 × 1.417 × 2.6 = 498.8 -> 500', () => {
    const f = base('chirurgeon', 33, { level: 34, train100: all(1300) });
    // Lower the heaviest stats until the trained rating is exactly 1 below potential.
    const order = (['awr', 'spi', 'cmp'] as StatId[]);
    for (const id of order) {
      if (potential(f, content) - trainedRating(f, content) >= 1) break;
      f.train100 = { ...f.train100, [id]: 1200 };
    }
    expect(potential(f, content) - trainedRating(f, content)).toBe(1);
    expect(physicalWeightShare('chirurgeon', content)).toBeCloseTo(0.31, 10);
    expect(xpNeededFor(f, content)).toBe(500);
  });

  it('a young high-potential human levels about 2.3 matches apart, a mid-age starter about 4.8, a veteran near his caps about 15', () => {
    const young = base('longeye', 19, { paceId: 'brisk' as PaceId, level: 8, train100: all(800) });
    const mid = makeFixtureFighter(1, content, { raceId: 'human' as RaceId, classId: 'oathguard' as ClassId, age: 25, paceId: 'steady' as PaceId, cap100: all(1300), train100: all(1100), traits: [], level: 20 });
    expect(xpNeededFor(young, content) / 32).toBeLessThan(3);
    expect(xpNeededFor(mid, content)).toBe(155);
    expect(xpNeededFor(mid, content) / 32).toBeCloseTo(4.84, 1);
  });

  it('lvl-006: xpNeeded 60, bar 50, match XP 150 -> two level-ups; the rest stays in the bar; the third comes at the next match end', () => {
    const { s, a } = world();
    const id = s.clubs[a]!.lineup.fighters[0]!.fighterId;
    const f = s.fighters[id]!;
    Object.assign(f, { level: 1, xpNeeded: 60, xpIntoLevel: 50 + 150, levelUpMode: 'auto' });
    const out = empty();
    checkLevelUps(s, f, content, out);
    expect(out.levelUps.map((l) => l.level)).toEqual([2, 3]);
    expect(f.career.levelsGained).toBe(2);
    // The bar after: 200 − 60 − (the level-2 requirement); with a huge bar the extra waits for the next match end.
    f.xpIntoLevel = 10 * f.xpNeeded;
    const held = f.xpIntoLevel;
    const next = empty();
    checkLevelUps(s, f, content, next);
    expect(next.levelUps).toHaveLength(2); // at most 2 per match
    expect(f.xpIntoLevel).toBeLessThan(held);
    expect(f.xpIntoLevel).toBeGreaterThanOrEqual(f.xpNeeded); // stays in the bar for the next match end
  });
});

describe('offers', () => {
  function offerFor(level: number, f?: Fighter): { s: GameState; f: Fighter; offer: PendingLevelUp } {
    const { s, a } = world();
    const id = s.clubs[a]!.lineup.fighters[2]!.fighterId;
    const g = f ? { ...f, id, clubId: a, status: 'active' as const } : s.fighters[id]!;
    s.fighters[id] = g;
    return { s, f: g, offer: generateOffer(s, g, level, content) };
  }

  it('lvl-007: level 22 / 24 / 27 -> 3 stats / 2 stats + 1 skill / 1 stat + 2 skills (one rank step, one perk)', () => {
    const kinds = (o: PendingLevelUp) => o.options.map((x) => x.kind).join(',');
    expect(kinds(offerFor(22).offer)).toBe('stat,stat,stat');
    const k24 = offerFor(24).offer.options.map((x) => x.kind);
    expect(k24.filter((k) => k === 'stat')).toHaveLength(2);
    expect(k24.filter((k) => k !== 'stat')).toHaveLength(1);
    expect(kinds(offerFor(27).offer)).toBe('stat,rank,perk');
  });

  it('lvl-008: a capped stat is never offered; picking STR at 1,560 / 1,600 gives +40', () => {
    const f = plain({ str: 16 });
    f.train100 = { ...f.train100, ['str' as StatId]: 1560 };
    for (let level = 2; level < 40; level++) {
      const { offer } = offerFor(level, f);
      for (const o of offer.options) if (o.kind === 'stat') expect((f.cap100[o.stat] ?? 0) - (f.train100[o.stat] ?? 0)).toBeGreaterThan(0);
    }
    const { s, f: g } = offerFor(5, f);
    g.pendingLevelUps = [{ level: 5, season: 1, weekIndex: 9, options: [{ kind: 'stat', stat: 'str' as StatId, gain100: 40 }], traitOffer: null }];
    const r = resolveLevelUp(s, g.id, 5, { optionIndex: 0, traitIndex: null }, 'player', content);
    expect(r.ok).toBe(true);
    expect(s.fighters[g.id]!.train100['str' as StatId]).toBe(1600);
    // Now capped: never offered again.
    for (let level = 40; level < 60; level++) expect(generateOffer(s, s.fighters[g.id]!, level, content).options.some((o) => o.kind === 'stat' && o.stat === 'str')).toBe(false);
  });

  it('stat offers follow class weight × emphasis; Stamina has its 0.08 floor; Body favours physical stats', () => {
    const counts = (emphasis: 'balanced' | 'body' | 'mind') => {
      const c: Record<string, number> = {};
      for (let i = 0; i < 400; i++) {
        const f = plain({}, { trainingEmphasis: emphasis, cap100: all(2000), train100: all(1000) });
        const { offer } = offerFor(100 + 3 * i + 1, f);
        for (const o of offer.options) if (o.kind === 'stat') c[o.stat] = (c[o.stat] ?? 0) + 1;
      }
      return c;
    };
    const bal = counts('balanced');
    const body = counts('body');
    expect(bal['tgh']!).toBeGreaterThan(bal['awr']!);
    expect(bal['stamina'] ?? 0).toBeGreaterThan(0);
    const physShare = (c: Record<string, number>) => ['str', 'agi', 'pac', 'tgh', 'pre', 'stamina'].reduce((x, k) => x + (c[k] ?? 0), 0) / Object.values(c).reduce((x, y) => x + y, 0);
    expect(physShare(body)).toBeGreaterThan(physShare(bal));
    expect(physShare(counts('mind'))).toBeLessThan(physShare(bal));
  });

  it('perk eligibility: never two tier IIIs, never an exclusive partner, Banner Voice needs LDR 12 (pk-004 shape)', () => {
    const f = plain({ ldr: 11 }, { perkIds: ['g_long_wind' as PerkId] });
    for (let level = 9; level < 400; level += 9) {
      const { offer } = offerFor(level, f);
      for (const o of offer.options) {
        if (o.kind !== 'perk') continue;
        expect(o.perkId).not.toBe('g_campaign_legs'); // exclusive with Long Wind
        expect(o.perkId).not.toBe('g_banner_voice'); // LDR 11 < 12
        expect(content.perks.require(o.perkId).tier).toBeLessThan(3); // only 1 perk held
      }
    }
  });

  it('a trait offer comes about 12.5% of the time; option 1 is positive; never a flaw, physique or storied trait', () => {
    let offers = 0;
    let burdens = 0;
    const n = 1500;
    for (let level = 1; level <= n; level++) {
      const { offer } = offerFor(level, plain({}, { traits: [] }));
      if (!offer.traitOffer) continue;
      offers++;
      const [first, second] = offer.traitOffer.map((id) => content.traits.require(id));
      expect(first!.polarity).toBe('positive');
      for (const d of [first, second]) {
        if (!d) continue;
        expect(d.kind).not.toBe('flaw');
        expect(d.category).not.toBe('physique');
        expect(d.category).not.toBe('acquired');
        if (d.kind === 'burden') burdens++;
      }
    }
    expect(offers / n).toBeGreaterThan(0.09);
    expect(offers / n).toBeLessThan(0.16);
    expect(burdens / offers).toBeGreaterThan(0.12);
    expect(burdens / offers).toBeLessThan(0.38);
  });

  it('lvl-010: the offer is stored at match end and survives a save/reload unchanged (never rerolled)', () => {
    const { s, a } = world();
    const id = s.clubs[a]!.lineup.fighters[0]!.fighterId;
    const f = s.fighters[id]!;
    Object.assign(f, { levelUpMode: 'manual', xpIntoLevel: f.xpNeeded });
    const out = empty();
    checkLevelUps(s, f, content, out);
    expect(f.pendingLevelUps).toHaveLength(1);
    const reloaded = cloneJson(s);
    expect(reloaded.fighters[id]!.pendingLevelUps).toEqual(f.pendingLevelUps);
    expect(generateOffer(reloaded, reloaded.fighters[id]!, f.pendingLevelUps[0]!.level, content, f.pendingLevelUps[0]!.weekIndex).options.length).toBe(3);
  });
});

describe('auto-pick and the queue', () => {
  it('lvl-011: a Balanced Oathguard at Stamina 9 offered STR / AWR / Stamina scores 0.90 / 0.20 / 0.80 and takes STR; at Stamina 8 with STR capped, Stamina over AWR', () => {
    const f = plain({ str: 14, awr: 12, stamina: 9 }, { cap100: { ...all(1600) }, train100: { ...all(1000), ['str' as StatId]: 1400, ['awr' as StatId]: 1200, [STA]: 900 } });
    const offer: PendingLevelUp = {
      level: 21,
      season: 1,
      weekIndex: 9,
      options: [
        { kind: 'stat', stat: 'str' as StatId, gain100: 100 },
        { kind: 'stat', stat: 'awr' as StatId, gain100: 100 },
        { kind: 'stat', stat: STA, gain100: 100 },
      ],
      traitOffer: null,
    };
    const ctx = { captainOrVice: false, trainingEnabled: true };
    expect(optionScore(f, offer.options[0]!, 'auto', content, ctx)).toBeCloseTo(0.9, 10);
    expect(optionScore(f, offer.options[1]!, 'auto', content, ctx)).toBeCloseTo(0.2, 10);
    expect(optionScore(f, offer.options[2]!, 'auto', content, ctx)).toBeCloseTo(0.8, 10);
    expect(autoPickChoice(f, offer, 'auto', content).optionIndex).toBe(0);
    const capped = { ...f, train100: { ...f.train100, ['str' as StatId]: 1600, [STA]: 800 } };
    expect(autoPickChoice(capped, offer, 'auto', content).optionIndex).toBe(2);
  });

  it('lvl-012: the trait offer takes the positive option, never a burden', () => {
    const f = plain();
    const offer: PendingLevelUp = { level: 5, season: 1, weekIndex: 9, options: [], traitOffer: ['good_company' as TraitId, 'prickly' as TraitId] };
    expect(autoPickChoice(f, offer, 'auto', content).traitIndex).toBe(0);
    const swapped: PendingLevelUp = { ...offer, traitOffer: ['prickly' as TraitId, 'good_company' as TraitId] };
    expect(autoPickChoice(f, swapped, 'auto', content).traitIndex).toBe(1);
    expect(autoPickChoice(f, { ...offer, traitOffer: ['prickly' as TraitId] }, 'auto', content).traitIndex).toBeNull();
  });

  it('lvl-009: with 3 pending a 4th auto-resolves the oldest (queue_full); 3 remain', () => {
    const { s, a } = world();
    const id = s.clubs[a]!.lineup.fighters[0]!.fighterId;
    const f = s.fighters[id]!;
    Object.assign(f, { levelUpMode: 'manual', age: 17, paceId: 'rapid', level: 1 });
    for (let i = 0; i < 4; i++) {
      f.xpIntoLevel = f.xpNeeded;
      const out = empty();
      checkLevelUps(s, f, content, out);
      if (i < 3) expect(out.autoResolved).toHaveLength(0);
      else {
        expect(out.autoResolved).toHaveLength(1);
        expect(out.autoResolved[0]!.how).toBe('queue_full');
        expect(out.autoResolved[0]!.level).toBe(2);
        expect(out.newsIds.some((n) => s.news.find((x) => x.id === n)?.key === 'fighter.level_auto_resolved')).toBe(true);
      }
    }
    expect(f.pendingLevelUps.map((p) => p.level)).toEqual([3, 4, 5]);
  });

  it('resolveLevelUp: errors for an unknown level, an illegal option and an unavailable trait; a stat pick raises train100 and is logged', () => {
    const { s, a } = world();
    const id = s.clubs[a]!.lineup.fighters[0]!.fighterId;
    const f = s.fighters[id]!;
    f.cap100 = { ...f.cap100, ['tgh' as StatId]: (f.train100['tgh' as StatId] ?? 0) + 100 };
    f.pendingLevelUps = [{ level: 7, season: 1, weekIndex: 9, options: [{ kind: 'stat', stat: 'tgh' as StatId, gain100: 100 }], traitOffer: ['still_water' as TraitId] }];
    expect(resolveLevelUp(s, id, 8, { optionIndex: 0, traitIndex: null }, 'player', content)).toMatchObject({ ok: false, error: { code: 'levelup.unknown' } });
    expect(resolveLevelUp(s, id, 7, { optionIndex: 3, traitIndex: null }, 'player', content)).toMatchObject({ ok: false, error: { code: 'levelup.option' } });
    expect(resolveLevelUp(s, id, 7, { optionIndex: null, traitIndex: null }, 'player', content)).toMatchObject({ ok: false, error: { code: 'levelup.option' } });
    expect(resolveLevelUp(s, id, 7, { optionIndex: 0, traitIndex: 5 }, 'player', content)).toMatchObject({ ok: false, error: { code: 'levelup.trait' } });
    const before = f.train100['tgh' as StatId]!;
    const r = resolveLevelUp(s, id, 7, { optionIndex: 0, traitIndex: 0 }, 'player', content);
    expect(r.ok).toBe(true);
    expect(s.fighters[id]!.train100['tgh' as StatId]).toBe(before + 100);
    expect(s.fighters[id]!.traits.some((t) => t.id === 'still_water' && t.source === 'level')).toBe(true);
    expect(s.fighters[id]!.season.levelLog).toHaveLength(1);
    expect(s.fighters[id]!.pendingLevelUps).toHaveLength(0);
  });

  it('lvl-013: two pending level-ups at season end are both auto-resolved before wear and age +1', () => {
    const { s, a } = world();
    const id = s.clubs[a]!.lineup.fighters[0]!.fighterId;
    const f = s.fighters[id]!;
    f.levelUpMode = 'manual';
    f.pendingLevelUps = [generateOffer(s, f, f.level + 1, content), generateOffer(s, f, f.level + 2, content)];
    s.calendar = { season: 1, weekIndex: 24, weekId: null, phase: 'season-end' };
    const age = f.age;
    seasonEndDevelopment(s, content);
    const g = s.fighters[id]!;
    expect(g.pendingLevelUps).toHaveLength(0);
    expect(g.age).toBe(age + 1);
    expect(g.history[0]!.age).toBe(age);
  });

  it('lvl-014: a mid-season pick raises the rating at the next lock and the peak rating follows', () => {
    const { s, a } = world();
    const id = s.clubs[a]!.lineup.fighters[0]!.fighterId;
    const f = s.fighters[id]!;
    const r0 = rating(f, content);
    // Pick the heaviest stat until the rating moves by one.
    let level = 50;
    while (rating(s.fighters[id]!, content) === r0 && level < 80) {
      const g = s.fighters[id]!;
      g.cap100 = { ...g.cap100, ['tgh' as StatId]: 2000 };
      g.pendingLevelUps = [{ level, season: 1, weekIndex: 13, options: [{ kind: 'stat', stat: 'tgh' as StatId, gain100: 100 }], traitOffer: null }];
      expect(resolveLevelUp(s, id, level, { optionIndex: 0, traitIndex: null }, 'player', content).ok).toBe(true);
      level++;
    }
    const r1 = rating(s.fighters[id]!, content);
    expect(r1).toBe(r0 + 1);
    expect(s.fighters[id]!.career.peakRating).toBeGreaterThanOrEqual(r1);
  });

  it('levelEtaMatches: ceil(remaining ÷ mean match XP this season); defaults before the first match', () => {
    const f = plain({}, { status: 'active', xpNeeded: 155, xpIntoLevel: 55 });
    expect(levelEtaMatches(f, content)).toBe(Math.ceil(100 / 11));
    const g = { ...f, season: { ...f.season, matchesStarted: 4, roundXp: 128 } };
    expect(levelEtaMatches(g, content)).toBe(Math.ceil(100 / 32));
    expect(levelEtaMatches({ ...f, status: 'free-agent' }, content)).toBeNull();
  });
});

// ---- Freshness (T003) ---------------------------------------------------------------------------------

describe('Freshness', () => {
  const sixteen = () => plain({ stamina: 16 });
  const load = (durationS: number, damageTaken: number, downed: boolean) => ({ durationS, damageTaken, maxHp: 1000, downed });

  it('frs-001: Stamina 16, human 26, 30 s, 60% taken, not downed -> 4.2 × 0.92 = 3.9; 100 -> 96.1, the sim reads 96', () => {
    const { s, a, b } = world();
    const ms = fixtureMatchState(s, a, b, content);
    const id = ms.home.active[0]!;
    s.fighters[id] = { ...withStats(s.fighters[id]!, content, { stamina: 16 }), age: 26, raceId: 'human' as RaceId };
    expect(roundDrain10(s.fighters[id]!, load(30, 600, false), content)).toBe(39);
    freshnessAfterRound(s, ms, outcome(1, 'home', [after(id, 'home')]), content);
    expect(s.fighters[id]!.freshness10).toBe(961);
    expect(Math.floor(s.fighters[id]!.freshness10 / 10)).toBe(96);
  });

  it('frs-002 / frs-003 / frs-008: 10.9 (STA 6, 34, brutal round); 7.8 (elf 30, STA 10); 3.6 (Campaign Legs)', () => {
    expect(roundDrain10(plain({ stamina: 6 }, { age: 34 }), load(38, 1100, true), content)).toBe(109);
    expect(roundDrain10(plain({ stamina: 10 }, { raceId: 'elf' as RaceId, age: 30 }), load(30, 600, false), content)).toBe(Math.round(7.08 * (0.55 + 0.25 + 0.12) * 1.1 * 10));
    expect(typicalRoundDrain10(plain({ stamina: 10 }, { raceId: 'elf' as RaceId, age: 30 }), content)).toBe(78);
    expect(typicalRoundDrain10(plain({ stamina: 16 }, { perkIds: ['g_campaign_legs' as PerkId] }), content)).toBe(36);
  });

  it('frs-004 (T003 calibration): Stamina 16 starts 10 straight typical rounds at >= 60 (4 matches), Stamina 6 five (2 matches)', () => {
    const roundsAtOrAbove60 = (f: Fighter) => {
      let v = 1000;
      let n = 0;
      const d = typicalRoundDrain10(f, content);
      while (Math.floor(v / 10) >= 60) {
        n++;
        v -= d;
      }
      return { n, next: v / 10 };
    };
    const hi = roundsAtOrAbove60(sixteen());
    expect(hi.n).toBe(10);
    expect(hi.next).toBeCloseTo(58, 5);
    const lo = roundsAtOrAbove60(plain({ stamina: 6 }));
    expect(lo.n).toBe(5);
    expect(lo.next).toBeCloseTo(55, 5);
    expect(hi.n / 2.5).toBeCloseTo(4, 5);
    expect(lo.n / 2.5).toBeCloseTo(2, 5);
  });

  it('frs-005: a week of rest: +46.0 (STA 16, 26) / +30.6 (STA 6, 34) / +24.5 as an unused squad reserve', () => {
    expect(weeklyRest10(sixteen(), content, false)).toBe(460);
    expect(weeklyRest10(plain({ stamina: 6 }, { age: 34 }), content, false)).toBe(306);
    expect(weeklyRest10(plain({ stamina: 6 }, { age: 34 }), content, true)).toBe(245);
  });

  it('frs-006 / frs-007: Second Breath gives +8 between rounds to active fighters and unused reserves, never to the withdrawn', () => {
    const { s, a, b } = world();
    const ms = fixtureMatchState(s, a, b, content);
    const active = ms.home.active[0]!;
    const withdrawn = ms.home.active[1]!;
    const reserve = ms.home.unusedReserves[0]!;
    for (const id of [active, withdrawn, reserve]) s.fighters[id] = { ...withFreshness(s.fighters[id]!, 50), perkIds: ['g_second_breath' as PerkId] };
    s.fighters[withdrawn]!.freshness10 = 531;
    ms.home.withdrawn = [withdrawn];
    ms.home.active = ms.home.active.map((id) => (id === withdrawn ? ms.home.unusedReserves[1]! : id));
    ms.home.unusedReserves = [reserve];
    freshnessBetweenRounds(s, ms, content);
    expect(s.fighters[active]!.freshness10).toBe(580);
    expect(s.fighters[reserve]!.freshness10).toBe(580);
    expect(s.fighters[withdrawn]!.freshness10).toBe(531);
  });

  it('Tired and Spent round starts are counted at the round start', () => {
    const { s, a, b } = world();
    const ms = fixtureMatchState(s, a, b, content);
    const [x, y] = ms.home.active as [FighterId, FighterId];
    s.fighters[x] = withFreshness(s.fighters[x]!, 55);
    s.fighters[y] = withFreshness(s.fighters[y]!, 35);
    freshnessAfterRound(s, ms, outcome(1, 'home', [after(x, 'home'), after(y, 'home')]), content);
    expect(s.fighters[x]!.season.tiredRoundStarts).toBe(1);
    expect(s.fighters[y]!.season.spentRoundStarts).toBe(1);
  });

  it('frs-009: a round started at F 45 multiplies the injury chance by 1.09; at 60 by 1', () => {
    const f = plain();
    const p60 = roundInjuryChanceBp(f, content, { damageRatioBp: 11_000, downed: true, freshness: 60 });
    const p45 = roundInjuryChanceBp(f, content, { damageRatioBp: 11_000, downed: true, freshness: 45 });
    expect(p60).toBe(324);
    expect(p45).toBe(Math.trunc(324 * 1.09));
  });

  it('frs-010: the off-season resets Freshness to 100', () => {
    const { s } = world();
    for (const f of Object.values(s.fighters)) f.freshness10 = 123;
    s.calendar = { season: 1, weekIndex: 24, weekId: null, phase: 'season-end' };
    offseasonRecovery(s, content);
    for (const f of Object.values(s.fighters)) expect(f.freshness10).toBe(1000);
  });
});

// ---- immediate injuries, captaincy, chemistry ----------------------------------------------------------

describe('immediate injuries (inj-010)', () => {
  it('a starter injured in round 1 is returned at once, out from next week, and never rolled again in that match', () => {
    const base = world();
    const ms0 = fixtureMatchState(base.s, base.a, base.b, content);
    const id = ms0.home.active[0]!;
    base.s.fighters[id] = { ...withStats(base.s.fighters[id]!, content, { tgh: 1 }), raceId: 'elf' as RaceId, age: 70 };
    const hit = after(id, 'home', { damageTaken: 2000, downed: true });
    let found: { s: GameState; ms: typeof ms0 } | null = null;
    for (let i = 0; i < 4000 && !found; i++) {
      const s = cloneJson(base.s);
      const ms = { ...cloneJson(ms0), fixtureId: `fx-${i}` as never };
      const injured = injuriesAfterRound(s, ms, outcome(1, 'away', [hit]), content);
      if (injured.includes(id) && s.fighters[id]!.injury!.severity === 'minor') found = { s, ms };
    }
    expect(found).not.toBeNull();
    const { s, ms } = found!;
    expect(s.fighters[id]!.injury!.weeksOut).toBeGreaterThanOrEqual(2);
    expect(s.fighters[id]!.injury!.since).toEqual({ season: 1, weekIndex: 9 });
    // A second roll for him in the same match never happens.
    expect(injuriesAfterRound(s, ms, outcome(2, 'away', [hit]), content)).toEqual([]);
    // weeksOut counts from the week after the match.
    const w = s.fighters[id]!.injury!.weeksOut;
    weeklyLifecycle(s, content);
    expect(s.fighters[id]!.injury!.weeksOut).toBe(w);
  });

});

describe('captaincy and chemistry consequences', () => {
  it('cap-011: a fit captain at F 52 left out of the squad 5 matches running never starts Losing the Room; a reserve counts as fielded', () => {
    const { s, a } = world();
    const c = s.clubs[a]!;
    const cap = c.captainId!;
    c.lineup.fighters = c.lineup.fighters.filter((e) => e.fighterId !== cap);
    c.lineup.reserves = c.lineup.reserves.filter((id) => id !== cap);
    s.fighters[cap] = withFreshness(s.fighters[cap]!, 52);
    for (let w = 9; w <= 14; w++) {
      at(s, w);
      lineupLock(s, a, content);
      expect(s.fighters[cap]!.statuses.some((x) => x.id === 'losing_the_room')).toBe(false);
    }
    expect(c.captainNotFieldedStreak).toBe(0);
    // Rested back to 90 and named a reserve: fielded.
    s.fighters[cap] = withFreshness(s.fighters[cap]!, 90);
    c.lineup.reserves = [cap];
    at(s, 15);
    lineupLock(s, a, content);
    expect(c.captainNotFieldedStreak).toBe(0);
  });

  it('chem-003: chemistry is fixed at the lock for the five starters; an entering reserve gets the same composure (+3 -> +1)', () => {
    const { s, a } = world();
    const starters = s.clubs[a]!.lineup.fighters.map((e) => e.fighterId);
    const reserve = s.clubs[a]!.lineup.reserves[0]!;
    for (const id of starters.slice(0, 3)) s.fighters[id]!.traits = [{ id: 'good_company' as TraitId, gainedSeason: 1, source: 'rolled' }];
    s.fighters[reserve]!.traits = [{ id: 'good_company' as TraitId, gainedSeason: 1, source: 'rolled' }];
    const chem = lineupChemistry(s, a, starters, null, content);
    expect(chem).toBe(3);
    const base = effectiveStats(s.fighters[reserve]!, content)['cmp' as StatId]!;
    expect(effectiveStats(s.fighters[reserve]!, content, { chemistry: chem })['cmp' as StatId]).toBe(base + 1);
    expect(lineupChemistry(s, a, starters, null, content)).toBe(3); // the reserve's own terms do not count
  });
});

// ---- Stamina -------------------------------------------------------------------------------------------

describe('Stamina (T003)', () => {
  it('sta-001: human Oathguard P 60, jitter 0, human-age 26, D 26, bloom 0 -> cap 1,427, train 1,341, shows 13', () => {
    const cap = staminaCap100(content, 'oathguard', 'human', 60, 0);
    expect(cap).toBe(1427);
    const train = Math.floor((cap * maturityBp(content, 'physical', 2600)) / 10_000 + 1e-7);
    expect(train).toBe(1341);
    const f = plain({}, { cap100: { ...all(1000), [STA]: cap }, train100: { ...all(1000), [STA]: train } });
    expect(effectiveStats(f, content)[STA]).toBe(13);
  });

  it('sta-002: that fighter from 31 to 36 wears on the physical table (default content: 1.4 points -> 12)', () => {
    const f = plain({}, { age: 31, cap100: { ...all(1000), [STA]: 1427 }, train100: { ...all(1000), [STA]: 1341 } });
    let expected = 0;
    for (let age = 31; age <= 35; age++) {
      const step = [...content.development.decline.physicalPerHumanYear].reverse().find(([y]) => y <= age)![1];
      expected += Math.round(step * 100);
      applySeasonWear(f, content);
      f.age += 1;
    }
    expect(f.wear100[STA]).toBe(expected);
    expect(effectiveStats(f, content)[STA]).toBe(Math.floor((1341 - expected) / 100));
  });

  it('generated fighters: Stamina gets the +2.5 offset and a ±3 jitter; races tilt it (dwarf above elf)', () => {
    const caps: Record<string, number[]> = {};
    for (let i = 0; i < 400; i++) {
      const race = content.races.list[i % content.races.list.length]!.id;
      (caps[race] ??= []).push(staminaCap100(content, 'oathguard', race, 60, (i % 7) * 100 - 300));
    }
    expect(staminaCap100(content, 'oathguard', 'human', 60, 300) - staminaCap100(content, 'oathguard', 'human', 60, -300)).toBe(600);
    const mean = (r: string) => caps[r]!.reduce((x, y) => x + y, 0) / caps[r]!.length;
    expect(mean('dwarf')).toBeGreaterThan(mean('human'));
    expect(mean('human')).toBeGreaterThan(mean('elf'));
  });
});
