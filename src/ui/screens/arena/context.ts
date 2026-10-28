/**
 * What the viewer shows besides the log (05-technical-m2 §A5 ArenaRoundContext), built from a core/game playback view,
 * the committed state and the content. Round HEADER data only: who the ten units are, their sides, colours and
 * Freshness at the round start. It never reads a log's events, so for a live round it cannot leak what comes later.
 */
import type { ContentDB, RuleDef } from '../../../core/content';
import type { MatchPlayback, RoundPlayback } from '../../../core/game';
import type { FightFighterInput, GameState, Side, TacticsAssignment } from '../../../core/model';
import { colorsForMatch, type ArenaPalette, type ArenaRoundContext, type ArenaSideInfo, type ArenaUnitInfo, type RoleId, type TeamColors } from '../../../render';
import { safeView } from '../../store/engine';
import { labelFor } from '../../m11/model';
import type { HudInfo, HudSide, PipState } from './Hud';
import { cssColorToNumber } from './palette';

const ROLE_IDS: readonly string[] = ['tank', 'melee', 'ranged', 'controller', 'healer'];

/** The fight input a fighter played this match with (lock time): the live match first, then the stored result. */
export function fightInputOf(state: GameState, fixtureId: string, fighterId: string): FightFighterInput | null {
  const ms = state.liveMatch;
  if (ms && ms.fixtureId === fixtureId) {
    const f = ms.inputsById[fighterId as keyof typeof ms.inputsById];
    if (f) return f;
  }
  const r = state.results[fixtureId as keyof typeof state.results];
  if (!r) return null;
  for (const side of [r.input.home, r.input.away]) {
    const f = side.fighters.find((x) => x.fighterId === fighterId);
    if (f) return f;
  }
  for (const list of [r.reserveInputs?.home, r.reserveInputs?.away]) {
    const f = list?.find((x) => x.fighterId === fighterId);
    if (f) return f;
  }
  return null;
}

/** The preset a tactics assignment names (M1: presets only; custom lists arrive with M3). */
export function presetOfTactics(content: ContentDB, tactics: TacticsAssignment | undefined): { name: string; stance: string; rules: readonly RuleDef[] } | null {
  if (!tactics || tactics.kind !== 'preset') return null;
  const p = content.presets.get(tactics.presetId);
  return p ? { name: p.name, stance: p.stance, rules: p.rules } : null;
}

/** A club's two colours as numbers; mid grey when a stored colour cannot be parsed. */
function clubColors(c: { primary: string; secondary: string } | undefined): { primary: number; secondary: number } {
  return { primary: cssColorToNumber(c?.primary ?? '') ?? 0x808080, secondary: cssColorToNumber(c?.secondary ?? '') ?? 0xe0e0e0 };
}

/** Side colours when src/render's colorsForMatch is not available yet (a stub): the player's ring brass, the other's steel; double ring for them. */
function fallbackColors(home: { primary: number; secondary: number }, away: { primary: number; secondary: number }, playerSide: Side | null, palette: ArenaPalette): readonly [TeamColors, TeamColors] {
  const mk = (c: { primary: number; secondary: number }, side: Side): TeamColors => ({
    primary: c.primary,
    secondary: c.secondary,
    ring: playerSide === null ? c.primary : side === playerSide ? palette.sideUs : palette.sideThem,
    ringStyle: playerSide === null || side === playerSide ? 'solid' : 'double',
  });
  return [mk(home, 0), mk(away, 1)];
}

export interface ContextInput {
  state: GameState;
  content: ContentDB;
  playback: RoundPlayback;
  match: MatchPlayback | null;
  palette: ArenaPalette;
  /** Where the viewer starts: the persisted cursor (live resume), a key moment (replay), else 0. */
  startTick: number;
}

export function buildRoundContext(input: ContextInput): ArenaRoundContext {
  const { state, content, playback, match, palette } = input;
  const header = playback.log.header;
  const fixture = state.fixtures[playback.fixtureId as keyof typeof state.fixtures];
  const clubOf = (side: Side) => header.units.find((u) => u.side === side)?.clubId ?? (side === 0 ? fixture?.homeClubId : fixture?.awayClubId) ?? null;
  const homeClubId = clubOf(0);
  const awayClubId = clubOf(1);
  const playerSide: Side | null =
    match?.playerSide === 'home' ? 0 : match?.playerSide === 'away' ? 1 : match ? null : state.playerClubId && state.playerClubId === homeClubId ? 0 : state.playerClubId && state.playerClubId === awayClubId ? 1 : null;
  const homeClub = homeClubId ? state.clubs[homeClubId] : undefined;
  const awayClub = awayClubId ? state.clubs[awayClubId] : undefined;
  const colors = safeView(
    () => colorsForMatch(clubColors(homeClub?.colors), clubColors(awayClub?.colors), playerSide, palette),
    fallbackColors(clubColors(homeClub?.colors), clubColors(awayClub?.colors), playerSide, palette),
  );
  const sideInfo = (club: typeof homeClub, clubId: string | null, c: TeamColors): ArenaSideInfo => ({
    clubId: (clubId ?? '') as ArenaSideInfo['clubId'],
    name: club?.name ?? clubId ?? '',
    shortName: club?.shortName ?? club?.code ?? '',
    colors: c,
  });
  const lineups = playback.lineups;
  const units: ArenaUnitInfo[] = header.units.map((u) => {
    const f = state.fighters[u.fighterId];
    const klass = content.classes.get(u.classId);
    const lu = lineups ? (u.side === 0 ? lineups.home : lineups.away) : null;
    const slot = lu ? lu.fighterIds.indexOf(u.fighterId) : -1;
    const freshness = slot >= 0 && lu ? (lu.freshness[slot] ?? null) : null;
    const label = freshness === null ? null : labelFor(freshness, content).id;
    const tactics = fightInputOf(state, playback.fixtureId, u.fighterId)?.tactics;
    return {
      unit: u.index,
      side: u.side,
      fighterId: u.fighterId,
      name: f?.name.full ?? u.fighterId,
      classId: u.classId,
      className: klass?.name ?? u.classId,
      roles: (klass?.archetypes ?? []).filter((a): a is RoleId => ROLE_IDS.includes(a)),
      raceId: f?.raceId ?? '',
      isHiredBlade: f?.status === 'hired-blade',
      entered: slot >= 0 && lu ? Boolean(lu.entered[slot]) : false,
      freshness,
      fatigueTag: label === 'tired' || label === 'spent' ? label : null,
      ruleCount: presetOfTactics(content, tactics)?.rules.length ?? 0,
    };
  });
  return {
    fixtureId: playback.fixtureId,
    round: playback.round,
    bestOf: match?.bestOf ?? fixture?.bestOf ?? state.liveMatch?.bestOf ?? 3,
    scoreBefore: playback.scoreBefore,
    playerSide,
    sides: [sideInfo(homeClub, homeClubId, colors[0]), sideInfo(awayClub, awayClubId, colors[1])],
    units,
    kind: playback.kind,
    startTick: input.startTick,
  };
}

// ---- the HUD's facts (crests, score, round pips) ------------------------------------------------------------------


/**
 * The top strip's facts. Committed data only: rounds already played (their winners from the match's playback view),
 * the score before this round, the round being watched. A live round's own outcome is never in here.
 */
export function buildHud(args: { state: GameState; ctx: ArenaRoundContext; match: MatchPlayback | null; kind: 'live' | 'replay'; score?: { home: number; away: number } }): HudInfo {
  const { state, ctx, match } = args;
  const side = (i: 0 | 1): HudSide => {
    const info = ctx.sides[i];
    const club = state.clubs[info.clubId];
    return { name: info.name, shortName: info.shortName, code: club?.code ?? info.shortName, primary: club?.colors.primary ?? '#808080', secondary: club?.colors.secondary ?? '#e0e0e0' };
  };
  const score = args.score ?? ctx.scoreBefore;
  const played = (n: number): 'home' | 'away' | null => {
    const r = match?.rounds.find((x) => x.round === n && x.winner !== null);
    if (r?.winner) return r.winner;
    // Without the match view: the score before the round says how many each side won, not in which order.
    const home = ctx.scoreBefore.home;
    return n <= home ? 'home' : n <= ctx.round - 1 ? 'away' : null;
  };
  const pips: PipState[] = Array.from({ length: ctx.bestOf }, (_, i) => {
    const n = i + 1;
    if (n < ctx.round) return played(n) ?? 'later';
    if (n === ctx.round) return 'current';
    return 'later';
  });
  return { sides: [side(0), side(1)], bestOf: ctx.bestOf, round: ctx.round, score, pips, kind: args.kind };
}
