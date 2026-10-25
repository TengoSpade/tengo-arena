/**
 * SAMPLE DATA for WP7 tests and the local visual preview: grows a
 * testkit-style base world (core/testkit buildFixtureWorld, passed in by the
 * caller) into a season in progress: wing draws, the 16-matchweek schedule,
 * plausible match results with per-fighter stats, the Reckoning, a ledger,
 * market offers and last season's history. Values are invented to look
 * realistic; they are not produced by the game rules (core is still stubs).
 * Never import from production code.
 */
import type { ContentDB } from '../../../../core/content';
import {
  asId,
  leagueCompetitionId,
  leagueFixtureId,
  reckoningCompetitionId,
  reckoningFixtureId,
  type AbilityId,
  type Bracket,
  type ClubId,
  type ClubSeasonRow,
  type Competition,
  type Fighter,
  type FighterId,
  type FighterMatchStats,
  type Fixture,
  type FixtureId,
  type GameState,
  type LedgerCategory,
  type MatchResult,
  type RoundResult,
  type SeasonEndReport,
  type SeasonRecord,
  type SideInput,
  type TierId,
  type WeekId,
  type WingId,
} from '../../../../core/model';
import { Rng } from '../../../../core/rng';
import { cloneJson, compareStrings } from '../../../../core/util';
import { fakeRating, fakeStats, standings } from './fake-core';

export type SampleStage = 'trials' | 'preseason' | 'early' | 'mid' | 'late' | 'tournament' | 'season-over' | 'review';

export interface SampleOptions {
  stage: SampleStage;
  /** Season number of the season in progress (default 2, so season 1 history exists). */
  season?: number;
}

const WING_PATTERN = ['dawn', 'dusk', 'dusk', 'dawn'];

function weekIndexOf(content: ContentDB, pred: (w: ContentDB['weeks']['list'][number]) => boolean): number {
  return content.weeks.list.find(pred)?.index ?? 1;
}

function stageWeek(content: ContentDB, stage: SampleStage): { weekIndex: number; phase: GameState['calendar']['phase'] } {
  switch (stage) {
    case 'trials':
      return { weekIndex: 1, phase: 'preseason' };
    case 'preseason':
      return { weekIndex: 3, phase: 'preseason' };
    case 'early':
      return { weekIndex: weekIndexOf(content, (w) => w.matchweek === 3), phase: 'regular' };
    case 'mid':
      return { weekIndex: weekIndexOf(content, (w) => w.matchweek === 8), phase: 'regular' };
    case 'late':
      return { weekIndex: weekIndexOf(content, (w) => w.matchweek === 14), phase: 'regular' };
    case 'tournament':
      return { weekIndex: weekIndexOf(content, (w) => w.round === 'semifinal'), phase: 'tournament' };
    case 'season-over':
    case 'review':
      return { weekIndex: content.weeks.list.length + 1, phase: 'season-end' };
  }
}

// ---- schedule (circle method of 03 sys-league, without the slot shuffle) -----------------------------

interface Pairing {
  home: ClubId;
  away: ClubId;
  matchweek: number;
}

function wingRounds(clubs: ClubId[]): [number, number][][] {
  const rounds: [number, number][][] = [];
  for (let r = 0; r < 7; r++) {
    const games: [number, number][] = [];
    games.push(r % 2 === 1 ? [7, r] : [r, 7]);
    for (let k = 1; k <= 3; k++) {
      const a = (r + k) % 7;
      const b = (r - k + 7) % 7;
      games.push(k % 2 === 1 ? [a, b] : [b, a]);
    }
    rounds.push(games);
  }
  void clubs;
  return rounds;
}

function schedule(content: ContentDB, season: number, dawn: ClubId[], dusk: ClubId[]): Pairing[] {
  const out: Pairing[] = [];
  const mws = content.leagues.regularSeason.wingRoundMatchweeks;
  for (const wing of [dawn, dusk]) {
    const first = wingRounds(wing);
    const all = [...first, ...first.map((g) => g.map(([h, a]) => [a, h] as [number, number]))];
    all.forEach((games, i) => {
      for (const [h, a] of games) out.push({ home: wing[h]!, away: wing[a]!, matchweek: mws[i]! });
    });
  }
  const [cw1, cw2] = content.leagues.regularSeason.crossWingMatchweeks;
  for (let k = 0; k < 8; k++) {
    const odd = season % 2 === 1;
    out.push(odd ? { home: dawn[k]!, away: dusk[k]!, matchweek: cw1! } : { home: dusk[k]!, away: dawn[k]!, matchweek: cw1! });
    out.push(odd ? { home: dusk[7 - k]!, away: dawn[k]!, matchweek: cw2! } : { home: dawn[k]!, away: dusk[7 - k]!, matchweek: cw2! });
  }
  return out;
}

// ---- match results --------------------------------------------------------------------------------------

function sideInput(state: GameState, content: ContentDB, clubId: ClubId): SideInput {
  const club = state.clubs[clubId]!;
  const fighters = club.lineup.fighters.slice(0, 5).map((entry, slot) => {
    const f = state.fighters[entry.fighterId]!;
    return {
      fighterId: f.id,
      classId: f.classId,
      raceId: f.raceId,
      row: entry.row,
      slot,
      stats: fakeStats(f),
      captainQuality: 60,
      traitIds: f.traits.map((t) => t.id),
      tactics: club.lineup.tactics[f.id] ?? { kind: 'preset' as const, presetId: asId(content.classes.require(f.classId).defaultPresetId) },
      rating: fakeRating(f),
    };
  });
  const captainIndex = Math.max(0, fighters.findIndex((f) => f.fighterId === club.captainId));
  const vice = fighters.findIndex((f) => f.fighterId === club.viceCaptainId);
  return { clubId, fighters, captainIndex, viceCaptainIndex: vice >= 0 ? vice : null, chemistry: 1 };
}

function emptyStats(clubId: ClubId, ruleCount: number): FighterMatchStats {
  return {
    clubId,
    roundsPlayed: 0,
    roundsSurvived: 0,
    ticksOnArena: 0,
    damageDealt: 0,
    damageToShields: 0,
    damageTaken: 0,
    healingDone: 0,
    shieldingDone: 0,
    overheal: 0,
    ccAppliedTicks: 0,
    ccReceivedTicks: 0,
    downsInflicted: 0,
    downsSuffered: 0,
    assists: 0,
    focusSpent: 0,
    casts: {},
    ruleFires: Array.from({ length: ruleCount + 1 }, () => 0),
    ruleCommittedTicks: Array.from({ length: ruleCount + 1 }, () => 0),
    rulesNeverFired: [],
    downs: [],
    opponentIds: [],
  };
}

function roleOf(content: ContentDB, classId: string): string {
  return content.classes.get(classId)?.archetypes[0] ?? 'melee';
}

export function sampleResult(state: GameState, content: ContentDB, fixture: Fixture): MatchResult {
  const rng = Rng.create('wp7-sample', fixture.id);
  const home = sideInput(state, content, fixture.homeClubId);
  const away = sideInput(state, content, fixture.awayClubId);
  const strength = (id: ClubId) => (state.clubs[id]?.prestige ?? 50) + rng.int(-25, 25);
  const pHome = Math.max(0.2, Math.min(0.8, 0.5 + (strength(fixture.homeClubId) - strength(fixture.awayClubId)) / 160));
  const need = Math.floor(fixture.bestOf / 2) + 1;
  const stats: Record<string, FighterMatchStats> = {};
  const units = [...home.fighters.map((f) => ({ f, side: 'home' as const })), ...away.fighters.map((f) => ({ f, side: 'away' as const }))];
  for (const u of units) {
    const preset = u.f.tactics.kind === 'preset' ? content.presets.get(u.f.tactics.presetId) : undefined;
    stats[u.f.fighterId] = emptyStats(u.side === 'home' ? home.clubId : away.clubId, preset?.rules.length ?? 3);
  }
  const rounds: RoundResult[] = [];
  let hw = 0;
  let aw = 0;
  let n = 0;
  while (hw < need && aw < need) {
    n++;
    const winner: 'home' | 'away' = rng.chance(pHome) ? 'home' : 'away';
    const timeLimit = rng.chance(0.12);
    const duration = timeLimit ? 1500 : rng.int(480, 1250);
    const survivorsW = rng.int(1, 4);
    const survivorsL = timeLimit ? rng.int(1, Math.max(1, survivorsW)) : 0;
    const survivors = winner === 'home' ? { home: survivorsW, away: survivorsL } : { home: survivorsL, away: survivorsW };
    const downs = { home: 5 - survivors.home, away: 5 - survivors.away };
    const finalHp: number[] = [];
    for (const side of ['home', 'away'] as const) {
      const input = side === 'home' ? home : away;
      const foes = side === 'home' ? away : home;
      const order = input.fighters.map((f, i) => ({ f, k: rng.int(0, 1000) + (roleOf(content, f.classId) === 'tank' ? 600 : 0) + i }));
      order.sort((a, b) => a.k - b.k);
      const downed = new Set(order.slice(0, downs[side]).map((o) => o.f.fighterId));
      input.fighters.forEach((f) => {
        const s = stats[f.fighterId]!;
        const role = roleOf(content, f.classId);
        s.roundsPlayed++;
        s.ticksOnArena += duration;
        const dmg = (role === 'melee' || role === 'ranged' ? rng.int(380, 900) : rng.int(120, 420)) * (duration / 900);
        s.damageDealt += Math.round(dmg);
        s.damageTaken += rng.int(250, 900);
        if (role === 'healer') s.healingDone += rng.int(450, 1100);
        if (role === 'tank') s.shieldingDone += rng.int(80, 380);
        if (role === 'controller') s.ccAppliedTicks += rng.int(40, 160);
        s.ccReceivedTicks += rng.int(0, 60);
        s.focusSpent += rng.int(40, 120);
        const klass = content.classes.get(f.classId);
        if (klass) {
          for (const slot of ['a1', 'a2'] as const) {
            const id = klass.abilities[slot] as AbilityId;
            s.casts[id] = (s.casts[id] ?? 0) + rng.int(1, 5);
          }
        }
        for (let i = 0; i < s.ruleFires.length; i++) {
          const fires = rng.chance(0.18) ? 0 : rng.int(1, i === s.ruleFires.length - 1 ? 6 : 5);
          s.ruleFires[i]! += fires;
          s.ruleCommittedTicks[i]! += fires * rng.int(10, 40);
        }
        s.opponentIds = foes.fighters.map((x) => x.fighterId);
        if (downed.has(f.fighterId)) {
          const by = foes.fighters[rng.int(0, 4)]!;
          const byClass = content.classes.get(by.classId);
          const abilityId = (byClass ? byClass.abilities[rng.chance(0.5) ? 'a1' : 'basic'] : null) as AbilityId | null;
          s.downsSuffered++;
          s.downs.push({
            round: n,
            tick: rng.int(Math.floor(duration * 0.2), duration - 20),
            byFighterId: by.fighterId,
            abilityId,
            hit: rng.int(140, 620),
            overkill: rng.int(0, 180),
            damageTakenRound: rng.int(1400, 2300),
            maxHp: rng.int(1500, 2300),
          });
          stats[by.fighterId]!.downsInflicted++;
          finalHp.push(0);
        } else {
          s.roundsSurvived++;
          finalHp.push(rng.int(120, 1600));
        }
      });
    }
    rounds.push({
      round: n,
      seed: `${fixture.id}/round/${n}`,
      winner,
      endReason: timeLimit ? 'time-limit' : 'elimination',
      tiebreakStep: timeLimit ? (rng.chance(0.6) ? 'fighters_standing' : 'hp_fraction_sum') : null,
      durationTicks: duration,
      survivors,
      downs,
      finalHp,
      checksum: `c${n}`,
      eventHash: null,
    });
    if (winner === 'home') hw++;
    else aw++;
  }
  for (const s of Object.values(stats)) {
    s.rulesNeverFired = s.ruleFires.map((f, i) => (f === 0 && i < s.ruleFires.length - 1 ? i : -1)).filter((i) => i >= 0);
    s.downs.sort((a, b) => a.round - b.round || a.tick - b.tick);
  }
  const winnerClubId = hw > aw ? fixture.homeClubId : fixture.awayClubId;
  const contribution = (id: string) => {
    const s = stats[id]!;
    return s.damageDealt + s.healingDone + s.shieldingDone + 250 * s.downsInflicted;
  };
  const winners = (hw > aw ? home : away).fighters.map((f) => f.fighterId);
  const mvp = [...winners].sort((a, b) => contribution(b) - contribution(a) || stats[a]!.downsSuffered - stats[b]!.downsSuffered)[0] ?? null;
  return {
    fixtureId: fixture.id,
    competitionId: fixture.competitionId,
    stage: fixture.stage,
    season: fixture.season,
    weekIndex: fixture.weekIndex,
    weekId: fixture.weekId,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    engineVersion: 1,
    contentHash: content.ref.hash,
    input: { seed: `seed/${fixture.id}`, bestOf: fixture.bestOf, home, away },
    rounds,
    score: { home: hw, away: aw },
    winnerClubId,
    fighterStats: stats as MatchResult['fighterStats'],
    mvpFighterId: mvp as FighterId | null,
    hiredBladeIds: [],
  };
}

function play(state: GameState, content: ContentDB, fixture: Fixture): void {
  state.results[fixture.id] = sampleResult(state, content, fixture);
  fixture.status = 'played';
}

// ---- competitions -------------------------------------------------------------------------------------------

function setupLeague(state: GameState, content: ContentDB, season: number, tierId: TierId): Competition {
  const clubs = Object.values(state.clubs)
    .filter((c) => c.tierId === tierId)
    .sort((a, b) => b.prestige - a.prestige || compareStrings(a.id, b.id));
  const dawn: ClubId[] = [];
  const dusk: ClubId[] = [];
  clubs.forEach((c, i) => {
    const wing = WING_PATTERN[i % 4]!;
    (wing === 'dawn' ? dawn : dusk).push(c.id);
    if (season === state.calendar.season) c.wingId = asId<WingId>(wing);
  });
  const id = leagueCompetitionId(season, tierId);
  const comp: Competition = {
    id,
    kind: 'league',
    season,
    tierId,
    clubIds: clubs.map((c) => c.id),
    wings: [
      { wingId: asId<WingId>('dawn'), clubIds: dawn },
      { wingId: asId<WingId>('dusk'), clubIds: dusk },
    ],
    seedOrder: clubs.map((c) => c.id),
    fixtureIds: [],
    bracket: null,
    status: 'in-progress',
  };
  const pairs = schedule(content, season, dawn, dusk).sort((a, b) => a.matchweek - b.matchweek || compareStrings(a.home, b.home));
  for (const p of pairs) {
    const week = content.weeks.list.find((w) => w.matchweek === p.matchweek)!;
    const weekId = asId<WeekId>(week.id);
    const fid = leagueFixtureId(season, tierId, weekId, p.home, p.away);
    const crossWing = content.leagues.regularSeason.crossWingMatchweeks.includes(p.matchweek);
    state.fixtures[fid] = {
      id: fid,
      competitionId: id,
      season,
      tierId,
      weekIndex: week.index,
      weekId,
      stage: 'league',
      matchweek: p.matchweek,
      wing: crossWing ? 'cross' : dawn.includes(p.home) ? asId<WingId>('dawn') : asId<WingId>('dusk'),
      homeClubId: p.home,
      awayClubId: p.away,
      bestOf: content.leagues.regularSeason.matchBestOf,
      venueId: null,
      status: 'scheduled',
    };
    comp.fixtureIds.push(fid);
  }
  state.competitions[id] = comp;
  return comp;
}

function seedsFor(state: GameState, content: ContentDB, league: Competition): ClubId[] {
  const tier = standings(state, league.id, 'tier', content);
  const rank = new Map(tier.map((r) => [r.clubId, r.position]));
  const perWing = content.leagues.tournament.qualifiersPerWing;
  const winners: ClubId[] = [];
  const others: ClubId[] = [];
  for (const w of league.wings) {
    const rows = standings(state, league.id, w.wingId, content);
    rows.slice(0, perWing).forEach((r, i) => (i === 0 ? winners : others).push(r.clubId));
  }
  const byRank = (a: ClubId, b: ClubId) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99);
  return [...winners.sort(byRank), ...others.sort(byRank)];
}

function setupReckoning(state: GameState, content: ContentDB, league: Competition, playThrough: number): Competition {
  const seeds = seedsFor(state, content, league);
  const season = league.season;
  const tierId = league.tierId;
  const id = reckoningCompetitionId(season, tierId);
  const rounds = content.leagues.tournament.rounds;
  const bracket: Bracket = {
    seeds,
    rounds: rounds.map((r) => ({
      roundId: r.id as 'quarterfinal' | 'semifinal' | 'final',
      weekId: asId<WeekId>(r.week),
      bestOf: r.bestOf,
      ties: [],
    })),
    championId: null,
    runnerUpId: null,
  };
  const qf = rounds[0]!;
  bracket.rounds[0]!.ties = (qf.pairs ?? []).map((pair, i) => ({
    slot: i + 1,
    home: { kind: 'seed', seed: Number(pair[0]) },
    away: { kind: 'seed', seed: Number(pair[1]) },
    fixtureId: null,
    winnerClubId: null,
  }));
  const sfPairs = (rounds[1]?.pairs ?? []) as unknown[][];
  bracket.rounds[1]!.ties = sfPairs.map((pair, i) => ({
    slot: i + 1,
    home: { kind: 'winner-of', roundId: 'quarterfinal', slot: Number(String(pair[0]).replace(/\D/g, '')) },
    away: { kind: 'winner-of', roundId: 'quarterfinal', slot: Number(String(pair[1]).replace(/\D/g, '')) },
    fixtureId: null,
    winnerClubId: null,
  }));
  bracket.rounds[2]!.ties = [
    { slot: 1, home: { kind: 'winner-of', roundId: 'semifinal', slot: 1 }, away: { kind: 'winner-of', roundId: 'semifinal', slot: 2 }, fixtureId: null, winnerClubId: null },
  ];
  const comp: Competition = { id, kind: 'reckoning', season, tierId, clubIds: seeds, wings: [], seedOrder: seeds, fixtureIds: [], bracket, status: 'in-progress' };
  state.competitions[id] = comp;
  const clubForSlot = (slot: Bracket['rounds'][number]['ties'][number]['home']): ClubId | null => {
    if (slot.kind === 'seed') return seeds[slot.seed - 1] ?? null;
    const r = bracket.rounds.find((x) => x.roundId === slot.roundId);
    return r?.ties.find((t) => t.slot === slot.slot)?.winnerClubId ?? null;
  };
  const seedOf = (c: ClubId) => seeds.indexOf(c);
  bracket.rounds.forEach((round, ri) => {
    const def = rounds[ri]!;
    const week = content.weeks.list.find((w) => w.id === def.week)!;
    for (const tie of round.ties) {
      let a = clubForSlot(tie.home);
      let b = clubForSlot(tie.away);
      if (!a || !b) continue;
      if (seedOf(b) < seedOf(a)) [a, b] = [b, a];
      const fid = reckoningFixtureId(season, tierId, round.roundId, tie.slot);
      const fixture: Fixture = {
        id: fid,
        competitionId: id,
        season,
        tierId,
        weekIndex: week.index,
        weekId: asId<WeekId>(week.id),
        stage: round.roundId,
        matchweek: null,
        wing: null,
        homeClubId: a,
        awayClubId: b,
        bestOf: def.bestOf,
        venueId: def.venueId ? asId(def.venueId) : null,
        status: 'scheduled',
      };
      state.fixtures[fid] = fixture;
      comp.fixtureIds.push(fid);
      tie.fixtureId = fid;
      if (ri < playThrough) {
        play(state, content, fixture);
        tie.winnerClubId = state.results[fid]!.winnerClubId;
      }
    }
  });
  const final = bracket.rounds[2]!.ties[0]!;
  if (final.winnerClubId && final.fixtureId) {
    const f = state.fixtures[final.fixtureId]!;
    bracket.championId = final.winnerClubId;
    bracket.runnerUpId = f.homeClubId === final.winnerClubId ? f.awayClubId : f.homeClubId;
    comp.status = 'completed';
  }
  return comp;
}

// ---- the builder --------------------------------------------------------------------------------------------

/** Grow `base` (e.g. testkit buildFixtureWorld({ freeAgents: 30 })) into a season at `stage`. */
export function buildSampleSeason(base: GameState, content: ContentDB, opts: SampleOptions): GameState {
  const state = cloneJson(base);
  const season = opts.season ?? 2;
  const review = opts.stage === 'review';
  const playedSeason = review ? season : season;
  const at = stageWeek(content, opts.stage);
  state.calendar = {
    season: review ? season + 1 : season,
    weekIndex: review ? 1 : at.weekIndex,
    weekId: review ? asId<WeekId>(content.weekByIndex(1).id) : at.phase === 'season-end' ? null : asId<WeekId>(content.weekByIndex(at.weekIndex).id),
    phase: review ? 'preseason' : at.phase,
  };
  const playerId = state.playerClubId!;
  // Varied, realistic wages and contracts for every rostered fighter.
  for (const f of Object.values(state.fighters)) {
    if (f.contract && f.clubId) {
      const rating = fakeRating(f);
      f.contract.wagePerWeek = Math.max(60, Math.floor((200 * 2 ** ((rating - 50) / 12)) / 5) * 5);
      const k = Number(f.id.slice(2));
      f.contract.startSeason = playedSeason - 1;
      f.contract.endSeason = playedSeason + (k % 3);
    }
    f.contractProfile.greedBp = ((Number(f.id.slice(2)) * 300) % 2500) - 1000;
  }
  // Season 1 history rows for the player's fighters.
  for (const f of Object.values(state.fighters).filter((x) => x.clubId === playerId)) {
    const stats = fakeStats(f);
    f.history.push({
      season: playedSeason - 1,
      age: f.age - 1,
      clubId: playerId,
      rating: fakeRating(f) - 3,
      potential: f.potentialRoll,
      stats: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, Math.max(1, v - 1)])) as typeof stats,
      xp: 180 + (Number(f.id.slice(2)) % 7) * 20,
      usageBp: 6000,
      injuries: 0,
      traitsGained: [],
      traitsLost: [],
    });
  }

  // Previous season's Reckoning (complete) for the "last season" bracket and history.
  const prevRecords: SeasonRecord['tiers'] = [];
  for (const tier of content.tiers.list) {
    const tierId = asId<TierId>(tier.id);
    const prevLeague = setupLeague(state, content, playedSeason - 1, tierId);
    for (const fid of prevLeague.fixtureIds) play(state, content, state.fixtures[fid]!);
    const rk = setupReckoning(state, content, prevLeague, 3);
    prevLeague.status = 'completed';
    const tierTable = standings(state, prevLeague.id, 'tier', content);
    prevRecords.push({
      tierId,
      wingTables: prevLeague.wings.map((w) => ({ wingId: w.wingId, rows: standings(state, prevLeague.id, w.wingId, content) })),
      tierTable,
      reckoningChampionId: rk.bracket?.championId ?? null,
      reckoningRunnerUpId: rk.bracket?.runnerUpId ?? null,
      shieldWinnerId: tierTable[0]?.clubId ?? null,
      promotedIds: [],
      relegatedIds: [],
    });
    // Drop the previous season's league fixtures/results (compaction keeps the archive, not every match).
    for (const fid of prevLeague.fixtureIds) {
      delete state.fixtures[fid];
      delete state.results[fid];
    }
    prevLeague.fixtureIds = [];
  }
  state.history.push({ season: playedSeason - 1, tiers: prevRecords, retirements: [], rookieIds: [] });
  const player = state.clubs[playerId]!;
  const prevTier = prevRecords.find((t) => t.tierId === player.tierId)!;
  const prevRow = prevTier.tierTable.find((r) => r.clubId === playerId)!;
  const prevWing = prevTier.wingTables.find((w) => w.rows.some((r) => r.clubId === playerId))!;
  player.history.push(clubRow(playedSeason - 1, player.tierId, prevWing.wingId, prevWing.rows.find((r) => r.clubId === playerId)!.position, prevRow, player.prestige));

  // This season's leagues.
  const leagues = content.tiers.list.map((t) => setupLeague(state, content, playedSeason, asId<TierId>(t.id)));
  const lastPlayedWeek = review || at.phase !== 'regular' ? Infinity : at.weekIndex - 1;
  for (const league of leagues) {
    for (const fid of league.fixtureIds) {
      const f = state.fixtures[fid]!;
      if (f.weekIndex <= lastPlayedWeek) play(state, content, f);
    }
  }
  if (opts.stage === 'tournament' || opts.stage === 'season-over' || review) {
    const through = opts.stage === 'tournament' ? 1 : 3;
    for (const league of leagues) {
      league.status = 'completed';
      setupReckoning(state, content, league, through);
    }
  }

  // Finances, ledger and market for the player's club.
  addLedger(state, content, playerId, review ? content.weeks.list.length : at.weekIndex - 1);
  addMarket(state, content, playerId, opts.stage);
  if (opts.stage !== 'trials' && opts.stage !== 'preseason') injureOne(state, playerId);

  if (review) applyReview(state, content, playedSeason);
  return state;
}

function clubRow(season: number, tierId: TierId, wingId: WingId, wingPosition: number, row: { position: number; points: number; matchWins: number; matchLosses: number }, prestige: number): ClubSeasonRow {
  return {
    season,
    tierId,
    wingId,
    wingPosition,
    tierPosition: row.position,
    points: row.points,
    matchWins: row.matchWins,
    matchLosses: row.matchLosses,
    reckoning: wingPosition <= 4 ? 'quarterfinal' : null,
    shield: row.position === 1,
    promoted: false,
    relegated: false,
    income: 210000,
    costs: 196000,
    endBalance: 64000,
    prestigeEnd: prestige,
  };
}

function addLedger(state: GameState, content: ContentDB, clubId: ClubId, weeksProcessed: number): void {
  const club = state.clubs[clubId]!;
  const level = content.tiers.get(club.tierId)?.level ?? 1;
  const p = content.tierProfile(level);
  const opening = 52000;
  state.ledger.openingBalances[clubId] = opening;
  const bill = Object.values(state.fighters)
    .filter((f) => f.clubId === clubId && f.contract)
    .reduce((s, f) => s + f.contract!.wagePerWeek, 0);
  let seq = state.ledger.nextSeq;
  let balance = opening;
  const post = (weekIndex: number, category: LedgerCategory, amount: number, extra: { fighterId?: FighterId; fixtureId?: FixtureId } = {}) => {
    state.ledger.entries.push({ seq: seq++, season: state.calendar.season, weekIndex, clubId, amount, category, ...extra });
    balance += amount;
  };
  post(1, 'centralGrant', Math.floor(p.centralGrant / 2));
  const retainer = Math.floor(p.sponsorRetainerBase / content.weeks.list.length);
  const mw8 = content.weeks.list.find((w) => w.matchweek === 8)?.index ?? 12;
  for (let w = 1; w <= weeksProcessed; w++) {
    post(w, 'sponsorRetainer', retainer);
    const fx = Object.values(state.fixtures).find((f) => f.season === state.calendar.season && f.weekIndex === w && (f.homeClubId === clubId || f.awayClubId === clubId));
    const res = fx ? state.results[fx.id] : undefined;
    if (fx && res && fx.homeClubId === clubId) post(w, 'gate', p.gateBase + ((w * 137) % 900) - 300, { fixtureId: fx.id });
    if (fx && res && res.winnerClubId === clubId) post(w, 'sponsorWinBonus', p.sponsorWinBonus, { fixtureId: fx.id });
    if (w === mw8) post(w, 'centralGrant', Math.ceil(p.centralGrant / 2));
    if (w === 3) {
      const someone = Object.values(state.fighters).find((f) => f.clubId === clubId);
      post(w, 'signingCost', -4120, { fighterId: someone?.id });
    }
    post(w, 'wages', -bill);
    post(w, 'operations', -p.opsCostPerWeek);
  }
  state.ledger.nextSeq = seq;
  const sb = p.centralGrant + p.sponsorRetainerBase + 8 * p.gateBase;
  club.finance = {
    ...club.finance,
    balance,
    seasonBudget: sb,
    wageBudgetPerWeek: Math.floor((sb * p.wageRatioBp) / 10000 / content.weeks.list.length),
    status: 'healthy',
  };
}

function addMarket(state: GameState, content: ContentDB, clubId: ClubId, stage: SampleStage): void {
  const fas = Object.values(state.fighters)
    .filter((f) => f.status === 'free-agent')
    .sort((a, b) => compareStrings(a.id, b.id));
  const rivals = Object.keys(state.clubs).filter((id) => id !== clubId) as ClubId[];
  const at = { season: state.calendar.season, weekIndex: state.calendar.weekIndex };
  fas.slice(0, 5).forEach((f, i) => {
    for (let k = 0; k <= i % 3; k++) {
      state.market.offers.push({ clubId: rivals[(i * 7 + k) % rivals.length]!, fighterId: f.id, wagePerWeek: 200 + i * 20, seasons: 2, madeAt: at, isCounterAcceptance: false });
    }
  });
  const target = fas[6];
  if (target) state.market.offers.push({ clubId, fighterId: target.id, wagePerWeek: 260, seasons: 2, madeAt: at, isCounterAcceptance: false });
  const wary = fas[7];
  if (wary) state.market.negotiations.push({ fighterId: wary.id, clubId, season: state.calendar.season, kind: 'free-agent', patienceLeft: 1, counterWage: null, validUntilWeek: null });
  const done = fas[8];
  if (done) state.market.negotiations.push({ fighterId: done.id, clubId, season: state.calendar.season, kind: 'free-agent', patienceLeft: 0, counterWage: null, validUntilWeek: null });
  const club = state.clubs[clubId]!;
  club.shortlist = fas.slice(2, 5).map((f) => f.id);
  if (stage === 'trials') {
    const rookies = fas.slice(-3);
    for (const r of rookies) r.age = 17 + (Number(r.id.slice(2)) % 3);
    state.market.trialsRookies[clubId] = rookies.map((r) => r.id);
  }
  void content;
}

function injureOne(state: GameState, clubId: ClubId): void {
  const club = state.clubs[clubId]!;
  const last = Object.values(state.results)
    .filter((r) => r.season === state.calendar.season && (r.homeClubId === clubId || r.awayClubId === clubId))
    .sort((a, b) => b.weekIndex - a.weekIndex)[0];
  if (!last) return;
  const victim = Object.entries(last.fighterStats).find(([, s]) => s.clubId === clubId && s.downs.length > 0);
  if (!victim) return;
  const [id, s] = victim;
  const down = s.downs[0]!;
  const f = state.fighters[id as FighterId]!;
  f.injury = {
    severity: 'minor',
    weeksOut: 2,
    fixtureId: last.fixtureId,
    round: down.round,
    causeFighterId: down.byFighterId,
    damageBp: Math.round((down.hit * 10000) / down.maxHp),
    since: { season: state.calendar.season, weekIndex: last.weekIndex },
  };
  void club;
}

function applyReview(state: GameState, content: ContentDB, season: number): void {
  const playerId = state.playerClubId!;
  const tiers: SeasonRecord['tiers'] = content.tiers.list.map((t) => {
    const tierId = asId<TierId>(t.id);
    const league = state.competitions[leagueCompetitionId(season, tierId)]!;
    const rk = state.competitions[reckoningCompetitionId(season, tierId)];
    const tierTable = standings(state, league.id, 'tier', content);
    const wingTables = league.wings.map((w) => ({ wingId: w.wingId, rows: standings(state, league.id, w.wingId, content) }));
    return {
      tierId,
      wingTables,
      tierTable,
      reckoningChampionId: rk?.bracket?.championId ?? null,
      reckoningRunnerUpId: rk?.bracket?.runnerUpId ?? null,
      shieldWinnerId: tierTable[0]?.clubId ?? null,
      promotedIds: [],
      relegatedIds: wingTables.map((w) => w.rows[w.rows.length - 1]!.clubId),
    };
  });
  // Promotions: champion and Shield of each lower tier.
  for (let i = 1; i < tiers.length; i++) {
    const t = tiers[i]!;
    const up = [t.reckoningChampionId, t.shieldWinnerId === t.reckoningChampionId ? (t.tierTable[1]?.clubId ?? null) : t.shieldWinnerId].filter(Boolean) as ClubId[];
    t.promotedIds = up;
  }
  tiers[tiers.length - 1]!.relegatedIds = [];
  const retiree = Object.values(state.fighters).find((f) => f.clubId === playerId && f.age >= 28);
  const retirements: SeasonRecord['retirements'] = retiree
    ? [{ fighterId: retiree.id, age: retiree.age + 1, lastClubId: playerId, proSeasons: 11, peakRating: fakeRating(retiree) + 6, cause: 'age' }]
    : [];
  if (retiree) {
    retiree.status = 'retired';
    retiree.clubId = null;
    retiree.contract = null;
  }
  const expired = Object.values(state.fighters).filter((f) => f.clubId === playerId && f.contract?.endSeason === season && f.id !== retiree?.id).slice(0, 2);
  for (const f of expired) {
    f.status = 'free-agent';
    f.clubId = null;
    f.contract = null;
    f.freeAgency = { unsignedSeasonEnds: 0, formerClubId: playerId, releasedByClubId: null, releasedSeason: null };
  }
  const record: SeasonRecord = { season, tiers, retirements, rookieIds: [] };
  state.history.push(record);
  // Development: a history row for the finished season, then age +1.
  for (const f of Object.values(state.fighters).filter((x) => x.clubId === playerId)) {
    const stats = fakeStats(f);
    f.history.push({
      season,
      age: f.age,
      clubId: playerId,
      rating: fakeRating(f),
      potential: f.potentialRoll,
      stats,
      xp: 240 + (Number(f.id.slice(2)) % 9) * 25,
      usageBp: 3000 + (Number(f.id.slice(2)) % 6) * 1200,
      injuries: f.injury ? 1 : 0,
      traitsGained: [],
      traitsLost: [],
    });
    f.age += 1;
    f.injury = null;
  }
  const player = state.clubs[playerId]!;
  const tierRec = tiers.find((t) => t.tierId === player.tierId)!;
  const row = tierRec.tierTable.find((r) => r.clubId === playerId)!;
  const wing = tierRec.wingTables.find((w) => w.rows.some((r) => r.clubId === playerId))!;
  player.history.push(clubRow(season, player.tierId, wing.wingId, wing.rows.find((r) => r.clubId === playerId)!.position, row, player.prestige + 2));
  state.market.trialsRookies[playerId] = Object.values(state.fighters)
    .filter((f) => f.status === 'free-agent')
    .slice(0, 3)
    .map((f) => f.id);
  state.ledger.entries = [];
  void (null as unknown as Fighter);
}

/** The SeasonEndReport matching a 'review' sample (what runSeasonEnd would have returned). */
export function sampleSeasonEndReport(state: GameState): SeasonEndReport {
  const record = state.history[state.history.length - 1]!;
  const playerId = state.playerClubId!;
  const tier = record.tiers.find((t) => t.tierTable.some((r) => r.clubId === playerId));
  return {
    record,
    playerClub: {
      clubId: playerId,
      promoted: tier?.promotedIds.includes(playerId) ?? false,
      relegated: tier?.relegatedIds.includes(playerId) ?? false,
      prizes: 18750,
      retiredIds: record.retirements.filter((r) => r.lastClubId === playerId).map((r) => r.fighterId),
      expiredIds: Object.values(state.fighters)
        .filter((f) => f.freeAgency?.formerClubId === playerId)
        .map((f) => f.id),
      developedIds: Object.values(state.fighters)
        .filter((f) => f.clubId === playerId)
        .map((f) => f.id),
    },
    newsIds: [],
  };
}
