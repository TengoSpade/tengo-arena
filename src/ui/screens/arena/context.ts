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
import type { HudInfo, HudSide } from './Hud';
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

// ---- the HUD's facts (crests, rounds won, rows) --------------------------------------------------------------------

/**
 * The top strip's and the fighter strip's facts. Committed data only: the rounds already won, the round being watched,
 * who stands in which row (round header). The player's side is on the left (the mock: "ours left"); a match between
 * other clubs shows home on the left. A live round's own outcome is never in here.
 */
export function buildHud(args: { state: GameState; ctx: ArenaRoundContext; playback: RoundPlayback; kind: 'live' | 'replay'; score?: { home: number; away: number } }): HudInfo {
  const { state, ctx } = args;
  const score = args.score ?? ctx.scoreBefore;
  const mine = (ctx.playerSide ?? 0) as 0 | 1;
  const side = (i: 0 | 1): HudSide => {
    const info = ctx.sides[i];
    const club = state.clubs[info.clubId];
    return {
      name: info.name,
      shortName: info.shortName,
      code: club?.code ?? info.shortName,
      primary: club?.colors.primary ?? '#808080',
      secondary: club?.colors.secondary ?? '#e0e0e0',
      side: i,
      ours: i === mine && ctx.playerSide !== null,
      wins: i === 0 ? score.home : score.away,
    };
  };
  const rows: Record<number, 'front' | 'back'> = {};
  for (const u of args.playback.log.header.units) rows[u.index] = u.row;
  return { left: side(mine), right: side(mine === 0 ? 1 : 0), bestOf: ctx.bestOf, round: ctx.round, kind: args.kind, rows };
}
