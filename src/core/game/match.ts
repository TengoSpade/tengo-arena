/**
 * Match preparation, results and reports (03 sys-match, sys-match-report;
 * 05 §3.3 "simulate a match"). Match seed = deriveSeed(root, STREAM.match,
 * season, fixtureId): it depends only on what the fixture is (P-05).
 */
import type { ContentDB } from '../content';
import type {
  BenchXpLine,
  BoxScoreLine,
  Club,
  ClubId,
  CompactFighterTotals,
  FightFighterInput,
  FightLog,
  FighterBox,
  FighterBoxRound,
  FighterMatchStats,
  FighterRecap,
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
  PerkId,
  ReportEvent,
  ReportTotals,
  RoundLineups,
  RuleSkipReason,
  SideInput,
  SwapReason,
} from '../model';
import { STREAM, deriveSeed } from '../rng';
import { clamp, ok, type EngineError, type Result } from '../util';
import type { GamePorts } from './ports';
import { roundInputOf } from './rounds';
import { GAME_NEWS_KEYS, addNews, compareIds, defaultTactics, fail, onRoster } from './shared';

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
// round XP of a fighter who started a round; i:<fighterId> = "<severity>:<weeksOut>";
// bx = the bench XP of the club's fighters who started no round, "<fighterId>=<xp>,..." in id order
// (one compact param instead of a key per fighter: the whole roster is on the bench every match).

/** Param key of a club's bench XP in its match.result item. */
export const BENCH_XP_PARAM = 'bx';

export function addMatchNews(
  draft: GameState,
  result: MatchResult,
  outcome: { xp: Record<FighterId, number>; benchXp?: Record<FighterId, number>; injuries: { fighterId: FighterId; severity: string; weeksOut: number }[] },
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
    const bench = Object.entries(outcome.benchXp ?? {})
      .filter(([fid]) => draft.fighters[fid as FighterId]?.clubId === clubId && result.fighterStats[fid as FighterId] === undefined)
      .sort(([a], [b]) => compareIds(a, b))
      .map(([fid, xp]) => `${fid}=${xp}`);
    if (bench.length > 0) params[BENCH_XP_PARAM] = bench.join(',');
    addNews(draft, { key: GAME_NEWS_KEYS.matchResult, clubId, params, refs: { fixtureId: result.fixtureId, otherClubId: otherId }, importance: clubId === draft.playerClubId ? 'notable' : 'info' });
  }
}

interface AftermathParts {
  aftermath: MatchAftermath;
  /** The club each bench-XP fighter belonged to when the match was played. */
  benchClub: Record<FighterId, ClubId>;
}

function aftermathOf(state: GameState, result: MatchResult): AftermathParts {
  const xp: Record<FighterId, number> = {};
  const benchXp: Record<FighterId, number> = {};
  const benchClub: Record<FighterId, ClubId> = {};
  const injuries: MatchAftermath['injuries'] = [];
  let sawBench = false;
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
      if (k === BENCH_XP_PARAM && typeof v === 'string') {
        sawBench = true;
        for (const pair of v.split(',')) {
          const at = pair.lastIndexOf('=');
          const n = Number(pair.slice(at + 1));
          if (at <= 0 || !Number.isFinite(n)) continue;
          const fid = pair.slice(0, at) as FighterId;
          benchXp[fid] = n;
          if (item.clubId !== null) benchClub[fid] = item.clubId;
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
  return { aftermath: { xp, ...(sawBench ? { benchXp } : {}), injuries, gold }, benchClub };
}

const REPORT_KINDS: Partial<Record<string, ReportEvent['kind']>> = {
  'unit.down': 'down',
  'cast.interrupt': 'interrupt',
  'deathward.save': 'deathward',
  'captain.rally': 'rally',
  'captain.down': 'captain_down',
  'captain.handover': 'handover',
  'overtime.start': 'overtime',
  'perk.proc': 'perk_proc',
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
      case 'perk.proc':
        out.push({ tick: ev.tick, kind, actorId: fid(ev.unit), targetId: fid(ev.target), abilityId: null, amount: null, perkId: (ev.data?.perk ?? '') as PerkId });
        continue;
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

/** Trigger fires per perk and fighter, summed over the rounds' summary recaps (M1.1 RoundRecap.perkProcs). */
function perkProcsOf(logs: readonly FightLog[]): Map<FighterId, Record<PerkId, number>> {
  const out = new Map<FighterId, Record<PerkId, number>>();
  for (const log of logs) {
    for (const ev of log.events) {
      if (ev.type !== 'round.summary' || !ev.data) continue;
      for (const u of ev.data.units) {
        const id = log.header.units.find((x) => x.index === u.unit)?.fighterId;
        if (!id) continue;
        const row = out.get(id) ?? ({} as Record<PerkId, number>);
        for (const [perk, n] of Object.entries(u.perkProcs ?? {})) row[perk as PerkId] = (row[perk as PerkId] ?? 0) + n;
        out.set(id, row);
      }
    }
  }
  return out;
}

/** MatchReport plus additive detail (assignable to MatchReport). `timeline` is null for M1 results (whole-match sims). */
export type DetailedMatchReport = MatchReport & { ruleDetails: FighterRuleDetail[]; timeline: MatchTimeline | null };

/**
 * The side an emergency entrant played for: from the swap lines (the entry is recorded with the side), else the
 * round lineups, else his stats or compacted totals. Never needs fighterStats, which a compacted result empties.
 */
function sideOfEntrant(result: MatchResult, id: FighterId): 'home' | 'away' | null {
  const sides = ['home', 'away'] as const;
  for (const step of result.betweenRounds ?? []) for (const side of sides) if (step[side].some((s) => s.in === id)) return side;
  for (const rl of result.roundLineups ?? []) for (const side of sides) if (rl[side].fighterIds.includes(id)) return side;
  const club = result.fighterStats[id]?.clubId;
  if (club !== undefined) return club === result.homeClubId ? 'home' : 'away';
  const t = result.fighterTotals?.[id];
  return t === undefined ? null : t[0] === 0 ? 'home' : 'away';
}

function timelineOf(state: GameState, result: MatchResult): MatchTimeline | null {
  if (!result.squads || !result.roundLineups) return null;
  const steps = result.betweenRounds ?? [];
  const emergency = result.emergencyEntrants ?? [];
  const fighters: Record<FighterId, MatchTimelineFighter> = {};
  for (const side of ['home', 'away'] as const) {
    const sq = result.squads[side];
    const sideEmergency = emergency.filter((id) => sideOfEntrant(result, id) === side);
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

const SIDES = ['home', 'away'] as const;

/**
 * Everyone who started at least one round, per side, in the order they first took the field: the round-1 five
 * (slot order), then reserves and emergency entrants as they came on. M1.1 results read it from the round
 * lineups; whole-match (M1) results from the fielded five; a compacted result from its fighter totals (squad
 * members first, then anyone else by id).
 */
export function playedBy(result: MatchResult): Record<'home' | 'away', FighterId[]> {
  const out: Record<'home' | 'away', FighterId[]> = { home: [], away: [] };
  const add = (side: 'home' | 'away', id: FighterId): void => {
    if (!out[side].includes(id)) out[side].push(id);
  };
  if (result.roundLineups && result.roundLineups.length > 0) {
    for (const rl of result.roundLineups) for (const side of SIDES) for (const id of rl[side].fighterIds) add(side, id);
    return out;
  }
  for (const side of SIDES) for (const f of result.input[side].fighters) add(side, f.fighterId);
  for (const [id, st] of Object.entries(result.fighterStats)) add(st.clubId === result.homeClubId ? 'home' : 'away', id as FighterId);
  const totals = result.fighterTotals;
  if (totals) {
    for (const side of SIDES) {
      const mark = side === 'home' ? 0 : 1;
      const squad = result.squads?.[side];
      for (const id of [...(squad?.starters ?? []), ...(squad?.reserves ?? [])]) if (totals[id]?.[0] === mark) add(side, id);
      for (const id of (Object.keys(totals) as FighterId[]).filter((x) => totals[x]?.[0] === mark).sort(compareIds)) add(side, id);
    }
  }
  return out;
}

/** The recap stats of a compacted result's fighter: the totals it kept, every other counter 0 or empty. */
function statsFromTotals(clubId: ClubId, t: CompactFighterTotals): FighterMatchStats {
  return {
    clubId,
    roundsPlayed: t[1],
    roundsSurvived: 0,
    ticksOnArena: 0,
    damageDealt: t[4],
    damageToShields: 0,
    damageTaken: 0,
    healingDone: t[5],
    shieldingDone: 0,
    overheal: 0,
    ccAppliedTicks: 0,
    ccReceivedTicks: 0,
    downsInflicted: t[2],
    downsSuffered: t[3],
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

/** Rounds (1-based) each fighter started, from the round lineups (M1.1 results; empty otherwise). */
function roundsStartedOf(result: MatchResult): Map<FighterId, number[]> {
  const out = new Map<FighterId, number[]>();
  for (const rl of result.roundLineups ?? []) {
    for (const side of SIDES) {
      for (const id of rl[side].fighterIds) {
        const list = out.get(id) ?? [];
        list.push(rl.round);
        out.set(id, list);
      }
    }
  }
  return out;
}

function lineOf(s: FighterMatchStats): BoxScoreLine {
  return {
    damageDone: s.damageDealt,
    damageReceived: s.damageTaken,
    healingDone: s.healingDone,
    ...(s.healingReceived !== undefined ? { healingReceived: s.healingReceived } : {}),
    shieldingDone: s.shieldingDone,
    downsInflicted: s.downsInflicted,
    downsSuffered: s.downsSuffered,
  };
}

/** Sum of box lines; healingReceived is kept only when every line has it. */
function sumLines(lines: readonly BoxScoreLine[]): BoxScoreLine {
  const sum = (pick: (l: BoxScoreLine) => number): number => lines.reduce((n, l) => n + pick(l), 0);
  const known = lines.every((l) => l.healingReceived !== undefined);
  return {
    damageDone: sum((l) => l.damageDone),
    damageReceived: sum((l) => l.damageReceived),
    healingDone: sum((l) => l.healingDone),
    ...(known ? { healingReceived: sum((l) => l.healingReceived!) } : {}),
    shieldingDone: sum((l) => l.shieldingDone),
    downsInflicted: sum((l) => l.downsInflicted),
    downsSuffered: sum((l) => l.downsSuffered),
  };
}

/**
 * The box score of one fighter (R2-T001): the stored match counters (authoritative), the Freshness around his first and
 * last round from the round lineups, and, when the rounds were re-simulated, a line per round he started. A result
 * played before `healingReceived` was counted gets it from the re-simulated rounds, or none.
 */
function boxOf(result: MatchResult, side: 'home' | 'away', id: FighterId, stats: FighterMatchStats, roundStats: ReadonlyMap<number, Record<FighterId, FighterMatchStats>> | null): FighterBox {
  const rounds: FighterBoxRound[] = [];
  let before: number | null = null;
  let after: number | null = null;
  let started = 0;
  for (const rl of result.roundLineups ?? []) {
    const lineup = rl[side];
    const slot = lineup.fighterIds.indexOf(id);
    if (slot < 0) continue;
    started++;
    const freshnessBefore = lineup.freshness[slot] ?? null;
    const freshnessAfter = lineup.freshnessAfter?.[slot] ?? null;
    if (before === null) before = freshnessBefore;
    after = freshnessAfter;
    const rs = roundStats?.get(rl.round)?.[id];
    if (rs) rounds.push({ round: rl.round, ...lineOf(rs), freshnessBefore, freshnessAfter });
  }
  const whole = lineOf(stats);
  if (whole.healingReceived === undefined && rounds.length > 0 && rounds.length === started) {
    whole.healingReceived = rounds.reduce((n, r) => n + (r.healingReceived ?? 0), 0);
  }
  return { ...whole, roundsStarted: started > 0 ? started : stats.roundsPlayed, freshnessBefore: before, freshnessAfter: after, rounds: rounds.length === started ? rounds : [] };
}

export function buildMatchReport(ports: GamePorts, state: GameState, fixtureId: FixtureId, content: ContentDB): Result<DetailedMatchReport, EngineError> {
  const result = state.results[fixtureId];
  if (!result) return fail('report.not-played', `Fixture "${fixtureId}" has not been played`);
  const compacted = ports.league.isCompactedResult(result);
  // Re-simulate at 'summary' only when the build matches the one that played it (05 §6). M1.1 results
  // replay round by round from the record (roundInputOf: no decision policy runs); M1 results as a whole match.
  let logs: FightLog[] | null = null;
  // Per-round counters of every fighter, index = round - 1: the re-simulated rounds' stats (null when the rounds were not re-simulated).
  let roundStats: Map<number, Record<FighterId, FighterMatchStats>> | null = null;
  if (result.engineVersion === ports.sim.engineVersion && result.contentHash === content.ref.hash && !compacted) {
    try {
      if (result.roundLineups) {
        const out = result.rounds.map((r) => ({ r, o: ports.sim.simulateRound(roundInputOf(result, r.round), r.seed, content, { record: 'summary' }) }));
        const same = out.every(({ r, o }) => o.result.checksum === r.checksum && o.log !== null);
        logs = same ? out.map(({ o }) => o.log!) : null;
        roundStats = same ? new Map(out.map(({ r, o }) => [r.round, o.fighterStats] as const)) : null;
      } else {
        const out = ports.sim.simulateMatch(result.input, content, { record: 'summary' });
        const same = out.rounds.length === result.rounds.length && out.rounds.every((r, i) => r.checksum === result.rounds[i]!.checksum);
        logs = same && out.logs ? out.logs : null;
      }
    } catch {
      logs = null;
      roundStats = null;
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
  const procs = logs ? perkProcsOf(logs) : null;
  const played = playedBy(result);
  const started = roundsStartedOf(result);
  const squads = result.squads;
  const emergencyIds = new Set(result.emergencyEntrants ?? []);
  const inRound1 = new Set([...home.fighterIds, ...away.fighterIds]);
  const clubOf = (side: 'home' | 'away'): ClubId => (side === 'home' ? result.homeClubId : result.awayClubId);
  const sideKeyOf = (clubId: ClubId): 'home' | 'away' => (clubId === result.homeClubId ? 'home' : 'away');
  const roleOf = (side: 'home' | 'away', id: FighterId): FighterRecap['role'] => {
    if (squads) return squads[side].starters.includes(id) ? 'starter' : squads[side].reserves.includes(id) && !emergencyIds.has(id) ? 'reserve' : 'emergency';
    return inRound1.has(id) ? 'starter' : undefined;
  };
  const extras = (side: 'home' | 'away', id: FighterId): Pick<FighterRecap, 'role' | 'roundsStarted'> => {
    const role = roleOf(side, id);
    const rounds = started.get(id);
    return { ...(role !== undefined ? { role } : {}), ...(rounds !== undefined ? { roundsStarted: [...rounds] } : {}) };
  };
  // Round-1 fives first, then reserves and entrants in record order (home, then away).
  const order = [...home.fighterIds, ...away.fighterIds, ...(Object.keys(result.fighterStats) as FighterId[])];
  const fromStats: FighterRecap[] = Object.entries(result.fighterStats)
    .sort(([a], [b]) => order.indexOf(a as FighterId) - order.indexOf(b as FighterId))
    .map(([id, stats]) => {
      const fid = id as FighterId;
      const n = stats.ruleFires.length;
      return {
        fighterId: fid,
        clubId: stats.clubId as ClubId,
        isCaptain: captains.has(fid),
        stats,
        box: boxOf(result, sideKeyOf(stats.clubId), fid, stats, roundStats),
        rules: stats.ruleFires.map((fires, index) => ({
          index,
          isStance: index === n - 1,
          fires,
          committedTicks: stats.ruleCommittedTicks[index] ?? 0,
          neverFired: stats.rulesNeverFired.includes(index),
        })),
        downs: stats.downs.map((d) => ({ round: d.round, tick: d.tick, byFighterId: d.byFighterId, abilityId: d.abilityId, hit: d.hit })),
        ...(procs ? { perkProcs: procs.get(fid) ?? {} } : {}),
        ...extras(sideKeyOf(stats.clubId), fid),
      };
    });
  // A compacted result keeps only the totals and the club of every fighter who played.
  const fromTotals: FighterRecap[] = [];
  if (fromStats.length === 0 && result.fighterTotals) {
    for (const side of SIDES) {
      for (const id of played[side]) {
        const t = result.fighterTotals[id];
        if (t === undefined) continue;
        fromTotals.push({ fighterId: id, clubId: clubOf(side), isCaptain: squads?.[side].captainId === id, stats: statsFromTotals(clubOf(side), t), rules: [], downs: [], ...extras(side, id) });
      }
    }
  }
  const fighters = fromStats.length > 0 ? fromStats : fromTotals;
  const { aftermath, benchClub } = aftermathOf(state, result);
  // Bench XP: the unused squad reserves first (squad order), then the rest of the fit roster, per club (home, then away).
  const bench: BenchXpLine[] = [];
  const benchXp = aftermath.benchXp;
  if (benchXp !== undefined) {
    for (const side of SIDES) {
      const clubId = clubOf(side);
      const reserves = (squads?.[side].reserves ?? []).filter((id) => benchXp[id] !== undefined && benchClub[id] === clubId && !played[side].includes(id));
      for (const id of reserves) bench.push({ fighterId: id, clubId, role: 'reserve', xp: benchXp[id]! });
      for (const id of (Object.keys(benchXp) as FighterId[]).filter((x) => benchClub[x] === clubId && !reserves.includes(x)).sort(compareIds)) {
        bench.push({ fighterId: id, clubId, role: 'bench', xp: benchXp[id]! });
      }
    }
  }
  const totalsOf = (side: 'home' | 'away'): ReportTotals => {
    const clubId = clubOf(side);
    const mine = fighters.filter((f) => f.clubId === clubId);
    const sum = (pick: (s: FighterMatchStats) => number): number => mine.reduce((n, f) => n + pick(f.stats), 0);
    const boxes = mine.flatMap((f) => (f.box ? [f.box] : []));
    const healingReceived = fromStats.length > 0 && boxes.length === mine.length && boxes.every((b) => b.healingReceived !== undefined) ? boxes.reduce((n, b) => n + b.healingReceived!, 0) : undefined;
    return {
      downsInflicted: sum((s) => s.downsInflicted),
      downsSuffered: sum((s) => s.downsSuffered),
      damageDealt: sum((s) => s.damageDealt),
      healingDone: sum((s) => s.healingDone),
      ...(healingReceived !== undefined ? { healingReceived } : {}),
      ...(fromStats.length > 0 ? { damageTaken: sum((s) => s.damageTaken), shieldingDone: sum((s) => s.shieldingDone) } : {}),
      xp: mine.reduce((n, f) => n + (aftermath.xp[f.fighterId] ?? 0), 0),
      benchXp: bench.filter((b) => b.clubId === clubId).reduce((n, b) => n + b.xp, 0),
    };
  };
  // Per-round team totals: the sum of the sides' fighters' lines for that round (only when the rounds were re-simulated).
  const roundTotals = (round: number): { totals?: { home: BoxScoreLine; away: BoxScoreLine } } => {
    if (roundStats === null) return {};
    const lines = (side: 'home' | 'away'): BoxScoreLine[] => fighters.filter((f) => f.clubId === clubOf(side)).flatMap((f) => f.box?.rounds.filter((r) => r.round === round) ?? []);
    return { totals: { home: sumLines(lines('home')), away: sumLines(lines('away')) } };
  };
  const reportSide = (side: 'home' | 'away', base: ReturnType<typeof sideOf>) => ({
    ...base,
    appearedIds: [...played[side]],
    unusedReserveIds: (squads?.[side].reserves ?? []).filter((id) => !played[side].includes(id)),
  });
  return ok({
    fixtureId,
    stage: result.stage,
    weekId: result.weekId,
    season: result.season,
    home: reportSide('home', home),
    away: reportSide('away', away),
    score: result.score,
    winnerClubId: result.winnerClubId,
    rounds: result.rounds.map((r, i) => ({
      round: r.round,
      winner: r.winner,
      endReason: r.endReason,
      tiebreakStep: r.tiebreakStep,
      durationTicks: r.durationTicks,
      keyEvents: logs?.[i] ? keyEvents(logs[i]!) : [],
      ...roundTotals(r.round),
    })),
    fighters,
    mvpFighterId: result.mvpFighterId,
    timelineAvailable: logs !== null,
    aftermath,
    totals: { home: totalsOf('home'), away: totalsOf('away') },
    ...(bench.length > 0 ? { bench } : {}),
    ...(compacted ? { compacted: true } : {}),
    ruleDetails: logs ? ruleDetails(logs) : [],
    timeline: timelineOf(state, result),
  });
}
