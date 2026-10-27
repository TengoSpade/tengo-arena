/**
 * DEV-ONLY engine: the real core first, and a PROVISIONAL stand-in for any
 * core function that still throws NotImplementedError (05 §9.2: "stubs: use
 * the testkit fixture world in tests and the dev fixture world in the
 * browser"). As WP1-WP5 land, their real functions take over automatically.
 *
 * Nothing here is a game rule: values are placeholders so screens can be
 * exercised end to end (club choice, lineup, Continue, saves). Loaded only
 * behind import.meta.env.DEV or from tests; never in a production bundle.
 */
import { combatRating, type ContentDB, type PresetDef } from '../../core/content';
import type { FighterView } from '../../core/game';
import {
  SAVE_FORMAT,
  STATE_SCHEMA_VERSION,
  asId,
  type Blocker,
  type ClubId,
  type Command,
  type Competition,
  type Fighter,
  type FighterId,
  type Fixture,
  type GameState,
  type SaveEnvelope,
  type SaveError,
  type SaveMeta,
  type StandingRow,
  type StatId,
  type WeekId,
  type WeekReport,
} from '../../core/model';
import { checksumState } from '../../core/save';
import { ENGINE_VERSION } from '../../core/sim';
import { NotImplementedError, cloneJson, engineError, err, ok, type Result } from '../../core/util';
import { coreEngine, type GameEngine } from '../store/engine';
import { betweenRoundViewDev, finishLiveMatchDev, levelUpViewDev, resolveLevelUpDev } from './dev-m11';
import { buildDevWorld, devResult } from './dev-world';

type AnyFn = (...args: never[]) => unknown;

/** Wrap every engine function: try `base`, fall back to `provisional` on NotImplementedError. */
export function withFallback(base: GameEngine, provisional: Partial<GameEngine>): GameEngine {
  const out = {} as Record<string, AnyFn>;
  for (const key of Object.keys(base) as (keyof GameEngine)[]) {
    const real = base[key] as unknown as (...args: unknown[]) => unknown;
    const stand = provisional[key] as unknown as ((...args: unknown[]) => unknown) | undefined;
    out[key] = ((...args: unknown[]) => {
      try {
        return real(...args);
      } catch (e) {
        if (e instanceof NotImplementedError && stand) return stand(...args);
        throw e;
      }
    }) as AnyFn;
  }
  return out as unknown as GameEngine;
}

export function createDevEngine(base: GameEngine = coreEngine): GameEngine {
  const engine = withFallback(base, provisional);
  // Until WP-B binds the real resolution, core answers levelup.choose with "levelup.unavailable": resolve it here.
  const apply = engine.applyCommand;
  engine.applyCommand = (state, command, content) => {
    const r = apply(state, command, content);
    if (!r.ok && r.error.code === 'levelup.unavailable' && command.type === 'levelup.choose') return applyCommandDev(state, command, content);
    return r;
  };
  return engine;
}

// ---- provisional views -------------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function devStats(f: Fighter, content: ContentDB): Record<StatId, number> {
  const out = {} as Record<StatId, number>;
  for (const stat of content.stats.list) {
    let v = Math.round((f.cap100[stat.id as StatId] ?? 1000) / 100 - (f.wear100[stat.id as StatId] ?? 0) / 100);
    for (const tr of f.traits) {
      for (const eff of content.traits.get(tr.id)?.effects ?? []) {
        if (eff.type === 'stat' && 'stat' in eff && eff.stat === stat.id && 'add' in eff && typeof eff.add === 'number') v += eff.add;
      }
    }
    out[stat.id as StatId] = clamp(v, 1, 20);
  }
  return out;
}

/** The one rating formula (core/content combatRating) on the provisional dev stats. */
function devRating(f: Fighter, content: ContentDB): number {
  return combatRating(content, f.classId, devStats(f, content));
}

function devCaptaincy(f: Fighter, content: ContentDB) {
  const stats = devStats(f, content);
  const cq = clamp(Math.round((stats['ldr' as StatId] ?? 10) * 5 * 0.6 + (stats['cmp' as StatId] ?? 10) * 5 * 0.4), 1, 100);
  const grades = [...content.development.captaincy.grades].sort((a, b) => b.minCq - a.minCq);
  const grade = grades.find((g) => cq >= g.minCq) ?? grades[grades.length - 1]!;
  return { cq, grade };
}

function isFitDev(f: Fighter): boolean {
  return (f.status === 'active' || f.status === 'free-agent') && (!f.injury || f.injury.weeksOut <= 0);
}

function rosterDev(state: GameState, clubId: ClubId): Fighter[] {
  const club = state.clubs[clubId];
  const slot = (id: FighterId) => {
    const i = club?.lineup.fighters.findIndex((e) => e.fighterId === id) ?? -1;
    return i < 0 ? 99 : i;
  };
  return Object.values(state.fighters)
    .filter((f) => f.clubId === clubId && f.status === 'active')
    .sort((a, b) => slot(a.id) - slot(b.id) || b.potentialRoll - a.potentialRoll || (a.id < b.id ? -1 : 1));
}

function presetsDev(classId: string, content: ContentDB): PresetDef[] {
  const k = content.classes.get(classId);
  return (k?.presetIds ?? []).map((id) => content.presets.require(id));
}

function fighterViewDev(state: GameState, fighterId: FighterId, content: ContentDB): FighterView {
  const f = state.fighters[fighterId];
  if (!f) throw new Error(`unknown fighter ${fighterId}`);
  const race = content.races.require(f.raceId);
  const humanAge = Math.round((f.age * 80) / race.lifespan);
  const cap = devCaptaincy(f, content);
  const rating = devRating(f, content);
  const tier = f.clubId ? state.clubs[f.clubId]?.tierId : undefined;
  const minWage = tier ? content.tierProfile(content.tiers.require(tier).level).tierMinWage : content.tierProfile(content.leagues.tiers.length).tierMinWage;
  return {
    fighter: f,
    stats: devStats(f, content),
    rating,
    potential: Math.max(rating, f.potentialRoll),
    humanAge,
    captaincy: { cq: cap.cq, gradeId: cap.grade.id, letter: cap.grade.letter },
    injuryChanceBp: 120 + (f.age % 5) * 15,
    retirementChanceBp: humanAge >= 31 ? (humanAge - 30) * 300 : 0,
    marketWage: Math.round((minWage * (1 + rating / 60)) / 5) * 5,
    askFromPlayer: null,
    available: isFitDev(f),
  };
}

function standingsDev(state: GameState, competitionId: Competition['id'], scope: string, content: ContentDB): StandingRow[] {
  const comp = state.competitions[competitionId];
  if (!comp) return [];
  const clubIds = scope === 'tier' ? comp.clubIds : (comp.wings.find((w) => w.wingId === scope)?.clubIds ?? []);
  const points = content.leagues.standings.pointsByResult as Record<string, number>;
  const rows = new Map<ClubId, StandingRow>(
    clubIds.map((id) => [
      id,
      { clubId: id, position: 0, played: 0, matchWins: 0, matchLosses: 0, points: 0, roundsWon: 0, roundsLost: 0, downsInflicted: 0, downsSuffered: 0, results: { '2-0': 0, '2-1': 0, '1-2': 0, '0-2': 0 }, form: [] },
    ]),
  );
  const results = comp.fixtureIds
    .map((id) => state.results[id])
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort((a, b) => a.weekIndex - b.weekIndex);
  for (const r of results) {
    for (const side of ['home', 'away'] as const) {
      const clubId = side === 'home' ? r.homeClubId : r.awayClubId;
      const row = rows.get(clubId);
      if (!row) continue;
      const mine = side === 'home' ? r.score.home : r.score.away;
      const theirs = side === 'home' ? r.score.away : r.score.home;
      const key = `${mine}-${theirs}` as keyof StandingRow['results'];
      row.played += 1;
      row.roundsWon += mine;
      row.roundsLost += theirs;
      if (mine > theirs) row.matchWins += 1;
      else row.matchLosses += 1;
      if (key in row.results) row.results[key] += 1;
      row.points += points[key] ?? 0;
      row.form = [...row.form, mine > theirs ? ('W' as const) : ('L' as const)].slice(-5);
    }
  }
  const sorted = [...rows.values()].sort(
    (a, b) => b.points - a.points || b.roundsWon - b.roundsLost - (a.roundsWon - a.roundsLost) || (a.clubId < b.clubId ? -1 : 1),
  );
  sorted.forEach((row, i) => (row.position = i + 1));
  return sorted;
}

function blockersDev(state: GameState, _content: ContentDB): Blocker[] {
  if (!state.playerClubId) return [{ code: 'club.not-chosen' }];
  if (state.calendar.phase === 'season-end') return [{ code: 'phase.season-end' }];
  const club = state.clubs[state.playerClubId]!;
  const out: Blocker[] = [];
  const fit = club.lineup.fighters.filter((e) => {
    const f = state.fighters[e.fighterId];
    return f && f.clubId === club.id && isFitDev(f);
  });
  for (const e of club.lineup.fighters) {
    const f = state.fighters[e.fighterId];
    if (!f || f.clubId !== club.id) out.push({ code: 'lineup.not-on-roster', fighterId: e.fighterId });
    else if (!isFitDev(f)) out.push({ code: 'lineup.unavailable', fighterId: e.fighterId });
  }
  if (fit.length < 5 && out.length === 0) out.push({ code: 'lineup.incomplete', details: { have: fit.length } });
  return out;
}

function applyCommandDev(state: GameState, command: Command, content: ContentDB) {
  const next = cloneJson(state);
  const own = (clubId: ClubId) => next.clubs[clubId];
  switch (command.type) {
    case 'club.choose': {
      if (!next.clubs[command.clubId]) return err(engineError('club.unknown', 'unknown club'));
      next.playerClubId = command.clubId;
      break;
    }
    case 'lineup.set': {
      const club = own(command.clubId);
      if (!club) return err(engineError('club.unknown', 'unknown club'));
      if (command.fighters.length > 5) return err(engineError('lineup.size', 'at most 5 fighters'));
      const ids = new Set(command.fighters.map((e) => e.fighterId));
      if (ids.size !== command.fighters.length) return err(engineError('lineup.duplicate', 'duplicate fighter'));
      for (const e of command.fighters) {
        if (next.fighters[e.fighterId]?.clubId !== club.id) return err(engineError('lineup.not-on-roster', 'not on roster'));
      }
      club.lineup.fighters = command.fighters.map((e) => ({ ...e }));
      club.lineup.matchCaptainId = command.matchCaptainId;
      break;
    }
    case 'tactics.assign': {
      const club = own(command.clubId);
      const f = next.fighters[command.fighterId];
      if (!club || !f || f.clubId !== club.id) return err(engineError('tactics.not-on-roster', 'not on roster'));
      if (command.tactics.kind === 'preset' && !content.classes.require(f.classId).presetIds.includes(command.tactics.presetId)) {
        return err(engineError('tactics.wrong-class', 'preset of another class'));
      }
      club.lineup.tactics[command.fighterId] = command.tactics;
      break;
    }
    case 'captaincy.set': {
      const club = own(command.clubId);
      if (!club) return err(engineError('club.unknown', 'unknown club'));
      if (command.captainId && command.captainId === command.viceCaptainId) return err(engineError('captaincy.same', 'captain and vice-captain must differ'));
      club.captainId = command.captainId;
      club.viceCaptainId = command.viceCaptainId;
      break;
    }
    case 'training.set': {
      const f = next.fighters[command.fighterId];
      if (!f || f.clubId !== command.clubId) return err(engineError('training.not-on-roster', 'not on roster'));
      f.trainingEmphasis = command.emphasis;
      break;
    }
    case 'shortlist.toggle': {
      const club = own(command.clubId);
      if (!club) return err(engineError('club.unknown', 'unknown club'));
      club.shortlist = club.shortlist.includes(command.fighterId) ? club.shortlist.filter((id) => id !== command.fighterId) : [...club.shortlist, command.fighterId];
      break;
    }
    case 'news.markRead': {
      for (const n of next.news) if (command.newsIds.includes(n.id)) n.read = true;
      break;
    }
    case 'levelup.choose': {
      // M1.1 stand-in until WP-B's resolveLevelUp (dev-m11.ts).
      if (state.liveMatch) return err(engineError('levelup.match-in-progress', 'Level-up picks wait until the match is over'));
      const r = resolveLevelUpDev(state, command.fighterId, command.level, command.optionIndex, command.traitIndex);
      return r.ok ? ok({ state: r.value, newsIds: [], response: null }) : r;
    }
    default:
      throw new NotImplementedError(`game.applyCommand(${command.type})`);
  }
  return ok({ state: next, newsIds: [], response: null });
}

function advanceWeekDev(state: GameState, content: ContentDB) {
  const blockers = blockersDev(state, content);
  if (blockers.length > 0) return err(engineError(`blocked.${blockers[0]!.code}`, 'blocked'));
  const next = cloneJson(state);
  const { weekIndex, season } = next.calendar;
  const fixtures = Object.values(next.fixtures)
    .filter((fx) => fx.season === season && fx.weekIndex === weekIndex && fx.status === 'scheduled')
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const fx of fixtures) {
    next.results[fx.id] = devResult(next, fx);
    fx.status = 'played';
  }
  for (const f of Object.values(next.fighters)) {
    if (f.injury && f.injury.weeksOut > 0) {
      f.injury.weeksOut -= 1;
      if (f.injury.weeksOut === 0) f.injury = null;
    }
  }
  const playerFixture = fixtures.find((fx) => fx.homeClubId === next.playerClubId || fx.awayClubId === next.playerClubId) ?? null;
  const total = content.leagues.calendar.weeks.length;
  const weekId = next.calendar.weekId ?? asId<WeekId>(content.weekByIndex(weekIndex).id);
  if (weekIndex >= total) {
    next.calendar = { season, weekIndex: total + 1, weekId: null, phase: 'season-end' };
  } else {
    const w = content.weekByIndex(weekIndex + 1);
    next.calendar = { season, weekIndex: weekIndex + 1, weekId: asId<WeekId>(w.id), phase: w.phase };
  }
  const report: WeekReport = {
    season,
    weekIndex,
    weekId,
    phaseAfter: next.calendar.phase,
    fixtureIds: fixtures.map((fx) => fx.id),
    playerFixtureId: playerFixture?.id ?? null,
    newsIds: [],
    ledgerSeqFrom: next.ledger.nextSeq,
    ledgerSeqTo: next.ledger.nextSeq,
  };
  return ok({ state: next, report });
}

function clubFixtureDev(state: GameState, clubId: ClubId, weekIndex: number): Fixture | null {
  return (
    Object.values(state.fixtures).find(
      (fx) => fx.season === state.calendar.season && fx.weekIndex === weekIndex && (fx.homeClubId === clubId || fx.awayClubId === clubId),
    ) ?? null
  );
}

function clubScheduleDev(state: GameState, clubId: ClubId): Fixture[] {
  return Object.values(state.fixtures)
    .filter((fx) => fx.season === state.calendar.season && (fx.homeClubId === clubId || fx.awayClubId === clubId))
    .sort((a, b) => a.weekIndex - b.weekIndex || (a.id < b.id ? -1 : 1));
}

function wageBillDev(state: GameState, clubId: ClubId): number {
  return Object.values(state.fighters)
    .filter((f) => f.clubId === clubId && f.contract)
    .reduce((s, f) => s + (f.contract?.wagePerWeek ?? 0), 0);
}

function pendingWagesDev(state: GameState, clubId: ClubId): number {
  return state.market.offers.filter((o) => o.clubId === clubId).reduce((s, o) => s + o.wagePerWeek, 0);
}

const provisional: Partial<GameEngine> = {
  // ---- M1.1 stand-ins (dev-m11.ts) until WP-B / WP-C merge ----
  levelUpView: levelUpViewDev,
  betweenRoundView: betweenRoundViewDev,
  advance: (state, content) => {
    const base = state.liveMatch ? finishLiveMatchDev(state, content) : state;
    let r;
    try {
      r = coreEngine.advanceWeek(base, content);
    } catch (e) {
      if (!(e instanceof NotImplementedError)) throw e;
      r = advanceWeekDev(base, content);
    }
    return r.ok ? ok({ state: r.value.state, week: r.value.report, pause: null }) : r;
  },
  createWorld: (content, params) => ok(buildDevWorld(content, { rootSeed: params.rootSeed, playerClubId: null, weekIndex: 1 })),
  applyCommand: applyCommandDev as GameEngine['applyCommand'],
  getBlockers: blockersDev,
  advanceWeek: advanceWeekDev as GameEngine['advanceWeek'],
  runSeasonEnd: (state) => {
    const next = cloneJson(state);
    next.calendar = { season: state.calendar.season + 1, weekIndex: 1, weekId: asId<WeekId>('P1'), phase: 'preseason' };
    for (const f of Object.values(next.fighters)) f.age += 1;
    return ok({ state: next, report: { record: null as never, playerClub: null, newsIds: [] } });
  },
  roster: rosterDev,
  fighterView: fighterViewDev,
  freeAgents: (state) =>
    Object.values(state.fighters)
      .filter((f) => f.status === 'free-agent')
      .sort((a, b) => b.potentialRoll - a.potentialRoll || (a.id < b.id ? -1 : 1)),
  suggestLineup: (state, clubId, content) => {
    const roster = rosterDev(state, clubId).filter(isFitDev);
    const best = [...roster].sort((a, b) => devRating(b, content) - devRating(a, content)).slice(0, 5);
    return {
      type: 'lineup.set',
      clubId,
      fighters: best.map((f) => ({ fighterId: f.id, row: content.classes.require(f.classId).startingRow })),
      matchCaptainId: null,
    };
  },
  lineupChemistry: (state, clubId, _ids, captainId, content) => {
    const captain = captainId ? state.fighters[captainId] : undefined;
    void clubId;
    return captain ? clamp(devCaptaincy(captain, content).grade.chemistry, -5, 5) : 0;
  },
  captaincy: (state, fighterId, _clubId, content) => devCaptaincy(state.fighters[fighterId]!, content),
  isFit: isFitDev,
  standings: standingsDev as GameEngine['standings'],
  leagueCompetitionOf: (state, season, tierId) =>
    (Object.values(state.competitions).find((c) => c.kind === 'league' && c.season === season && c.tierId === tierId)?.id ?? null) as never,
  clubFixture: clubFixtureDev,
  clubSchedule: clubScheduleDev,
  financeView: (state, clubId) => {
    const club = state.clubs[clubId]!;
    const bill = wageBillDev(state, clubId);
    return {
      balance: club.finance.balance,
      seasonBudget: club.finance.seasonBudget,
      seasonBudgetParts: [],
      wageBudgetPerWeek: club.finance.wageBudgetPerWeek,
      wageBill: bill,
      pendingWages: pendingWagesDev(state, clubId),
      status: club.finance.status,
      statusReason: null,
      projectedSeasonEndBalance: club.finance.balance,
      registryDebt: club.finance.registryDebt,
      byCategory: {},
    };
  },
  wageBill: wageBillDev,
  pendingWages: pendingWagesDev,
  presetsForClass: presetsDev as GameEngine['presetsForClass'],
  saveMetaFor: (state, params): SaveMeta => {
    const club = state.playerClubId ? state.clubs[state.playerClubId] : undefined;
    return {
      slotId: params.slotId,
      kind: params.kind,
      label: params.label,
      savedAt: params.savedAt,
      gameVersion: params.gameVersion,
      season: state.calendar.season,
      weekIndex: state.calendar.weekIndex,
      weekId: state.calendar.weekId,
      phase: state.calendar.phase,
      playerClubId: state.playerClubId,
      playerClubName: club?.name ?? null,
      playtimeSec: params.playtimeSec,
    };
  },
  createSave: (state, meta, versions, commandLog): SaveEnvelope => ({
    format: SAVE_FORMAT,
    schemaVersion: STATE_SCHEMA_VERSION,
    engineVersion: versions.engineVersion,
    content: state.content,
    meta,
    checksum: checksumState(state),
    state,
    ...(commandLog ? { commandLog: [...commandLog] } : {}),
  }),
  serializeSave: (envelope) => JSON.stringify(envelope),
  parseSave: (json, content): Result<{ envelope: SaveEnvelope; migratedFrom: number | null; warnings: string[] }, SaveError> => {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return err({ code: 'save.json', message: 'invalid JSON' });
    }
    const env = raw as Partial<SaveEnvelope>;
    if (!env || env.format !== SAVE_FORMAT || !env.state || !env.meta) return err({ code: 'save.format', message: 'not a save' });
    if ((env.schemaVersion ?? 0) > STATE_SCHEMA_VERSION) return err({ code: 'save.too-new', message: 'too new' });
    if (checksumState(env.state) !== env.checksum) return err({ code: 'save.checksum', message: 'checksum mismatch' });
    if (env.content?.id !== content.ref.id) return err({ code: 'save.content-missing', message: 'other theme' });
    void ENGINE_VERSION;
    return ok({ envelope: env as SaveEnvelope, migratedFrom: null, warnings: [] });
  },
};
