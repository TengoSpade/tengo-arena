/**
 * Read-only views for the UI (pure functions of the committed state) and the
 * player's Continue blockers (02 §3 transitions table).
 */
import type { ContentDB } from '../content';
import type { SnubExemption } from '../fighters';
import { freeAgentList, type Blocker, type ClubId, type Command, type Fighter, type FighterId, type GameState, type Gold, type StatId } from '../model';
import type { GamePorts } from './ports';
import { getOwn } from '../util';
import { compareIds, onRoster, rosterOf } from './shared';

/** Everything the fighter profile and roster tables show. */
export interface FighterView {
  fighter: Fighter;
  stats: Record<StatId, number>;
  rating: number;
  potential: number;
  humanAge: number;
  captaincy: { cq: number; gradeId: string; letter: string };
  trend: string;
  injuryChanceBp: number;
  retirementChanceBp: number;
  marketWage: Gold;
  /** Ask from the viewing club for its preferred length (free agents and renewals). */
  askFromPlayer: Gold | null;
  available: boolean;
}

export function getBlockers(ports: GamePorts, state: GameState, content: ContentDB): Blocker[] {
  if (state.playerClubId === null) return [{ code: 'club.not-chosen' }];
  if (state.calendar.phase === 'season-end') return [{ code: 'phase.season-end' }];
  const clubId = state.playerClubId;
  const club = getOwn(state.clubs, clubId);
  if (!club) return [{ code: 'club.not-chosen' }];
  const out: Blocker[] = [];
  const roster = rosterOf(state, clubId);
  const cap = content.tiers.require(club.tierId).rosterCap;
  const week = content.weekByIndex(state.calendar.weekIndex);
  const kickOffOrLater = state.calendar.phase !== 'preseason' || week.commit === 'kick_off';
  if (kickOffOrLater && roster.length > cap) {
    out.push({ code: 'roster.over-cap', details: { roster: roster.length, cap, release: roster.length - cap } });
  }
  const fixture = ports.league.clubFixture(state, clubId, state.calendar.weekIndex);
  if (fixture && fixture.status === 'scheduled') {
    let valid = 0;
    const named = new Set<string>();
    for (const e of club.lineup.fighters) {
      named.add(e.fighterId);
      const f = onRoster(state, clubId, e.fighterId);
      if (!f) out.push({ code: 'lineup.not-on-roster', fighterId: e.fighterId });
      else if (!ports.fighters.isFit(f)) out.push({ code: 'lineup.unavailable', fighterId: e.fighterId });
      else valid++;
    }
    // Hired blades cover a short roster (open-006); only a lineup that leaves fit fighters out is incomplete.
    const fit = roster.filter((f) => ports.fighters.isFit(f)).length;
    const need = Math.min(5, fit);
    if (valid < need) out.push({ code: 'lineup.incomplete', details: { have: valid, need } });
    // No captain blocker (D-S): a missing captain is named automatically at kickoff (week.ts autoCaptain).
  }
  return out;
}

/** A club's roster, sorted by lineup slot, then rating descending (when content is given), then id. */
export function roster(ports: GamePorts, state: GameState, clubId: ClubId, content?: ContentDB): Fighter[] {
  const club = getOwn(state.clubs, clubId);
  const slot = new Map<string, number>();
  club?.lineup.fighters.forEach((e, i) => slot.set(e.fighterId, i));
  const ratings = new Map<string, number>();
  const ratingOf = (f: Fighter): number => {
    if (!content) return 0;
    let r = ratings.get(f.id);
    if (r === undefined) ratings.set(f.id, (r = ports.fighters.rating(f, content)));
    return r;
  };
  return rosterOf(state, clubId).sort((a, b) => {
    const sa = slot.get(a.id) ?? 99;
    const sb = slot.get(b.id) ?? 99;
    return sa - sb || ratingOf(b) - ratingOf(a) || compareIds(a.id, b.id);
  });
}

/** Free agents visible on the market screen, best market wage first (when content is given), then id. */
export function freeAgents(ports: GamePorts, state: GameState, content?: ContentDB): Fighter[] {
  const list = [...freeAgentList(state)];
  const wage = new Map<string, number>();
  if (content) for (const f of list) wage.set(f.id, ports.economy.marketWage(state, f.id, content));
  return list.sort((a, b) => (wage.get(b.id) ?? 0) - (wage.get(a.id) ?? 0) || compareIds(a.id, b.id));
}

export function fighterView(ports: GamePorts, state: GameState, fighterId: FighterId, content: ContentDB): FighterView {
  const f = getOwn(state.fighters, fighterId);
  if (!f) throw new RangeError(`fighterView: unknown fighter "${fighterId}"`);
  const p = ports.fighters;
  const clubForCq = f.clubId ?? state.playerClubId;
  const cap = clubForCq !== null ? p.captaincy(state, f.id, clubForCq, content) : null;
  const player = state.playerClubId;
  let askFromPlayer: Gold | null = null;
  const renewal = player !== null && f.clubId === player && f.contract !== null && f.contract.endSeason === state.calendar.season;
  if (player !== null && (f.status === 'free-agent' || renewal)) {
    let best = Number.POSITIVE_INFINITY;
    for (const L of content.economy.contracts.lengthsSeasons) best = Math.min(best, ports.economy.ask(state, f.id, player, L, content));
    askFromPlayer = Number.isFinite(best) ? best : null;
  }
  const human100 = p.humanAge100(f, content);
  return {
    fighter: f,
    stats: p.effectiveStats(f, content),
    rating: p.rating(f, content),
    potential: p.potential(f, content),
    // Display value in tenths of a year (03 §1: floor(age × 800 / lifespan) / 10).
    humanAge: Math.trunc(human100 / 10) / 10,
    captaincy: cap ? { cq: cap.cq, gradeId: cap.grade.id, letter: cap.grade.letter } : { cq: 0, gradeId: '', letter: '' },
    trend: p.trend(f, content),
    injuryChanceBp: p.injuryChanceBp(f, content),
    retirementChanceBp: p.retirementChanceBp(state, f.id, content),
    marketWage: ports.economy.marketWage(state, f.id, content),
    askFromPlayer,
    available: f.status === 'active' && p.isFit(f),
  };
}

/** The lineup the AI would pick for a club (player "auto-pick" button) as a ready command. */
export function suggestLineup(ports: GamePorts, state: GameState, clubId: ClubId, content: ContentDB): Command {
  const choice = ports.ai.chooseLineup(state, clubId, content);
  return { type: 'lineup.set', clubId, fighters: choice.fighters, matchCaptainId: choice.matchCaptainId };
}

/** Release preview for the confirmation dialog (D-M): payout now, balance after, and whether it is a cap-relief release. */
export interface ReleasePreview {
  fighterId: FighterId;
  payout: Gold;
  balanceAfter: Gold;
  capRelief: boolean;
  /** The fighter is the club captain or vice-captain (an interim captain is named on release). */
  holdsCaptaincy: boolean;
}

export function releasePreview(ports: GamePorts, state: GameState, clubId: ClubId, fighterId: FighterId, content: ContentDB): ReleasePreview | null {
  const club = getOwn(state.clubs, clubId);
  if (!club || onRoster(state, clubId, fighterId) === null) return null;
  const payout = ports.economy.releasePayout(state, clubId, fighterId, content);
  return {
    fighterId,
    payout,
    balanceAfter: club.finance.balance - payout,
    capRelief: ports.economy.capReliefAllowance(state, clubId, content) > 0,
    holdsCaptaincy: club.captainId === fighterId || club.viceCaptainId === fighterId,
  };
}

/** One side of the captaincy preview. */
export interface CaptaincyPick {
  fighterId: FighterId;
  cq: number;
  gradeId: string;
  letter: string;
}

/**
 * Captaincy-change preview for the captaincy screen: the proposed captain and
 * vice with their CQ and grade, what the change does at the next lineup lock
 * (measured against the captain at the last lock, so switching back is free,
 * cap-003), and lineup chemistry of the current lineup with the current and
 * the proposed club captain (status effects of the change not included).
 */
export interface CaptaincyPreview {
  captain: CaptaincyPick | null;
  vice: CaptaincyPick | null;
  /** The previous captain who will be Snubbed at the next lock, if any. */
  snubbedId: FighterId | null;
  /** Why the previous captain is spared, when the captaincy changes hands and he is not Snubbed. */
  snubExemption: SnubExemption | null;
  /** Club-mates who will be Passed Over. */
  passedOverIds: FighterId[];
  chemistryBefore: number;
  chemistryAfter: number;
}

export function captaincyPreview(
  ports: GamePorts,
  state: GameState,
  clubId: ClubId,
  captainId: FighterId | null,
  viceCaptainId: FighterId | null,
  content: ContentDB,
): CaptaincyPreview | null {
  const club = getOwn(state.clubs, clubId);
  if (!club) return null;
  for (const id of [captainId, viceCaptainId]) if (id !== null && onRoster(state, clubId, id) === null) return null;
  const pick = (id: FighterId | null): CaptaincyPick | null => {
    if (id === null) return null;
    const c = ports.fighters.captaincy(state, id, clubId, content);
    return { fighterId: id, cq: c.cq, gradeId: c.grade.id, letter: c.grade.letter };
  };
  const consequences = ports.fighters.captainChangeConsequences(state, clubId, club.captainAtLastLock, captainId, viceCaptainId, club.captainSince, content);
  const lineup = club.lineup.fighters.map((e) => e.fighterId);
  return {
    captain: pick(captainId),
    vice: pick(viceCaptainId),
    snubbedId: consequences.snubbedId,
    snubExemption: consequences.snubExemption,
    passedOverIds: [...consequences.passedOverIds],
    chemistryBefore: lineup.length > 0 ? ports.fighters.lineupChemistry(state, clubId, lineup, club.captainId, content) : 0,
    chemistryAfter: lineup.length > 0 ? ports.fighters.lineupChemistry(state, clubId, lineup, captainId, content) : 0,
  };
}
