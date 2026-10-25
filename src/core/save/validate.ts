/**
 * State validation: structure (zod), content references and internal
 * references. Used by parseSave and by the soak harness after every season.
 * Pure; reports issues and never repairs (05 §5).
 */
import type { ContentDB } from '../content';
import { type GameState, idNumber } from '../model';
import { GameStateSchema, formatZodPath } from './schema';

export interface StateIssue {
  path: string;
  message: string;
}

/** Issues grouped by the SaveError code they map to. */
export interface StateCheck {
  structure: StateIssue[];
  content: StateIssue[];
  references: StateIssue[];
}

const MAX_ISSUES_PER_GROUP = 200;

export function structureIssues(state: unknown): StateIssue[] {
  const parsed = GameStateSchema.safeParse(state);
  if (parsed.success) return [];
  return parsed.error.issues.slice(0, MAX_ISSUES_PER_GROUP).map((i) => ({ path: formatZodPath(i.path), message: i.message }));
}

/** Every content id a (structurally valid) state refers to must exist in `content`. */
export function contentIssues(state: GameState, content: ContentDB): StateIssue[] {
  const issues: StateIssue[] = [];
  const add = (path: string, message: string): void => {
    if (issues.length < MAX_ISSUES_PER_GROUP) issues.push({ path, message });
  };
  const districts = new Set<string>();
  for (const r of content.regions.list) for (const d of r.districts ?? []) districts.add(d.id);
  const paces = new Set(content.development.pace.levels.map((p) => p.id));
  const stats = new Set<string>(content.stats.list.map((s) => s.id));
  const checkTactics = (path: string, t: { kind: string; presetId?: string }): void => {
    if (t.kind === 'preset' && t.presetId !== undefined && !content.presets.has(t.presetId)) add(path, `unknown preset "${t.presetId}"`);
  };
  const checkStatKeys = (path: string, rec: Record<string, number>): void => {
    for (const k of Object.keys(rec)) if (!stats.has(k)) add(path, `unknown stat "${k}"`);
  };

  if (state.calendar.weekId !== null && !content.weeks.has(state.calendar.weekId)) {
    add('calendar.weekId', `unknown week "${state.calendar.weekId}"`);
  }
  for (const [cid, c] of Object.entries(state.clubs)) {
    const p = `clubs.${cid}`;
    if (!content.tiers.has(c.tierId)) add(`${p}.tierId`, `unknown tier "${c.tierId}"`);
    if (!content.regions.has(c.regionId)) add(`${p}.regionId`, `unknown region "${c.regionId}"`);
    if (!districts.has(c.districtId)) add(`${p}.districtId`, `unknown district "${c.districtId}"`);
    if (!content.aiPersonalities.has(c.aiPersonalityId)) add(`${p}.aiPersonalityId`, `unknown AI personality "${c.aiPersonalityId}"`);
    for (const [fid, t] of Object.entries(c.lineup.tactics)) checkTactics(`${p}.lineup.tactics.${fid}`, t);
  }
  for (const [fid, f] of Object.entries(state.fighters)) {
    const p = `fighters.${fid}`;
    if (!content.classes.has(f.classId)) add(`${p}.classId`, `unknown class "${f.classId}"`);
    if (!content.races.has(f.raceId)) add(`${p}.raceId`, `unknown race "${f.raceId}"`);
    if (!content.regions.has(f.originRegionId)) add(`${p}.originRegionId`, `unknown region "${f.originRegionId}"`);
    if (!paces.has(f.paceId)) add(`${p}.paceId`, `unknown pace "${f.paceId}"`);
    for (const t of f.traits) if (!content.traits.has(t.id)) add(`${p}.traits`, `unknown trait "${t.id}"`);
    checkStatKeys(`${p}.cap100`, f.cap100);
    checkStatKeys(`${p}.wear100`, f.wear100);
  }
  for (const [xid, r] of Object.entries(state.results)) {
    for (const side of [r.input.home, r.input.away]) {
      for (const ff of side.fighters) {
        const p = `results.${xid}.input.${ff.fighterId}`;
        if (!content.classes.has(ff.classId)) add(p, `unknown class "${ff.classId}"`);
        if (!content.races.has(ff.raceId)) add(p, `unknown race "${ff.raceId}"`);
        checkTactics(p, ff.tactics);
      }
    }
  }
  for (const [xid, x] of Object.entries(state.fixtures)) {
    if (!content.tiers.has(x.tierId)) add(`fixtures.${xid}.tierId`, `unknown tier "${x.tierId}"`);
    if (!content.weeks.has(x.weekId)) add(`fixtures.${xid}.weekId`, `unknown week "${x.weekId}"`);
    if (x.venueId !== null && !content.venues.has(x.venueId)) add(`fixtures.${xid}.venueId`, `unknown venue "${x.venueId}"`);
  }
  for (const [kid, k] of Object.entries(state.competitions)) {
    if (!content.tiers.has(k.tierId)) add(`competitions.${kid}.tierId`, `unknown tier "${k.tierId}"`);
  }
  return issues;
}

/** Internal referential integrity and the ledger invariant. */
export function referenceIssues(state: GameState, content: ContentDB): StateIssue[] {
  const issues: StateIssue[] = [];
  const add = (path: string, message: string): void => {
    if (issues.length < MAX_ISSUES_PER_GROUP) issues.push({ path, message });
  };
  const clubs = state.clubs as Record<string, GameState['clubs'][keyof GameState['clubs']]>;
  const fighters = state.fighters as Record<string, GameState['fighters'][keyof GameState['fighters']]>;
  const fixtures = state.fixtures as Record<string, GameState['fixtures'][keyof GameState['fixtures']]>;
  const competitions = state.competitions as Record<string, GameState['competitions'][keyof GameState['competitions']]>;
  const isClub = (id: string | null): boolean => id === null || clubs[id] !== undefined;
  const isFighter = (id: string | null): boolean => id === null || fighters[id] !== undefined;

  // calendar
  const weekCount = content.leagues.calendar.weeks.length;
  const cal = state.calendar;
  if (cal.phase === 'season-end') {
    if (cal.weekId !== null) add('calendar.weekId', 'must be null during season-end');
    if (cal.weekIndex !== weekCount + 1) add('calendar.weekIndex', `must be ${weekCount + 1} during season-end`);
  } else if (cal.weekIndex < 1 || cal.weekIndex > weekCount) {
    add('calendar.weekIndex', `out of range 1..${weekCount}`);
  } else {
    const def = content.weekByIndex(cal.weekIndex);
    if (cal.weekId !== null && cal.weekId !== def.id) add('calendar.weekId', `is "${cal.weekId}", week ${cal.weekIndex} is "${def.id}"`);
    if (def.phase !== cal.phase) add('calendar.phase', `is "${cal.phase}", week ${def.id} is "${def.phase}"`);
  }
  if (!isClub(state.playerClubId)) add('playerClubId', `unknown club "${state.playerClubId}"`);

  // clubs
  for (const [cid, c] of Object.entries(clubs)) {
    const p = `clubs.${cid}`;
    if (c.id !== cid) add(`${p}.id`, `key/id mismatch "${c.id}"`);
    const own = (fid: string | null, path: string): void => {
      if (fid === null) return;
      const f = fighters[fid];
      if (!f) add(path, `unknown fighter "${fid}"`);
      else if (f.clubId !== cid) add(path, `fighter "${fid}" is not on this club's roster`);
    };
    own(c.captainId, `${p}.captainId`);
    own(c.viceCaptainId, `${p}.viceCaptainId`);
    if (c.captainId !== null && c.captainId === c.viceCaptainId) add(`${p}.viceCaptainId`, 'equals the captain');
    const seen = new Set<string>();
    c.lineup.fighters.forEach((e, i) => {
      if (seen.has(e.fighterId)) add(`${p}.lineup.fighters[${i}]`, `duplicate fighter "${e.fighterId}"`);
      seen.add(e.fighterId);
      const f = fighters[e.fighterId];
      if (!f) add(`${p}.lineup.fighters[${i}]`, `unknown fighter "${e.fighterId}"`);
      else if (f.clubId !== cid && f.status !== 'hired-blade') add(`${p}.lineup.fighters[${i}]`, `fighter "${e.fighterId}" is not on this club's roster`);
    });
    if (c.lineup.matchCaptainId !== null && !seen.has(c.lineup.matchCaptainId)) {
      add(`${p}.lineup.matchCaptainId`, `"${c.lineup.matchCaptainId}" is not in the lineup`);
    }
    for (const fid of Object.keys(c.lineup.tactics)) if (!isFighter(fid)) add(`${p}.lineup.tactics`, `unknown fighter "${fid}"`);
    for (const fid of c.shortlist) if (!isFighter(fid)) add(`${p}.shortlist`, `unknown fighter "${fid}"`);
    if (state.ledger.openingBalances[c.id] === undefined) add(`ledger.openingBalances.${cid}`, 'missing');
  }

  // fighters
  let maxFighter = 0;
  for (const [fid, f] of Object.entries(fighters)) {
    const p = `fighters.${fid}`;
    if (f.id !== fid) add(`${p}.id`, `key/id mismatch "${f.id}"`);
    maxFighter = Math.max(maxFighter, idNumber(fid));
    if (!isClub(f.clubId)) add(`${p}.clubId`, `unknown club "${f.clubId}"`);
    if (f.contract !== null && f.contract.clubId !== f.clubId) add(`${p}.contract.clubId`, `contract club "${f.contract.clubId}" differs from clubId "${f.clubId}"`);
    if (f.status === 'active' && (f.clubId === null || f.contract === null)) add(`${p}.status`, 'active fighter without club or contract');
    if ((f.status === 'free-agent' || f.status === 'retired') && f.clubId !== null) add(`${p}.status`, `${f.status} fighter with clubId "${f.clubId}"`);
    if (f.freeAgency !== null && !isClub(f.freeAgency.formerClubId)) add(`${p}.freeAgency.formerClubId`, 'unknown club');
  }
  if (state.ids.fighter <= maxFighter) add('ids.fighter', `counter ${state.ids.fighter} <= highest fighter id ${maxFighter}`);

  // competitions and fixtures
  for (const [kid, k] of Object.entries(competitions)) {
    if (k.id !== kid) add(`competitions.${kid}.id`, 'key/id mismatch');
    for (const cid of k.clubIds) if (!isClub(cid)) add(`competitions.${kid}.clubIds`, `unknown club "${cid}"`);
    for (const xid of k.fixtureIds) if (!fixtures[xid]) add(`competitions.${kid}.fixtureIds`, `unknown fixture "${xid}"`);
  }
  for (const [xid, x] of Object.entries(fixtures)) {
    const p = `fixtures.${xid}`;
    if (x.id !== xid) add(`${p}.id`, 'key/id mismatch');
    if (!competitions[x.competitionId]) add(`${p}.competitionId`, `unknown competition "${x.competitionId}"`);
    if (!isClub(x.homeClubId)) add(`${p}.homeClubId`, 'unknown club');
    if (!isClub(x.awayClubId)) add(`${p}.awayClubId`, 'unknown club');
    if (x.homeClubId === x.awayClubId) add(p, 'a club plays itself');
    const played = (state.results as Record<string, unknown>)[xid] !== undefined;
    if (played !== (x.status === 'played')) add(`${p}.status`, `status "${x.status}" but result ${played ? 'present' : 'missing'}`);
  }
  for (const [xid, r] of Object.entries(state.results)) {
    const p = `results.${xid}`;
    if (r.fixtureId !== xid) add(`${p}.fixtureId`, 'key/id mismatch');
    if (!fixtures[xid]) add(p, 'result without fixture');
    if (r.winnerClubId !== r.homeClubId && r.winnerClubId !== r.awayClubId) add(`${p}.winnerClubId`, 'winner is neither side');
  }

  // market
  state.market.offers.forEach((o, i) => {
    if (!isClub(o.clubId)) add(`market.offers[${i}].clubId`, `unknown club "${o.clubId}"`);
    const f = fighters[o.fighterId];
    if (!f) add(`market.offers[${i}].fighterId`, `unknown fighter "${o.fighterId}"`);
    else if (f.status !== 'free-agent') add(`market.offers[${i}].fighterId`, `offer to "${o.fighterId}" who is ${f.status}`);
  });
  for (const [cid, ids] of Object.entries(state.market.trialsRookies)) {
    if (!isClub(cid)) add(`market.trialsRookies.${cid}`, 'unknown club');
    for (const fid of ids) if (!isFighter(fid)) add(`market.trialsRookies.${cid}`, `unknown fighter "${fid}"`);
  }

  // ledger invariant: balance == opening + Σ entries (per club, current season)
  const sums = new Map<string, number>();
  let prevSeq = 0;
  state.ledger.entries.forEach((e, i) => {
    if (!isClub(e.clubId)) add(`ledger.entries[${i}].clubId`, `unknown club "${e.clubId}"`);
    if (e.seq <= prevSeq) add(`ledger.entries[${i}].seq`, 'not strictly increasing');
    prevSeq = e.seq;
    sums.set(e.clubId, (sums.get(e.clubId) ?? 0) + e.amount);
  });
  if (state.ledger.nextSeq <= prevSeq) add('ledger.nextSeq', `${state.ledger.nextSeq} <= last entry seq ${prevSeq}`);
  for (const [cid, c] of Object.entries(clubs)) {
    const opening = state.ledger.openingBalances[c.id] ?? 0;
    const expected = opening + (sums.get(cid) ?? 0);
    if (c.finance.balance !== expected) add(`clubs.${cid}.finance.balance`, `balance ${c.finance.balance} != opening ${opening} + ledger ${expected - opening}`);
  }

  // news and AI memory
  let maxNews = 0;
  state.news.forEach((n, i) => {
    maxNews = Math.max(maxNews, idNumber(n.id));
    if (!isClub(n.clubId)) add(`news[${i}].clubId`, `unknown club "${n.clubId}"`);
  });
  if (state.ids.news <= maxNews) add('ids.news', `counter ${state.ids.news} <= highest news id ${maxNews}`);
  for (const cid of Object.keys(state.ai)) if (!isClub(cid)) add(`ai.${cid}`, 'unknown club');

  // history
  state.history.forEach((h, i) => {
    for (const t of h.tiers) {
      for (const cid of [t.reckoningChampionId, t.reckoningRunnerUpId, t.shieldWinnerId, ...t.promotedIds, ...t.relegatedIds]) {
        if (!isClub(cid)) add(`history[${i}]`, `unknown club "${cid}"`);
      }
    }
  });
  return issues;
}

/** All checks, grouped. Structure first: content and reference checks only run on a structurally valid state. */
export function checkState(state: unknown, content: ContentDB): StateCheck {
  const structure = structureIssues(state);
  if (structure.length > 0) return { structure, content: [], references: [] };
  const s = state as GameState;
  return { structure, content: contentIssues(s, content), references: referenceIssues(s, content) };
}
