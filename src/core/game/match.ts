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
  BetweenRoundRecord,
  MatchSquad,
  NewsItem,
  ReportEvent,
  RoundLineups,
  RuleSkipReason,
  SideInput,
  SwapReason,
} from '../model';
import { STREAM, deriveSeed } from '../rng';
import { clamp, ok, type EngineError, type Result } from '../util';
import type { GamePorts } from './ports';
import { roundInputOf } from './rounds';
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

export function matchTypeOf(fixture: Pick<Fixture, 'stage'>): 'league' | 'tournament' {
  return fixture.stage === 'league' ? 'league' : 'tournament';
}

/**
 * One fighter's fight input at the lineup lock (starters, squad reserves, and
 * emergency entrants when they enter): effective stats with the side's lock
 * chemistry (03 sys-chemistry: entering fighters get the same composure
 * modifier), CQ (`cq`: the lead's cqForFight, else his own), rating, tactics,
 * and the M1.1 ability ranks and perks (only when not the defaults, so M1
 * inputs keep their shape).
 */
export function fightInputOf(
  ports: GamePorts,
  state: GameState,
  club: Club,
  fighterId: FighterId,
  row: LineupEntry['row'],
  slot: number,
  ctx: { matchType: 'league' | 'tournament'; chemistry: number; acting: boolean; cq: number | null },
  content: ContentDB,
): FightFighterInput {
  const f = state.fighters[fighterId]!;
  const cq = ctx.cq ?? ports.fighters.captaincy(state, f.id, club.id, content).cq;
  const input: FightFighterInput = {
    fighterId: f.id,
    classId: f.classId,
    raceId: f.raceId,
    row,
    slot,
    stats: ports.fighters.effectiveStats(f, content, { matchType: ctx.matchType, chemistry: ctx.chemistry, actingCaptain: ctx.acting }),
    captainQuality: clamp(cq, 0, 100),
    traitIds: f.traits.map((t) => t.id),
    tactics: club.lineup.tactics[f.id] ?? defaultTactics(content, f),
    rating: ports.fighters.rating(f, content),
  };
  const ranks = f.abilityRanks;
  if (ranks && (ranks.a1 !== 1 || ranks.a2 !== 1 || ranks.passive !== 1)) input.abilityRanks = { ...ranks };
  if (f.perkIds && f.perkIds.length > 0) input.perkIds = [...f.perkIds];
  return input;
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
  const matchType = matchTypeOf(fixture);
  const fighters: FightFighterInput[] = entries.map((e, slot) => {
    const isLead = slot === lead.index;
    return fightInputOf(ports, state, club, e.fighterId, e.row, slot, { matchType, chemistry, acting: isLead && !lead.isClubCaptain, cq: isLead ? lead.cqForFight : null }, content);
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
        // Only an interrupt by someone is a key moment; a cast the caster dropped himself (target out of
        // range or already down) has no actor and read " interrupts X".
        if (ev.data?.by === null || ev.data?.by === undefined) continue;
        actor = ev.data.by;
        target = ev.unit;
        abilityId = ev.data.ability ?? null;
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

/** M1.1 squads, per-round lineups and swap lines of a round-by-round match (combat-skills.md "Match report and timeline"). */
export interface MatchTimeline {
  squads: { home: MatchSquad; away: MatchSquad };
  /** Who fought each round: ids by slot, rows, acting captain and vice index, the captain's CQ, Freshness at the round start (Fresh / Tired / Spent tags), entered flags. */
  rounds: RoundLineups[];
  /** One per between-round step: both sides' swap lines (out -> in, row, reason player / auto / injury / emergency), the injured, acting captains, Freshness after the step. */
  steps: BetweenRoundRecord[];
  emergencyEntrants: FighterId[];
  /** Every squad member and entrant: rounds started, "entered after round n" (and how), "swapped out after round n", "injured in round n". */
  fighters: Record<FighterId, MatchTimelineFighter>;
}

export interface MatchTimelineFighter {
  side: 'home' | 'away';
  role: 'starter' | 'reserve' | 'emergency';
  rounds: number[];
  enteredAfter: number | null;
  enteredHow: SwapReason | null;
  withdrawnAfter: number | null;
  injuredInRound: number | null;
}

/** MatchReport plus additive detail (assignable to MatchReport). `timeline` is null for M1 results (whole-match sims). */
export type DetailedMatchReport = MatchReport & { ruleDetails: FighterRuleDetail[]; timeline: MatchTimeline | null };

function timelineOf(state: GameState, result: MatchResult): MatchTimeline | null {
  if (!result.squads || !result.roundLineups) return null;
  const steps = result.betweenRounds ?? [];
  const emergency = result.emergencyEntrants ?? [];
  const fighters: Record<FighterId, MatchTimelineFighter> = {};
  for (const side of ['home', 'away'] as const) {
    const sq = result.squads[side];
    const sideEmergency = emergency.filter((id) => result.fighterStats[id]?.clubId === (side === 'home' ? result.homeClubId : result.awayClubId));
    const all: (readonly [FighterId, MatchTimelineFighter['role']])[] = [...sq.starters.map((id) => [id, 'starter'] as const), ...sq.reserves.map((id) => [id, 'reserve'] as const), ...sideEmergency.map((id) => [id, 'emergency'] as const)];
    for (const [id, role] of all) {
      const rounds = result.roundLineups.filter((r) => r[side].fighterIds.includes(id)).map((r) => r.round);
      let enteredAfter: number | null = null;
      let enteredHow: SwapReason | null = null;
      let withdrawnAfter: number | null = null;
      let injuredInRound: number | null = null;
      for (const step of steps) {
        for (const s of step[side]) {
          if (s.in === id) [enteredAfter, enteredHow] = [step.afterRound, s.reason];
          if (s.out === id) withdrawnAfter = step.afterRound;
        }
        if (step.injured.includes(id)) injuredInRound = step.afterRound;
      }
      // Injured in the deciding round: no step follows; the fighter's injury record names the round.
      const inj = state.fighters[id]?.injury;
      if (injuredInRound === null && inj && inj.fixtureId === result.fixtureId && inj.round !== null) injuredInRound = inj.round;
      fighters[id] = { side, role, rounds, enteredAfter, enteredHow, withdrawnAfter, injuredInRound };
    }
  }
  return { squads: result.squads, rounds: result.roundLineups, steps, emergencyEntrants: [...emergency], fighters };
}

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
  // Re-simulate at 'summary' only when the build matches the one that played it (05 §6). M1.1 results
  // replay round by round from the record (roundInputOf: no decision policy runs); M1 results as a whole match.
  let logs: FightLog[] | null = null;
  if (result.engineVersion === ports.sim.engineVersion && result.contentHash === content.ref.hash && !ports.league.isCompactedResult(result)) {
    try {
      if (result.roundLineups) {
        const out = result.rounds.map((r) => ({ r, o: ports.sim.simulateRound(roundInputOf(result, r.round), r.seed, content, { record: 'summary' }) }));
        logs = out.every(({ r, o }) => o.result.checksum === r.checksum && o.log !== null) ? out.map(({ o }) => o.log!) : null;
      } else {
        const out = ports.sim.simulateMatch(result.input, content, { record: 'summary' });
        const same = out.rounds.length === result.rounds.length && out.rounds.every((r, i) => r.checksum === result.rounds[i]!.checksum);
        logs = same && out.logs ? out.logs : null;
      }
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
  // Round-1 fives first, then reserves and entrants in record order (home, then away).
  const order = [...home.fighterIds, ...away.fighterIds, ...(Object.keys(result.fighterStats) as FighterId[])];
  const fighters = Object.entries(result.fighterStats)
    .sort(([a], [b]) => order.indexOf(a as FighterId) - order.indexOf(b as FighterId))
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
    timeline: timelineOf(state, result),
  });
}
