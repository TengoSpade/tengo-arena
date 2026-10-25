/**
 * Match preparation, results and reports (03 sys-match, sys-match-report;
 * 05 §3.3 "simulate a match"). Match seed = deriveSeed(root, STREAM.match,
 * season, fixtureId): it depends only on what the fixture is (P-05).
 */
import type { ContentDB } from '../content';
import type {
  Club,
  ClubId,
  FightFighterInput,
  FightLog,
  FighterId,
  Fixture,
  FixtureId,
  GameState,
  LineupEntry,
  MatchAftermath,
  MatchInput,
  MatchReport,
  MatchResult,
  NewsItem,
  ReportEvent,
  RuleSkipReason,
  SideInput,
} from '../model';
import { STREAM, deriveSeed } from '../rng';
import { clamp, ok, type EngineError, type Result } from '../util';
import type { GamePorts } from './ports';
import { GAME_NEWS_KEYS, addNews, defaultTactics, fail, onRoster } from './shared';

export function matchSeed(state: GameState, fixtureId: FixtureId): string {
  return deriveSeed(state.rng.root, STREAM.match, state.calendar.season, fixtureId);
}

/** Lineup entries that can play now: on the roster (active) and fit; hired blades count as eligible. */
export function eligibleEntries(ports: GamePorts, state: GameState, club: Club): LineupEntry[] {
  return club.lineup.fighters.filter((e) => {
    const f = state.fighters[e.fighterId];
    if (!f) return false;
    if (f.status === 'hired-blade') return true;
    return onRoster(state, club.id, e.fighterId) !== null && ports.fighters.isFit(f);
  });
}

function sideInput(
  ports: GamePorts,
  state: GameState,
  club: Club,
  entries: readonly LineupEntry[],
  fixture: Fixture,
  content: ContentDB,
): SideInput {
  const ids = entries.map((e) => e.fighterId);
  // Lineup captain by the lifecycle rule (club captain, vice, match-captain override, best CQ).
  const lead = ports.fighters.lineupCaptain(state, club.id, ids, content);
  if (lead === null) throw new RangeError(`${club.id}: empty lineup`);
  // Chemistry: trait terms (the club captain's count double) and the club captain's grade (03 sys-chemistry).
  const chemistry = ports.fighters.lineupChemistry(state, club.id, ids, club.captainId, content);
  const matchType = fixture.stage === 'league' ? 'league' : 'tournament';
  const fighters: FightFighterInput[] = entries.map((e, slot) => {
    const f = state.fighters[e.fighterId]!;
    const isLead = slot === lead.index;
    const acting = isLead && !lead.isClubCaptain;
    const cq = isLead ? lead.cqForFight : ports.fighters.captaincy(state, f.id, club.id, content).cq;
    return {
      fighterId: f.id,
      classId: f.classId,
      raceId: f.raceId,
      row: e.row,
      slot,
      stats: ports.fighters.effectiveStats(f, content, { matchType, chemistry, actingCaptain: acting }),
      captainQuality: clamp(cq, 0, 100),
      traitIds: f.traits.map((t) => t.id),
      tactics: club.lineup.tactics[f.id] ?? defaultTactics(content, f),
      rating: ports.fighters.rating(f, content),
    };
  });
  return { clubId: club.id, fighters, captainIndex: lead.index, viceCaptainIndex: lead.viceIndex, chemistry };
}

/** Sim input of a fixture from explicit (locked) lineups. */
export function buildMatchInput(
  ports: GamePorts,
  state: GameState,
  fixture: Fixture,
  lineups: { home: readonly LineupEntry[]; away: readonly LineupEntry[] },
  content: ContentDB,
): MatchInput {
  const home = state.clubs[fixture.homeClubId]!;
  const away = state.clubs[fixture.awayClubId]!;
  return {
    seed: matchSeed(state, fixture.id),
    bestOf: fixture.bestOf,
    home: sideInput(ports, state, home, lineups.home, fixture, content),
    away: sideInput(ports, state, away, lineups.away, fixture, content),
  };
}

/** Public prepareMatchInput: the stored input once played; otherwise from the current lineups (5 eligible each). */
export function prepareMatchInput(ports: GamePorts, state: GameState, fixtureId: FixtureId, content: ContentDB): Result<MatchInput, EngineError> {
  const played = state.results[fixtureId];
  if (played) return ok(played.input);
  const fixture = state.fixtures[fixtureId];
  if (!fixture) return fail('fixture.unknown', `Unknown fixture "${fixtureId}"`);
  const sides: LineupEntry[][] = [];
  for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
    const club = state.clubs[clubId];
    if (!club) return fail('club.unknown', `Unknown club "${clubId}"`);
    const entries = eligibleEntries(ports, state, club);
    if (entries.length !== 5) return fail('lineup.incomplete', `${club.name} has ${entries.length} eligible fighters in its lineup`, { clubId, have: entries.length });
    sides.push(entries);
  }
  return ok(buildMatchInput(ports, state, fixture, { home: sides[0]!, away: sides[1]! }, content));
}

export function toResult(ports: GamePorts, fixture: Fixture, input: MatchInput, out: ReturnType<GamePorts['sim']['simulateMatch']>, hiredBladeIds: FighterId[], content: ContentDB): MatchResult {
  return {
    fixtureId: fixture.id,
    competitionId: fixture.competitionId,
    stage: fixture.stage,
    season: fixture.season,
    weekIndex: fixture.weekIndex,
    weekId: fixture.weekId,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    engineVersion: ports.sim.engineVersion,
    contentHash: content.ref.hash,
    input,
    rounds: out.rounds,
    score: out.score,
    winnerClubId: out.winner === 'home' ? fixture.homeClubId : fixture.awayClubId,
    fighterStats: out.fighterStats,
    mvpFighterId: out.mvpFighterId,
    hiredBladeIds,
  };
}

// ---- aftermath news ---------------------------------------------------------------------------------------------
// One club-scoped 'match.result' item per club and fixture carries the score and the
// aftermath the lifecycle step returned (XP and injuries are not stored in the
// MatchResult), so a report can be rebuilt later. Param keys: x:<fighterId> =
// XP; i:<fighterId> = "<severity>:<weeksOut>".

export function addMatchNews(
  draft: GameState,
  result: MatchResult,
  outcome: { xp: Record<FighterId, number>; injuries: { fighterId: FighterId; severity: string; weeksOut: number }[] },
): void {
  // One item per club, from its own side: the UI digest template reads won/for/against/opponent.
  for (const side of ['home', 'away'] as const) {
    const clubId = side === 'home' ? result.homeClubId : result.awayClubId;
    const otherId = side === 'home' ? result.awayClubId : result.homeClubId;
    const mine = side === 'home' ? result.score.home : result.score.away;
    const theirs = side === 'home' ? result.score.away : result.score.home;
    const params: NewsItem['params'] = {
      won: result.winnerClubId === clubId ? 1 : 0,
      for: mine,
      against: theirs,
      opponent: draft.clubs[otherId]?.name ?? otherId,
      opponentId: otherId,
      venue: side,
    };
    for (const [fid, xp] of Object.entries(outcome.xp)) if (result.fighterStats[fid as FighterId]?.clubId === clubId) params[`x:${fid}`] = xp;
    for (const inj of outcome.injuries) if (result.fighterStats[inj.fighterId]?.clubId === clubId) params[`i:${inj.fighterId}`] = `${inj.severity}:${inj.weeksOut}`;
    addNews(draft, { key: GAME_NEWS_KEYS.matchResult, clubId, params, refs: { fixtureId: result.fixtureId, otherClubId: otherId }, importance: clubId === draft.playerClubId ? 'notable' : 'info' });
  }
}

function aftermathOf(state: GameState, result: MatchResult): MatchAftermath {
  const xp: Record<FighterId, number> = {};
  const injuries: MatchAftermath['injuries'] = [];
  for (const item of state.news) {
    if (item.key !== GAME_NEWS_KEYS.matchResult || item.refs.fixtureId !== result.fixtureId) continue;
    for (const [k, v] of Object.entries(item.params)) {
      if (k.startsWith('x:') && typeof v === 'number') xp[k.slice(2) as FighterId] = v;
      if (k.startsWith('i:') && typeof v === 'string') {
        const [severity, weeks] = v.split(':');
        if (severity === 'knock' || severity === 'minor' || severity === 'moderate' || severity === 'serious') {
          injuries.push({ fighterId: k.slice(2) as FighterId, severity, weeksOut: Number(weeks) });
        }
      }
    }
  }
  const gold: MatchAftermath['gold'] = [];
  for (const e of state.ledger.entries) {
    if (e.fixtureId !== result.fixtureId || e.season !== result.season) continue;
    if (e.category === 'gate') gold.push({ clubId: e.clubId, amount: e.amount, reason: 'gate' });
    if (e.category === 'sponsorWinBonus') gold.push({ clubId: e.clubId, amount: e.amount, reason: 'winBonus' });
  }
  return { xp, injuries, gold };
}

const REPORT_KINDS: Partial<Record<string, ReportEvent['kind']>> = {
  'unit.down': 'down',
  'cast.interrupt': 'interrupt',
  'deathward.save': 'deathward',
  'captain.rally': 'rally',
  'captain.down': 'captain_down',
  'captain.handover': 'handover',
  'overtime.start': 'overtime',
};

function keyEvents(log: FightLog): ReportEvent[] {
  const fid = (unit: number | null | undefined): FighterId | null =>
    unit === null || unit === undefined ? null : (log.header.units.find((u) => u.index === unit)?.fighterId ?? null);
  const out: ReportEvent[] = [];
  for (const ev of log.events) {
    const kind = REPORT_KINDS[ev.type];
    if (!kind) continue;
    let actor: number | null | undefined = ev.unit;
    let target: number | null | undefined = ev.target;
    let abilityId: ReportEvent['abilityId'] = null;
    let amount: number | null = null;
    switch (ev.type) {
      case 'unit.down':
        actor = ev.data?.by;
        target = ev.unit;
        abilityId = ev.data?.ability ?? null;
        amount = ev.data?.hit ?? null;
        break;
      case 'cast.interrupt':
        actor = ev.data?.by;
        target = ev.unit;
        abilityId = ev.data?.ability ?? null;
        break;
      case 'deathward.save':
        actor = ev.data?.by;
        target = ev.unit;
        amount = ev.data?.healed ?? null;
        break;
      case 'captain.rally':
        amount = ev.data?.composure ?? null;
        break;
      case 'captain.handover':
        actor = ev.data?.newCaptain;
        amount = ev.data?.cq ?? null;
        break;
      default:
        break;
    }
    out.push({ tick: ev.tick, kind, actorId: fid(actor), targetId: fid(target), abilityId, amount });
  }
  return out;
}

/** Per-round rule fires and skip reasons of one fighter, from the summary-level round recaps (P-22). */
export interface FighterRuleDetail {
  fighterId: FighterId;
  rounds: { round: number; ruleFires: number[]; ruleSkips: Partial<Record<RuleSkipReason, number>>[]; stanceTicks: number }[];
}

/** MatchReport plus additive detail (assignable to MatchReport). */
export type DetailedMatchReport = MatchReport & { ruleDetails: FighterRuleDetail[] };

function ruleDetails(logs: readonly FightLog[]): FighterRuleDetail[] {
  const byFighter = new Map<FighterId, FighterRuleDetail>();
  for (const log of logs) {
    for (const ev of log.events) {
      if (ev.type !== 'round.summary' || !ev.data) continue;
      for (const u of ev.data.units) {
        const id = log.header.units.find((x) => x.index === u.unit)?.fighterId;
        if (!id) continue;
        let d = byFighter.get(id);
        if (!d) byFighter.set(id, (d = { fighterId: id, rounds: [] }));
        d.rounds.push({ round: log.header.round, ruleFires: [...u.ruleFires], ruleSkips: u.ruleSkips.map((s) => ({ ...s })), stanceTicks: u.stanceTicks });
      }
    }
  }
  return [...byFighter.values()];
}

export function buildMatchReport(ports: GamePorts, state: GameState, fixtureId: FixtureId, content: ContentDB): Result<DetailedMatchReport, EngineError> {
  const result = state.results[fixtureId];
  if (!result) return fail('report.not-played', `Fixture "${fixtureId}" has not been played`);
  // Re-simulate at 'summary' only when the build matches the one that played it (05 §6).
  let logs: FightLog[] | null = null;
  if (result.engineVersion === ports.sim.engineVersion && result.contentHash === content.ref.hash && !ports.league.isCompactedResult(result)) {
    try {
      const out = ports.sim.simulateMatch(result.input, content, { record: 'summary' });
      const same = out.rounds.length === result.rounds.length && out.rounds.every((r, i) => r.checksum === result.rounds[i]!.checksum);
      logs = same && out.logs ? out.logs : null;
    } catch {
      logs = null;
    }
  }
  const sideOf = (side: SideInput) => ({
    clubId: side.clubId,
    captainId: side.fighters[side.captainIndex]?.fighterId ?? null,
    chemistry: side.chemistry,
    fighterIds: side.fighters.map((f) => f.fighterId),
  });
  const home = sideOf(result.input.home);
  const away = sideOf(result.input.away);
  const captains = new Set([home.captainId, away.captainId]);
  const fighters = Object.entries(result.fighterStats)
    .sort(([a], [b]) => {
      const order = [...home.fighterIds, ...away.fighterIds];
      return order.indexOf(a as FighterId) - order.indexOf(b as FighterId);
    })
    .map(([id, stats]) => {
      const fid = id as FighterId;
      const n = stats.ruleFires.length;
      return {
        fighterId: fid,
        clubId: stats.clubId as ClubId,
        isCaptain: captains.has(fid),
        stats,
        rules: stats.ruleFires.map((fires, index) => ({
          index,
          isStance: index === n - 1,
          fires,
          committedTicks: stats.ruleCommittedTicks[index] ?? 0,
          neverFired: stats.rulesNeverFired.includes(index),
        })),
        downs: stats.downs.map((d) => ({ round: d.round, tick: d.tick, byFighterId: d.byFighterId, abilityId: d.abilityId, hit: d.hit })),
      };
    });
  return ok({
    fixtureId,
    stage: result.stage,
    weekId: result.weekId,
    season: result.season,
    home,
    away,
    score: result.score,
    winnerClubId: result.winnerClubId,
    rounds: result.rounds.map((r, i) => ({
      round: r.round,
      winner: r.winner,
      endReason: r.endReason,
      tiebreakStep: r.tiebreakStep,
      durationTicks: r.durationTicks,
      keyEvents: logs?.[i] ? keyEvents(logs[i]!) : [],
    })),
    fighters,
    mvpFighterId: result.mvpFighterId,
    timelineAvailable: logs !== null,
    aftermath: aftermathOf(state, result),
    ruleDetails: logs ? ruleDetails(logs) : [],
  });
}
