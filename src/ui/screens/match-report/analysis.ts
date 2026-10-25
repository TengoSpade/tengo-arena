/**
 * Report reading for ui-report (04 §6.3; 03 sys-match-report): who is "us",
 * the one-sentence summary, the "What decided it" traces, the key-moment
 * timeline, the death summaries and the event-log text. Pure functions over
 * the MatchReport view and the stored MatchResult; they choose what to show
 * and phrase causes, they never change or forecast results (P-13).
 */
import type { ContentDB } from '../../../core/content';
import type {
  ClubId,
  FighterId,
  FighterRecap,
  FixtureId,
  GameState,
  MatchReport,
  MatchResult,
  ReportEvent,
  StartingRow,
  TacticsAssignment,
} from '../../../core/model';
import { clubShort } from '../league/lib/club';
import { fmtInt, fmtTicks } from '../league/lib/format';
import { presetOf } from './rule-sentence';
import { t } from './text';

export type SideKey = 'home' | 'away';

export interface Perspective {
  /** The side the report is told from: the player's, else home. */
  usSide: SideKey;
  /** True when the player's club played this match. */
  involved: boolean;
  usClubId: ClubId;
  themClubId: ClubId;
}

export function perspective(report: MatchReport, playerClubId: ClubId | null): Perspective {
  const involved = playerClubId === report.home.clubId || playerClubId === report.away.clubId;
  const usSide: SideKey = involved && playerClubId === report.away.clubId ? 'away' : 'home';
  return {
    usSide,
    involved,
    usClubId: report[usSide].clubId,
    themClubId: report[usSide === 'home' ? 'away' : 'home'].clubId,
  };
}

export function other(side: SideKey): SideKey {
  return side === 'home' ? 'away' : 'home';
}

export interface FighterInfo {
  id: FighterId;
  side: SideKey;
  us: boolean;
  slot: number;
  /** Unit index in round results (0-4 home, 5-9 away). */
  unit: number;
  row: StartingRow;
  classId: string;
  tactics: TacticsAssignment | undefined;
  isCaptain: boolean;
  hiredBlade: boolean;
  recap: FighterRecap | null;
}

/** Fielded fighters in slot order (home then away), from the stored sim input. */
export function fighterInfos(report: MatchReport, result: MatchResult | null, persp: Perspective): FighterInfo[] {
  const out: FighterInfo[] = [];
  const recapOf = new Map(report.fighters.map((f) => [f.fighterId, f]));
  for (const side of ['home', 'away'] as const) {
    const input = result?.input[side];
    const ids = input ? input.fighters.map((f) => f.fighterId) : report[side].fighterIds;
    ids.forEach((id, slot) => {
      const fin = input?.fighters[slot];
      const recap = recapOf.get(id) ?? null;
      out.push({
        id,
        side,
        us: side === persp.usSide,
        slot,
        unit: (side === 'home' ? 0 : 5) + slot,
        row: fin?.row ?? 'front',
        classId: fin?.classId ?? '',
        tactics: fin?.tactics,
        isCaptain: recap?.isCaptain ?? report[side].captainId === id,
        hiredBlade: Boolean(result?.hiredBladeIds.includes(id)),
        recap,
      });
    });
  }
  return out;
}

/** 04 ui-report MVP contribution: damage + healing + shielding + 250 × downs inflicted. */
export function contribution(recap: FighterRecap): number {
  const s = recap.stats;
  return s.damageDealt + s.healingDone + s.shieldingDone + 250 * s.downsInflicted;
}

function sideTotals(infos: FighterInfo[], side: SideKey) {
  const list = infos.filter((f) => f.side === side && f.recap);
  return {
    downs: list.reduce((s, f) => s + f.recap!.stats.downsInflicted, 0),
    downed: list.reduce((s, f) => s + f.recap!.stats.downsSuffered, 0),
    damage: list.reduce((s, f) => s + f.recap!.stats.damageDealt, 0),
    healing: list.reduce((s, f) => s + f.recap!.stats.healingDone, 0),
  };
}

export function totals(infos: FighterInfo[]) {
  return { home: sideTotals(infos, 'home'), away: sideTotals(infos, 'away') };
}

export function name(state: GameState, id: FighterId | null | undefined, short = false): string {
  if (!id) return '';
  const f = state.fighters[id];
  if (!f) return String(id);
  return short ? f.name.given : f.name.full;
}

export function abilityName(content: ContentDB, id: string | null | undefined): string | null {
  if (!id) return null;
  return content.abilities.get(id)?.name ?? id;
}

/** "rounds 1 and 2", "round 3", "rounds 1, 2 and 3". */
export function roundList(rounds: number[]): string {
  const r = [...rounds].sort((a, b) => a - b);
  if (r.length === 1) return `round ${r[0]}`;
  return `rounds ${r.slice(0, -1).join(', ')} and ${r[r.length - 1]}`;
}

/** Round numbers in which this fighter was the first of its side downed. */
export function firstDownRounds(report: MatchReport, infos: FighterInfo[], fighterId: FighterId): number[] {
  const me = infos.find((f) => f.id === fighterId);
  if (!me) return [];
  const sideIds = new Set(infos.filter((f) => f.side === me.side).map((f) => f.id));
  const rounds: number[] = [];
  for (const round of report.rounds) {
    let first: { tick: number; id: FighterId } | null = null;
    for (const f of infos) {
      if (!sideIds.has(f.id) || !f.recap) continue;
      for (const d of f.recap.downs) if (d.round === round.round && (!first || d.tick < first.tick)) first = { tick: d.tick, id: f.id };
    }
    if (first?.id === fighterId) rounds.push(round.round);
  }
  return rounds;
}

// ---- summary ---------------------------------------------------------------------------------------

export function summary(report: MatchReport, persp: Perspective, infos: FighterInfo[], state: GameState): { title: string; text: string } {
  const tot = totals(infos);
  const us = tot[persp.usSide];
  const them = tot[other(persp.usSide)];
  const winnerSide: SideKey = report.winnerClubId === report.home.clubId ? 'home' : 'away';
  const score = `${report.score[persp.usSide]}–${report.score[other(persp.usSide)]}`;
  let title: string;
  if (!persp.involved) {
    const w = tot[winnerSide];
    const l = tot[other(winnerSide)];
    title = t('why.neutral', {
      club: clubShort(state, report.winnerClubId),
      score: `${report.score[winnerSide]}–${report.score[other(winnerSide)]}`,
      inflicted: w.downs,
      suffered: l.downs,
    });
  } else {
    title = t(report.winnerClubId === persp.usClubId ? 'why.won' : 'why.lost', { score, inflicted: us.downs, suffered: them.downs });
  }
  const parts: string[] = [];
  const capped = report.rounds.find((r) => r.endReason === 'time-limit');
  if (capped && capped.tiebreakStep) parts.push(t('why.timeCap', { n: capped.round, step: t(`tiebreak.${capped.tiebreakStep}`) }));
  const ours = infos.filter((f) => f.us && f.recap).sort((a, b) => contribution(b.recap!) - contribution(a.recap!));
  const best = ours[0];
  if (best?.recap) {
    const s = best.recap.stats;
    parts.push(
      s.healingDone > s.damageDealt
        ? t('why.ledHeal', { name: name(state, best.id), healing: fmtInt(s.healingDone), downs: s.downsInflicted })
        : t('why.led', { name: name(state, best.id), downs: s.downsInflicted, damage: fmtInt(s.damageDealt) }),
    );
  }
  const theirs = infos.filter((f) => !f.us && f.recap).sort((a, b) => contribution(b.recap!) - contribution(a.recap!))[0];
  if (theirs?.recap && persp.involved) {
    parts.push(t('why.theirs', { name: name(state, theirs.id), downs: theirs.recap.stats.downsInflicted, damage: fmtInt(theirs.recap.stats.damageDealt) }));
  }
  return { title, text: parts.join(' ') };
}

// ---- traces ("What decided it") ---------------------------------------------------------------------------

export type Verdict = 'helped' | 'hurt' | 'hurt-us' | 'idle';

export interface Trace {
  fighterId: FighterId;
  verdict: Verdict;
  /** Rule index into the preset (the stance is index === rules.length). */
  ruleIndex: number;
  isStance: boolean;
  fires: number;
  note: string;
}

function topRule(recap: FighterRecap, by: 'fires' | 'committedTicks' = 'fires') {
  const rules = recap.rules.filter((r) => !r.isStance);
  if (rules.length === 0) return recap.rules[recap.rules.length - 1] ?? null;
  return [...rules].sort((a, b) => b[by] - a[by] || a.index - b.index)[0] ?? null;
}

export function ruleLabel(index: number, isStance: boolean, stance: string): string {
  return isStance ? t('trace.stance', { stance }) : `R${index + 1}`;
}

/**
 * 3-5 traces: our biggest contributors' most-used rules (helped), the
 * opponent's top contributor (hurt us), our fighter who fell first most
 * often (hurt), then rules of our starters that never fired.
 */
export function selectTraces(report: MatchReport, infos: FighterInfo[], _persp: Perspective, state: GameState, content: ContentDB): Trace[] {
  const out: Trace[] = [];
  const used = new Set<string>();
  const add = (tr: Trace) => {
    const key = `${tr.fighterId}:${tr.ruleIndex}`;
    if (used.has(key)) return;
    used.add(key);
    out.push(tr);
  };
  const stanceOf = (f: FighterInfo) => {
    const p = presetOf(content, f.tactics);
    return content.vocabulary.stances.find((s) => s.id === p?.stance)?.name ?? '';
  };
  const ours = infos.filter((f) => f.us && f.recap).sort((a, b) => contribution(b.recap!) - contribution(a.recap!));
  for (const f of ours.slice(0, 2)) {
    const r = topRule(f.recap!);
    if (!r || r.fires === 0) continue;
    const s = f.recap!.stats;
    add({
      fighterId: f.id,
      verdict: 'helped',
      ruleIndex: r.index,
      isStance: r.isStance,
      fires: r.fires,
      note: t('trace.helped', {
        downs: s.downsInflicted,
        damage: fmtInt(s.damageDealt),
        healing: fmtInt(s.healingDone),
        rule: ruleLabel(r.index, r.isStance, stanceOf(f)),
        fires: r.fires,
        name: name(state, f.id, true),
      }),
    });
  }
  const theirs = infos.filter((f) => !f.us && f.recap).sort((a, b) => contribution(b.recap!) - contribution(a.recap!))[0];
  if (theirs?.recap) {
    const r = topRule(theirs.recap);
    if (r) {
      add({
        fighterId: theirs.id,
        verdict: 'hurt-us',
        ruleIndex: r.index,
        isStance: r.isStance,
        fires: r.fires,
        note: t('trace.theirs', {
          downs: theirs.recap.stats.downsInflicted,
          damage: fmtInt(theirs.recap.stats.damageDealt),
          rule: ruleLabel(r.index, r.isStance, stanceOf(theirs)),
          fires: r.fires,
        }),
      });
    }
  }
  // Our fighter who fell first in the most rounds (at least two).
  const firsts = infos
    .filter((f) => f.us && f.recap)
    .map((f) => ({ f, rounds: firstDownRounds(report, infos, f.id) }))
    .filter((x) => x.rounds.length >= 2)
    .sort((a, b) => b.rounds.length - a.rounds.length || a.f.slot - b.f.slot)[0];
  if (firsts?.f.recap) {
    const r = topRule(firsts.f.recap, 'committedTicks');
    const lastDown = firsts.f.recap.downs[firsts.f.recap.downs.length - 1];
    if (r) {
      add({
        fighterId: firsts.f.id,
        verdict: 'hurt',
        ruleIndex: r.index,
        isStance: r.isStance,
        fires: r.fires,
        note: t('trace.firstDown', {
          rounds: roundList(firsts.rounds),
          by: lastDown?.byFighterId ? t('trace.firstDownBy', { by: name(state, lastDown.byFighterId) }) : '',
          name: name(state, firsts.f.id, true),
        }),
      });
    }
  }
  // Never-fired rules of our starters (P-22 warning), in lineup order.
  for (const f of infos.filter((x) => x.us && x.recap)) {
    if (out.length >= 5) break;
    const never = f.recap!.rules.find((r) => r.neverFired && !r.isStance);
    if (!never) continue;
    add({
      fighterId: f.id,
      verdict: 'idle',
      ruleIndex: never.index,
      isStance: false,
      fires: 0,
      note: t('trace.idle', { rounds: f.recap!.stats.roundsPlayed }),
    });
  }
  return out.slice(0, 5);
}

// ---- key moments ------------------------------------------------------------------------------------------

export type MomentEvent = 'down' | 'injury' | 'rule' | 'save' | 'end';

export interface Moment {
  key: string;
  round: number;
  tick: number;
  /** Who benefited: data-side (us / them), or null for neutral markers. */
  side: 'us' | 'them' | null;
  event: MomentEvent;
  title: string;
  text: string;
  /** Fighter to highlight in the box score and recaps. */
  focusId: FighterId | null;
}

export function sideOfFighter(infos: FighterInfo[], id: FighterId | null): SideKey | null {
  if (!id) return null;
  return infos.find((f) => f.id === id)?.side ?? null;
}

function momentFor(e: ReportEvent, round: number, i: number, infos: FighterInfo[], persp: Perspective, state: GameState, content: ContentDB, injured: Set<string>): Moment {
  const actorSide = sideOfFighter(infos, e.actorId);
  const targetSide = sideOfFighter(infos, e.targetId);
  const benefit: SideKey | null = actorSide ?? (targetSide ? other(targetSide) : null);
  const side: Moment['side'] = benefit ? (benefit === persp.usSide ? 'us' : 'them') : null;
  const ability = abilityName(content, e.abilityId);
  const base = { key: `${round}-${i}-${e.kind}`, round, tick: e.tick, side };
  switch (e.kind) {
    case 'down':
    case 'captain_down': {
      const target = name(state, e.targetId);
      const actor = name(state, e.actorId, true);
      const hurtUs = targetSide === persp.usSide && persp.involved;
      const inj = e.targetId ? injured.has(`${e.targetId}:${round}`) : false;
      let title: string;
      if (e.kind === 'captain_down') title = inj ? t('ev.captainDownInjured', { target }) : t('ev.captainDown', { target });
      else if (inj) title = t('ev.downInjured', { target });
      else if (!e.actorId) title = t('ev.downed', { target });
      else title = hurtUs ? t('ev.downedBy', { target, actor: name(state, e.actorId) }) : t('ev.downs', { actor, target });
      const hit = e.amount != null ? fmtInt(e.amount) : '?';
      const text =
        e.kind === 'captain_down'
          ? t('ev.captainDownText', { by: e.actorId ? `${name(state, e.actorId)}${ability ? ` (${ability})` : ''} · ` : '' })
          : ability
            ? t('ev.downText', { ability, hit })
            : t('ev.downTextNoAbility', { hit });
      return { ...base, event: inj ? 'injury' : 'down', title, text, focusId: e.targetId };
    }
    case 'interrupt':
      return {
        ...base,
        event: 'rule',
        title: t('ev.interrupt', { actor: name(state, e.actorId, true), target: name(state, e.targetId) }),
        text: t('ev.interruptText', { ability: ability ?? '' }),
        focusId: e.actorId,
      };
    case 'deathward':
      return {
        ...base,
        side: targetSide ? (targetSide === persp.usSide ? 'us' : 'them') : side,
        event: 'save',
        title: t('ev.deathward', { target: name(state, e.targetId) }),
        text: t('ev.deathwardText', { actor: [name(state, e.actorId), ability].filter(Boolean).join(' · ') }),
        focusId: e.targetId,
      };
    case 'rally':
      return { ...base, event: 'rule', title: t('ev.rally', { actor: name(state, e.actorId, true) }), text: t('ev.rallyText'), focusId: e.actorId };
    case 'handover':
      return { ...base, event: 'rule', title: t('ev.handover', { actor: name(state, e.actorId, true) }), text: t('ev.handoverText'), focusId: e.actorId };
    case 'overtime':
      return {
        ...base,
        side: null,
        event: 'end',
        title: t('ev.overtime'),
        text: t('ev.overtimeText', { cap: content.combat.overtime.hardCapS }),
        focusId: null,
      };
  }
}

/** Key moments grouped by round, each round closed by its end marker. */
export function moments(report: MatchReport, result: MatchResult | null, infos: FighterInfo[], persp: Perspective, state: GameState, content: ContentDB): Map<number, Moment[]> {
  const injured = new Set<string>();
  for (const f of Object.values(state.fighters)) {
    if (f.injury?.fixtureId === report.fixtureId && f.injury.round != null) injured.add(`${f.id}:${f.injury.round}`);
  }
  const out = new Map<number, Moment[]>();
  let hw = 0;
  let aw = 0;
  report.rounds.forEach((round) => {
    const list = round.keyEvents.map((e, i) => momentFor(e, round.round, i, infos, persp, state, content, injured));
    if (round.winner === 'home') hw++;
    else aw++;
    const rr = result?.rounds.find((x) => x.round === round.round);
    const standing = rr ? rr.survivors[round.winner] : null;
    const usWon = round.winner === persp.usSide;
    const last = round.round === report.rounds.length;
    const score = `${persp.usSide === 'home' ? hw : aw}–${persp.usSide === 'home' ? aw : hw}`;
    let title: string;
    if (last && persp.involved) title = t(usWon ? 'ev.matchWon' : 'ev.matchLost', { score });
    else if (!persp.involved) title = t('ev.roundNeutral', { club: clubShort(state, report[round.winner].clubId), n: standing ?? '?' });
    else title = usWon ? t('ev.roundWon', { n: standing ?? '?' }) : t('ev.roundLost', { n: standing ?? '?' });
    const text =
      round.endReason === 'time-limit' && round.tiebreakStep
        ? t('ev.roundCap', { step: t(`tiebreak.${round.tiebreakStep}`) })
        : last && persp.involved
          ? t(usWon ? 'ev.roundWon' : 'ev.roundLost', { n: standing ?? '?' })
          : '';
    list.push({
      key: `${round.round}-end`,
      round: round.round,
      tick: round.durationTicks,
      side: round.winner === persp.usSide ? 'us' : 'them',
      event: 'end',
      title,
      text,
      focusId: null,
    });
    out.set(round.round, list);
  });
  return out;
}

// ---- death summaries ---------------------------------------------------------------------------------------

export interface DownSummary {
  key: string;
  round: number;
  tick: number;
  fighterId: FighterId;
  side: SideKey;
  byId: FighterId | null;
  ability: string | null;
  hit: number;
  overkill: number;
  takenRound: number;
  maxHp: number;
}

export function downSummaries(infos: FighterInfo[], content: ContentDB): DownSummary[] {
  const out: DownSummary[] = [];
  for (const f of infos) {
    for (const d of f.recap?.stats.downs ?? []) {
      out.push({
        key: `${f.id}-${d.round}-${d.tick}`,
        round: d.round,
        tick: d.tick,
        fighterId: f.id,
        side: f.side,
        byId: d.byFighterId,
        ability: abilityName(content, d.abilityId),
        hit: d.hit,
        overkill: d.overkill,
        takenRound: d.damageTakenRound,
        maxHp: d.maxHp,
      });
    }
  }
  return out.sort((a, b) => a.round - b.round || a.tick - b.tick || (a.side === b.side ? 0 : a.side === 'home' ? -1 : 1));
}

// ---- navigation and export ------------------------------------------------------------------------------------

/** Previous / next played report: the player's club's matches this season, else the same competition's. */
export function adjacentReports(state: GameState, fixtureId: FixtureId): { prev: FixtureId | null; next: FixtureId | null } {
  const fixture = state.fixtures[fixtureId];
  if (!fixture) return { prev: null, next: null };
  const me = state.playerClubId;
  const involved = me === fixture.homeClubId || me === fixture.awayClubId;
  const list = Object.values(state.fixtures)
    .filter((f) => state.results[f.id] && f.season === fixture.season)
    .filter((f) => (involved ? f.homeClubId === me || f.awayClubId === me : f.competitionId === fixture.competitionId))
    .sort((a, b) => a.weekIndex - b.weekIndex || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((f) => f.id);
  const i = list.indexOf(fixtureId);
  return { prev: i > 0 ? list[i - 1]! : null, next: i >= 0 && i < list.length - 1 ? list[i + 1]! : null };
}

/** Plain-text event log: one line per key moment, for sharing and bug reports. */
export function eventLogText(report: MatchReport, all: Map<number, Moment[]>, state: GameState, tickMs: number): string {
  const lines = [`${clubShort(state, report.home.clubId)} ${report.score.home}–${report.score.away} ${clubShort(state, report.away.clubId)} · ${report.weekId} · season ${report.season} · ${report.fixtureId}`];
  for (const [round, list] of all) {
    for (const m of list) lines.push(`R${round} ${fmtTicks(m.tick, tickMs)} ${m.event}: ${m.title}${m.text ? ` (${m.text})` : ''}`);
  }
  return lines.join('\n');
}
