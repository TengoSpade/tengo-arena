/**
 * DEV-ONLY world builder (05 §9.2 WP6: "a dev-only fixture world"). Builds a
 * plausible career state on ANY ContentDB (the default theme in the
 * browser, the fixture content in tests) so screens can be built and
 * reviewed while world generation (WP5) and the league (WP3) are stubs.
 *
 * PROVISIONAL: every number here is placeholder scaffolding, not a game
 * rule. It is loaded only behind import.meta.env.DEV (dynamic import) or
 * from tests, and is replaced by core/game createWorld when WP5 lands.
 * Built on core/testkit makeFixtureFighter (allowed in src/ui/debug).
 */
import { clubMatchDefaults, type ContentDB } from '../../core/content';
import {
  DEFAULT_GAME_OPTIONS,
  asId,
  createEmptyGameState,
  emptyCareerStats,
  emptySeasonCounters,
  leagueCompetitionId,
  leagueFixtureId,
  type ClassId,
  type Club,
  type ClubId,
  type Competition,
  type Fighter,
  type FighterId,
  type Fixture,
  type GameState,
  type MatchResult,
  type NewsItem,
  type NewsId,
  type RaceId,
  type TacticsPresetId,
  type TierId,
  type TraitId,
  type WeekId,
  type WingId,
} from '../../core/model';
import { hashString } from '../../core/util';
import { makeFixtureFighter } from '../../core/testkit';

export interface DevWorldOptions {
  rootSeed?: string;
  /** Player's club (null = still to choose, as after createWorld). */
  playerClubId?: string | null;
  /** 1-based season week index to start at (1 = P1; 11 = MW7). */
  weekIndex?: number;
  /** Free agents in the pool. */
  freeAgents?: number;
}

/** Deterministic 0..1 from a string (dev scaffolding only). */
export function devNoise(key: string): number {
  return parseInt(hashString(key).slice(0, 8), 16) / 0xffffffff;
}

const WAGE_STEP = 5;

interface Parts {
  prefixes: readonly string[];
  middles?: readonly string[];
  suffixes: readonly string[];
}

function pick<T>(list: readonly T[], key: string): T {
  return list[Math.floor(devNoise(key) * list.length) % list.length]!;
}

function word(parts: Parts | undefined, key: string): string {
  if (!parts || parts.prefixes.length === 0) return '';
  const w = pick(parts.prefixes, `${key}:p`) + (parts.middles?.length && devNoise(`${key}:m?`) < 0.3 ? pick(parts.middles, `${key}:m`) : '') + pick(parts.suffixes, `${key}:s`);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** Readable dev names from names.json parts (given + family only; dev scaffolding, not the generator). */
export function devName(content: ContentDB, raceId: string, n: number): Fighter['name'] | null {
  const race = content.names.races[raceId as keyof typeof content.names.races] as { given?: Parts; family?: Parts } | undefined;
  const given = word(race?.given, `given:${n}`);
  const family = word(race?.family, `family:${n}`);
  if (!given) return null;
  return { given, family: family || null, epithet: null, full: family ? `${given} ${family}` : given };
}
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

/** Wing draw, fixtures, results and news for a dev career. */
export function buildDevWorld(content: ContentDB, options: DevWorldOptions = {}): GameState {
  const rootSeed = options.rootSeed ?? 'dev-world';
  const state = createEmptyGameState({ rootSeed, content: content.ref, options: DEFAULT_GAME_OPTIONS });
  const weekIndex = Math.max(1, Math.min(options.weekIndex ?? 1, content.leagues.calendar.weeks.length));
  const week = content.weekByIndex(weekIndex);
  state.calendar = { season: 1, weekIndex, weekId: asId<WeekId>(week.id), phase: week.phase };

  const classes = content.classes.list;
  const races = content.races.list;
  const traits = content.traits.list;
  let n = 1;

  for (const template of content.clubs.list) {
    const clubId = asId<ClubId>(template.id);
    const tier = content.tierByLevel(template.startTierLevel);
    const profile = content.tierProfile(template.startTierLevel);
    const perClub = Math.max(7, tier.rosterCap - 2 - (n % 2));
    // Dev only: aim ratings at the middle of the tier's usual band.
    const targetStat100 = Math.round(((tier.ratingBand.min + tier.ratingBand.max) / 2 / 5) * 100);
    const fighterIds: FighterId[] = [];
    for (let i = 0; i < perClub; i++, n++) {
      const klass = classes[(n * 5 + i * 7) % classes.length]!;
      const race = races[(n * 3 + (i % 4)) % races.length]!;
      const base = makeFixtureFighter(n, content, {});
      const cap100 = Object.fromEntries(
        Object.entries(base.cap100).map(([stat]) => [stat, Math.min(2000, Math.max(200, targetStat100 - 350 + Math.round(devNoise(`${n}:${stat}`) * 700) + Math.round((devNoise(`lvl:${n}`) - 0.5) * 500)))]),
      ) as Fighter['cap100'];
      const traitIds = pickTraits(n, traits.map((tr) => ({ id: tr.id, opposites: tr.opposites })), devNoise(`traits:${n}`));
      const age = Math.round(race.debutAge.min + devNoise(`age:${n}`) * (race.lifespan * 0.32));
      const wage = roundTo(profile.tierMinWage * (1.2 + devNoise(`wage:${n}`) * 1.6), WAGE_STEP);
      const f = makeFixtureFighter(n, content, {
        name: devName(content, race.id, n) ?? base.name,
        raceId: asId<RaceId>(race.id),
        classId: asId<ClassId>(klass.id),
        age,
        clubId,
        status: 'active',
        cap100,
        potentialRoll: Math.min(95, 35 + Math.round(devNoise(`pot:${n}`) * 45) + (3 - template.startTierLevel) * 5),
        traits: traitIds.map((id) => ({ id: asId<TraitId>(id), gainedSeason: 1, source: 'worldgen' as const })),
        contract: {
          clubId,
          wagePerWeek: wage,
          startSeason: 1,
          endSeason: 1 + ((n + i) % 3),
          signedAt: { season: 1, weekIndex: 1 },
          dropClauseApplied: false,
        },
        debutSeason: 1 - Math.max(0, age - race.debutAge.max),
      });
      state.fighters[f.id] = f;
      fighterIds.push(f.id);
    }
    const lineupIds = pickLineup(fighterIds.map((id) => state.fighters[id]!), content);
    const tactics = Object.fromEntries(
      fighterIds.map((fid) => {
        const k = content.classes.require(state.fighters[fid]!.classId);
        return [fid, { kind: 'preset' as const, presetId: asId<TacticsPresetId>(k.defaultPresetId) }];
      }),
    );
    const wageBill = fighterIds.reduce((s, id) => s + (state.fighters[id]!.contract?.wagePerWeek ?? 0), 0);
    const club: Club = {
      id: clubId,
      name: template.name,
      shortName: template.shortName,
      code: template.code,
      colors: { ...template.colors },
      regionId: asId(template.regionId),
      districtId: asId(template.districtId),
      tierId: asId<TierId>(tier.id),
      wingId: null,
      aiPersonalityId: asId(template.aiPersonality),
      tacticsStyle: template.tacticsStyle,
      prestige: template.startPrestige,
      finance: {
        balance: profile.startingBalanceBase,
        seasonBudget: profile.centralGrant + profile.sponsorRetainerBase,
        wageBudgetPerWeek: roundTo(Math.max(wageBill * 1.12, wageBill + profile.tierMinWage), 10),
        status: 'healthy',
        debtWeeks: 0,
        registryDebt: 0,
        parachuteSeasonsLeft: 0,
        ascensionSeasonsLeft: 0,
      },
      captainId: lineupIds[0] ?? null,
      viceCaptainId: lineupIds[1] ?? null,
      captainAtLastLock: null,
      captainSince: null,
      captainNotFieldedStreak: 0,
      statuses: [],
      lineup: {
        fighters: lineupIds.map((fighterId) => ({ fighterId, row: content.classes.require(state.fighters[fighterId]!.classId).startingRow })),
        reserves: [],
        matchCaptainId: null,
        tactics,
      },
      ...clubMatchDefaults(content, { player: false, personalityId: template.aiPersonality }),
      shortlist: [],
      history: [],
    };
    state.clubs[clubId] = club;
    state.ai[clubId] = { voluntaryReleasesThisSeason: 0 };
    state.ledger.openingBalances[clubId] = club.finance.balance;
  }

  for (let i = 0; i < (options.freeAgents ?? 24); i++, n++) {
    const klass = classes[(n * 11) % classes.length]!;
    const race = races[(n * 7) % races.length]!;
    const f = makeFixtureFighter(n, content, {
      name: devName(content, race.id, n) ?? makeFixtureFighter(n, content).name,
      classId: asId<ClassId>(klass.id),
      raceId: asId<RaceId>(race.id),
      age: Math.round(race.debutAge.min + devNoise(`fa-age:${n}`) * race.lifespan * 0.25),
      potentialRoll: 30 + Math.round(devNoise(`fa-pot:${n}`) * 50),
      freeAgency: { unsignedSeasonEnds: 0, formerClubId: null, releasedByClubId: null, releasedSeason: null },
    });
    state.fighters[f.id] = f;
  }
  state.ids.fighter = n;

  buildLeagues(state, content);
  playWeeksBefore(state, content, weekIndex);

  const playerClubId = options.playerClubId === undefined ? null : options.playerClubId;
  state.playerClubId = playerClubId ? asId<ClubId>(playerClubId) : null;
  if (state.playerClubId) {
    Object.assign(state.clubs[state.playerClubId]!, clubMatchDefaults(content, { player: true }));
    decorateDevCareer(state, content, state.playerClubId);
  }
  return state;
}

function pickTraits(n: number, traits: readonly { id: string; opposites: readonly string[] }[], noise: number): string[] {
  if (traits.length === 0) return [];
  const count = noise < 0.15 ? 0 : noise < 0.5 ? 1 : noise < 0.85 ? 2 : 3;
  const out: string[] = [];
  for (let k = 0; out.length < count && k < 12; k++) {
    const tr = traits[(n * 13 + k * 17) % traits.length]!;
    if (out.includes(tr.id) || out.some((id) => tr.opposites.includes(id))) continue;
    out.push(tr.id);
  }
  return out;
}

/** Best five by a cheap provisional strength, one per role where possible. */
function pickLineup(roster: readonly Fighter[], content: ContentDB): FighterId[] {
  const strength = (f: Fighter) => Object.values(f.cap100).reduce((s, v) => s + v, 0);
  const sorted = [...roster].sort((a, b) => strength(b) - strength(a) || (a.id < b.id ? -1 : 1));
  const chosen: Fighter[] = [];
  const roles = new Set<string>();
  for (const f of sorted) {
    const role = content.classes.require(f.classId).archetypes[0]!;
    if (!roles.has(role) && chosen.length < 5) {
      chosen.push(f);
      roles.add(role);
    }
  }
  for (const f of sorted) if (chosen.length < 5 && !chosen.includes(f)) chosen.push(f);
  // Front row first, as on the board.
  return chosen
    .sort((a, b) => {
      const ra = content.classes.require(a.classId).startingRow === 'front' ? 0 : 1;
      const rb = content.classes.require(b.classId).startingRow === 'front' ? 0 : 1;
      return ra - rb || strength(b) - strength(a);
    })
    .map((f) => f.id);
}

function buildLeagues(state: GameState, content: ContentDB): void {
  const season = state.calendar.season;
  const wings = content.leagues.wings.list;
  const regularWeeks = content.leagues.calendar.weeks.filter((w) => w.phase === 'regular');
  for (const tier of content.leagues.tiers) {
    const tierId = asId<TierId>(tier.id);
    const clubs = Object.values(state.clubs)
      .filter((c) => c.tierId === tierId)
      .sort((a, b) => b.prestige - a.prestige || (a.id < b.id ? -1 : 1));
    if (clubs.length < 2 || wings.length === 0) continue;
    const pattern = content.leagues.wings.serpentinePattern;
    const wingClubs = new Map<string, ClubId[]>(wings.map((w) => [w.id, []]));
    clubs.forEach((c, i) => {
      const wingId = pattern[i % pattern.length] ?? wings[i % wings.length]!.id;
      wingClubs.get(wingId)?.push(c.id);
      c.wingId = asId<WingId>(wingId);
    });
    const competitionId = leagueCompetitionId(season, tierId);
    const fixtureIds: Fixture['id'][] = [];
    for (const [wingId, ids] of wingClubs) {
      const rounds = roundRobin(ids);
      const all = [...rounds, ...rounds.map((r) => r.map(([h, a]) => [a, h] as [ClubId, ClubId]))];
      all.forEach((pairs, r) => {
        const w = regularWeeks[r];
        if (!w) return;
        for (const [home, away] of pairs) {
          const id = leagueFixtureId(season, tierId, asId<WeekId>(w.id), home, away);
          state.fixtures[id] = {
            id,
            competitionId,
            season,
            tierId,
            weekIndex: w.index,
            weekId: asId<WeekId>(w.id),
            stage: 'league',
            matchweek: w.matchweek ?? r + 1,
            wing: asId<WingId>(wingId),
            homeClubId: home,
            awayClubId: away,
            bestOf: 3,
            venueId: null,
            status: 'scheduled',
          };
          fixtureIds.push(id);
        }
      });
    }
    const competition: Competition = {
      id: competitionId,
      kind: 'league',
      season,
      tierId,
      clubIds: clubs.map((c) => c.id),
      wings: [...wingClubs].map(([wingId, clubIds]) => ({ wingId: asId<WingId>(wingId), clubIds })),
      seedOrder: clubs.map((c) => c.id),
      fixtureIds,
      bracket: null,
      status: 'in-progress',
    };
    state.competitions[competitionId] = competition;
  }
}

/** Circle method: n-1 rounds of n/2 pairs. */
function roundRobin(ids: readonly ClubId[]): [ClubId, ClubId][][] {
  const list = [...ids];
  if (list.length % 2 === 1) list.push('' as ClubId);
  const rounds: [ClubId, ClubId][][] = [];
  const n = list.length;
  for (let r = 0; r < n - 1; r++) {
    const pairs: [ClubId, ClubId][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i]!;
      const b = list[n - 1 - i]!;
      if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

/** Provisional strength of a lineup (sum of caps), for dev results only. */
function lineupStrength(state: GameState, clubId: ClubId): number {
  const club = state.clubs[clubId];
  if (!club) return 0;
  return club.lineup.fighters.reduce((s, e) => s + Object.values(state.fighters[e.fighterId]?.cap100 ?? {}).reduce((x, v) => x + v, 0), 0);
}

/** Synthetic result of a fixture (dev only: not the sim). */
export function devResult(state: GameState, fixture: Fixture): MatchResult {
  const home = lineupStrength(state, fixture.homeClubId);
  const away = lineupStrength(state, fixture.awayClubId);
  const pHome = 0.5 + Math.max(-0.3, Math.min(0.3, (home - away) / 40000));
  const r1 = devNoise(`${fixture.id}:1`) < pHome;
  const r2 = devNoise(`${fixture.id}:2`) < pHome;
  const r3 = devNoise(`${fixture.id}:3`) < pHome;
  const rounds = r1 === r2 ? [r1, r2] : [r1, r2, r3];
  const homeWins = rounds.filter(Boolean).length;
  const score = { home: homeWins, away: rounds.length - homeWins };
  const winnerClubId = score.home > score.away ? fixture.homeClubId : fixture.awayClubId;
  const fighterStats: MatchResult['fighterStats'] = {};
  for (const side of [fixture.homeClubId, fixture.awayClubId]) {
    const club = state.clubs[side];
    for (const e of club?.lineup.fighters ?? []) {
      const k = devNoise(`${fixture.id}:${e.fighterId}`);
      fighterStats[e.fighterId] = {
        clubId: side,
        roundsPlayed: rounds.length,
        roundsSurvived: Math.round(rounds.length * k),
        ticksOnArena: 600 * rounds.length,
        damageDealt: Math.round(800 + k * 2400),
        damageToShields: 0,
        damageTaken: Math.round(700 + (1 - k) * 2000),
        healingDone: 0,
        shieldingDone: 0,
        overheal: 0,
        ccAppliedTicks: 0,
        ccReceivedTicks: 0,
        downsInflicted: Math.round(k * 3),
        downsSuffered: Math.round((1 - k) * 2),
        assists: 0,
        focusSpent: 0,
        casts: {},
        ruleFires: [],
        ruleCommittedTicks: [],
        rulesNeverFired: [],
        downs: [],
        opponentIds: [],
      };
    }
  }
  return {
    fixtureId: fixture.id,
    competitionId: fixture.competitionId,
    stage: fixture.stage,
    season: fixture.season,
    weekIndex: fixture.weekIndex,
    weekId: fixture.weekId,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    engineVersion: 0,
    contentHash: state.content.hash,
    input: { seed: 'dev', bestOf: fixture.bestOf, home: emptySide(fixture.homeClubId), away: emptySide(fixture.awayClubId) },
    rounds: rounds.map((homeWon, i) => ({
      round: i + 1,
      seed: 'dev',
      winner: homeWon ? 'home' : 'away',
      endReason: devNoise(`${fixture.id}:end:${i}`) < 0.15 ? 'time-limit' : 'elimination',
      tiebreakStep: null,
      durationTicks: 500 + Math.round(devNoise(`${fixture.id}:t:${i}`) * 800),
      survivors: { home: homeWon ? 2 : 0, away: homeWon ? 0 : 2 },
      downs: { home: homeWon ? 3 : 5, away: homeWon ? 5 : 3 },
      finalHp: [],
      checksum: 'dev',
      eventHash: null,
    })),
    score,
    winnerClubId,
    fighterStats,
    mvpFighterId: null,
    hiredBladeIds: [],
  };
}

function emptySide(clubId: ClubId) {
  return { clubId, fighters: [], captainIndex: 0, viceCaptainIndex: null, chemistry: 0 };
}

/** Play every fixture before `weekIndex` with dev results. */
function playWeeksBefore(state: GameState, _content: ContentDB, weekIndex: number): void {
  const ids = Object.keys(state.fixtures).sort() as Fixture['id'][];
  for (const id of ids) {
    const fx = state.fixtures[id]!;
    if (fx.weekIndex < weekIndex) {
      state.results[id] = devResult(state, fx);
      fx.status = 'played';
      for (const fid of Object.keys(state.results[id]!.fighterStats) as FighterId[]) {
        const f = state.fighters[fid];
        if (!f) continue;
        f.season.matchesStarted += 1;
        f.season.roundsStarted += state.results[id]!.rounds.length;
        f.season.xp += 12 * state.results[id]!.rounds.length;
        f.career.matches += 1;
      }
    }
  }
}

/** Human touches for the player's club: an injury, an expiring contract, digest items. */
function decorateDevCareer(state: GameState, content: ContentDB, clubId: ClubId): void {
  const club = state.clubs[clubId]!;
  const roster = Object.values(state.fighters).filter((f) => f.clubId === clubId);
  const reserves = roster.filter((f) => !club.lineup.fighters.some((e) => e.fighterId === f.id));
  const injured = reserves[0];
  if (injured && state.calendar.weekIndex > 1) {
    injured.injury = {
      severity: 'minor',
      weeksOut: 2,
      fixtureId: null,
      round: 2,
      causeFighterId: null,
      damageBp: 2400,
      since: { season: 1, weekIndex: state.calendar.weekIndex - 1 },
    };
  }
  const rookie = reserves[reserves.length - 1];
  if (rookie) {
    rookie.age = content.races.require(rookie.raceId).debutAge.min;
    rookie.debutSeason = 1;
    rookie.career = emptyCareerStats();
    rookie.season = emptySeasonCounters();
  }
  const news = (key: string, params: NewsItem['params'], importance: NewsItem['importance'], refs: NewsItem['refs'] = {}): void => {
    const id = `n-${state.ids.news++}` as NewsId;
    state.news.push({ id, at: { season: 1, weekIndex: Math.max(1, state.calendar.weekIndex - 1) }, key, params, clubId, refs, importance, read: false });
  };
  if (injured?.injury) news('fighter.injured', { fighter: injured.name.full, weeks: injured.injury.weeksOut }, 'urgent', { fighterId: injured.id });
  const expiring = roster.filter((f) => f.contract?.endSeason === state.calendar.season);
  if (expiring.length > 0) news('contract.expiring', { count: expiring.length }, 'notable', { fighterId: expiring[0]!.id });
  const last = Object.values(state.results)
    .filter((r) => r.homeClubId === clubId || r.awayClubId === clubId)
    .sort((a, b) => b.weekIndex - a.weekIndex)[0];
  if (last) {
    const other = last.homeClubId === clubId ? last.awayClubId : last.homeClubId;
    const home = last.homeClubId === clubId;
    news('match.result', { won: last.winnerClubId === clubId ? 1 : 0, for: home ? last.score.home : last.score.away, against: home ? last.score.away : last.score.home, opponent: state.clubs[other]?.name ?? other }, 'info', {
      fixtureId: last.fixtureId,
      otherClubId: other,
    });
  }
  const fa = Object.values(state.fighters).find((f) => f.status === 'free-agent');
  if (fa) news('market.new-free-agent', { fighter: fa.name.full }, 'info', { fighterId: fa.id });
}
