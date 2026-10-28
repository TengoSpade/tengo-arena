/**
 * Command validation and application (P-04: one rulebook for the player and
 * AI clubs). applyToDraft validates every game-owned rule BEFORE it writes,
 * then delegates market and contract rules to core/economy, which validates
 * its own (05 §3.2). Error codes are stable; the UI maps them to text.
 */
import { AUTO_SWAP_MODES, LEVEL_UP_MODES, LEVEL_UP_PACING, PAUSE_BETWEEN_ROUNDS, TRAINING_EMPHASES, clubMatchDefaults, type ContentDB } from '../content';
import type { AutoSwapRules, ClubId, Command, Fighter, FighterId, GameState, LineupEntry, OfferResponse } from '../model';
import { checkSwaps } from './orchestrator';
import { getOwn, ok, type EngineError, type Result } from '../util';
import type { GamePorts } from './ports';
import { defaultTactics, fail, onRoster, rosterOf, tidyClub } from './shared';

/**
 * Commands allowed while the season-end step is pending. Renewals stay open until the expiry
 * step runs: it is still every expiring contract's final season.
 */
const SEASON_END_ALLOWED: ReadonlySet<Command['type']> = new Set([
  'news.markRead',
  'news.setRead',
  'shortlist.toggle',
  'club.choose',
  'contract.renew',
  // M1.1 settings and picks (pending level-ups auto-resolve when the season-end step runs).
  'levelup.choose',
  'levelup.policy',
  'autoswap.set',
  'pacing.set',
]);

/**
 * Commands allowed while the player's match is live (GameState.liveMatch: waiting between rounds, or M2 a round
 * waiting to be watched): the swap itself, the watch cursor (M2), settings and news. Everything that could change a
 * squad, a roster or money waits until the match (and so the week) is over; level-up picks too (levelup.choose, 05
 * M1.1 addendum). None of them changes the next round's input (m2-contracts.test.ts pins that for every entry).
 */
export const LIVE_MATCH_ALLOWED: ReadonlySet<Command['type']> = new Set([
  'match.swap',
  'match.watch',
  'news.markRead',
  'news.setRead',
  'shortlist.toggle',
  'levelup.policy',
  'autoswap.set',
  'pacing.set',
]);

/** The round time cap in fight ticks (combat.json overtime.hardCapS): no cursor lies beyond it. */
function timeCapTicks(content: ContentDB): number {
  return Math.round(content.combat.overtime.hardCapS * content.combat.tick.ticksPerSecond);
}

function clubCheck(state: GameState, clubId: ClubId): EngineError | null {
  return getOwn(state.clubs, clubId) ? null : { code: 'club.unknown', message: `Unknown club "${clubId}"`, details: { clubId } };
}

function rosterFighter(state: GameState, clubId: ClubId, fighterId: FighterId, code: string): Result<Fighter, EngineError> {
  const f = onRoster(state, clubId, fighterId);
  return f ? ok(f) : fail(code, `Fighter "${fighterId}" is not on the roster of "${clubId}"`, { clubId, fighterId });
}

/**
 * Validate and apply one command to a draft. On err, game-owned fields are
 * untouched; economy functions are expected to validate before they write
 * (core/economy contract), so a refused market command changes nothing.
 */
export function applyToDraft(ports: GamePorts, draft: GameState, cmd: Command, content: ContentDB): Result<OfferResponse | null, EngineError> {
  if (draft.calendar.phase === 'season-end' && !SEASON_END_ALLOWED.has(cmd.type)) {
    return fail('phase.season-end', 'Club decisions wait until the season-end step has run');
  }
  if (draft.liveMatch !== null && !LIVE_MATCH_ALLOWED.has(cmd.type)) {
    if (cmd.type === 'levelup.choose') return fail('levelup.match-in-progress', 'Level-up picks wait until the match is over');
    return fail('match.in-progress', 'Club decisions wait until the match in progress is over', { fixtureId: draft.liveMatch.fixtureId });
  }
  if (cmd.type !== 'club.choose' && cmd.type !== 'news.markRead' && cmd.type !== 'news.setRead') {
    const e = clubCheck(draft, cmd.clubId);
    if (e) return { ok: false, error: e };
  }

  switch (cmd.type) {
    case 'club.choose': {
      if (draft.playerClubId !== null) return fail('club.already-chosen', 'A club has already been chosen for this career');
      const e = clubCheck(draft, cmd.clubId);
      if (e) return { ok: false, error: e };
      draft.playerClubId = cmd.clubId;
      // M1.1: the player's club asks about level-ups and pauses between rounds (AI clubs auto-pick).
      Object.assign(draft.clubs[cmd.clubId]!, clubMatchDefaults(content, { player: true }));
      // The player makes the club's own market decisions (as after every season end, where the AI phase
      // skips the player's club): the AI's opening offers made for it at world creation are withdrawn.
      for (const o of draft.market.offers.filter((x) => x.clubId === cmd.clubId)) ports.economy.withdrawOffer(draft, o.clubId, o.fighterId);
      return ok(null);
    }

    case 'lineup.set':
    case 'squad.set': {
      if (cmd.fighters.length > 5) return fail('lineup.size', `A lineup has at most 5 fighters (got ${cmd.fighters.length})`);
      const seen = new Set<string>();
      for (const e of cmd.fighters) {
        if (seen.has(e.fighterId)) return fail('lineup.duplicate', `Fighter "${e.fighterId}" is named twice`, { fighterId: e.fighterId });
        seen.add(e.fighterId);
        if (e.row !== 'front' && e.row !== 'back') return fail('lineup.row', `Invalid row "${String(e.row)}"`, { fighterId: e.fighterId });
        const f = rosterFighter(draft, cmd.clubId, e.fighterId, 'lineup.not-on-roster');
        if (!f.ok) return f;
      }
      if (cmd.matchCaptainId !== null && !seen.has(cmd.matchCaptainId)) {
        return fail('lineup.captain-not-fielded', 'The match captain must be in the lineup', { fighterId: cmd.matchCaptainId });
      }
      const club = draft.clubs[cmd.clubId]!;
      let reserves = club.lineup.reserves.filter((id) => !seen.has(id));
      if (cmd.type === 'squad.set') {
        const max = content.combat.match.squad.reservesMax;
        if (cmd.reserves.length > max) return fail('squad.reserves-size', `A squad has at most ${max} reserves (got ${cmd.reserves.length})`);
        for (const id of cmd.reserves) {
          if (seen.has(id)) return fail('squad.duplicate', `Fighter "${id}" is named twice`, { fighterId: id });
          seen.add(id);
          const f = rosterFighter(draft, cmd.clubId, id, 'squad.not-on-roster');
          if (!f.ok) return f;
          if (!ports.fighters.isFit(f.value)) return fail('squad.reserve-unfit', `Reserve "${id}" is not fit`, { fighterId: id });
        }
        reserves = [...cmd.reserves];
      }
      club.lineup.fighters = cmd.fighters.map((e): LineupEntry => ({ fighterId: e.fighterId, row: e.row }));
      club.lineup.reserves = reserves;
      club.lineup.matchCaptainId = cmd.matchCaptainId;
      for (const id of [...cmd.fighters.map((e) => e.fighterId), ...reserves]) {
        if (!club.lineup.tactics[id]) club.lineup.tactics[id] = defaultTactics(content, draft.fighters[id]!);
      }
      return ok(null);
    }

    // ---- M1.1 ----------------------------------------------------------------------------------------
    case 'levelup.choose': {
      if (draft.liveMatch !== null) return fail('levelup.match-in-progress', 'Level-up picks wait until the match is over');
      const f = rosterFighter(draft, cmd.clubId, cmd.fighterId, 'levelup.not-on-roster');
      if (!f.ok) return f;
      if (!f.value.pendingLevelUps.some((p) => p.level === cmd.level)) {
        return fail('levelup.unknown', `No pending level-up ${cmd.level} for "${cmd.fighterId}"`, { fighterId: cmd.fighterId, level: cmd.level });
      }
      const r = ports.fighters.resolveLevelUp(draft, cmd.fighterId, cmd.level, { optionIndex: cmd.optionIndex, traitIndex: cmd.traitIndex }, 'player', content);
      return r.ok ? ok(null) : r;
    }

    case 'levelup.policy': {
      if (!(cmd.mode === 'inherit' || (LEVEL_UP_MODES as readonly string[]).includes(cmd.mode))) return fail('levelup.mode', `Unknown level-up mode "${String(cmd.mode)}"`);
      if (cmd.fighterId === null) {
        if (cmd.mode === 'inherit') return fail('levelup.mode', 'The club default cannot be "inherit"');
        draft.clubs[cmd.clubId]!.levelUpDefault = cmd.mode;
        return ok(null);
      }
      const f = rosterFighter(draft, cmd.clubId, cmd.fighterId, 'levelup.not-on-roster');
      if (!f.ok) return f;
      f.value.levelUpMode = cmd.mode;
      return ok(null);
    }

    case 'match.swap': {
      // Only the player decides swaps (blind decisions): every other club, the AI opponent included, decides by its own
      // auto-swap rules inside the orchestrator and never through a command.
      if (draft.playerClubId === null || cmd.clubId !== draft.playerClubId) {
        return fail('match.not-player-club', `"${cmd.clubId}" is not the player's club: only the player's club takes swap decisions`, { clubId: cmd.clubId });
      }
      const ms = draft.liveMatch;
      if (ms === null || ms.fixtureId !== cmd.fixtureId) return fail('match.not-live', 'That match is not waiting between rounds', { fixtureId: cmd.fixtureId });
      if (ms.phase !== 'between_rounds' || ms.rounds.length !== cmd.afterRound) {
        return fail('match.not-between-rounds', `No between-round step after round ${cmd.afterRound}`, { afterRound: cmd.afterRound });
      }
      const side = ms.home.clubId === cmd.clubId ? 'home' : ms.away.clubId === cmd.clubId ? 'away' : null;
      if (side === null) return fail('match.not-a-side', `"${cmd.clubId}" does not play this match`);
      const check = checkSwaps(ms, side, cmd.swaps, content.combat.match.swaps.maxPerMatch, (id) => {
        const f = draft.fighters[id];
        return !f || !ports.fighters.isFit(f);
      });
      const first = check.rejected[0];
      if (first) return fail(`swap.${first.reason}`, `Swap ${first.decision.out} -> ${first.decision.in} refused: ${first.reason}`, { ...first.decision, reason: first.reason });
      ms.playerDecisions = cmd.swaps.map((d) => ({ ...d }));
      return ok(null);
    }

    // M2 (docs/design/_drafts/05-technical-m2.md §A3, tech-019): the watch cursor and "Simulate the rest". Calls stay
    // refused until the calls package (P-01; staged after M2, Q53).
    case 'match.watch': {
      if (draft.playerClubId === null || cmd.clubId !== draft.playerClubId) {
        return fail('match.not-player-club', `"${cmd.clubId}" is not the player's club: only the player watches his match`, { clubId: cmd.clubId });
      }
      const ms = draft.liveMatch;
      if (ms === null || ms.fixtureId !== cmd.fixtureId) return fail('match.not-live', 'That match is not in progress', { fixtureId: cmd.fixtureId });
      const w = ms.watch;
      if (!w || w.mode !== 'watch') return fail('match.not-watching', 'That match is simulated, not watched', { fixtureId: cmd.fixtureId });
      if (cmd.mode !== undefined && cmd.mode !== 'watch' && cmd.mode !== 'simulate') return fail('watch.mode', `Unknown mode "${String(cmd.mode)}"`);
      const cap = timeCapTicks(content);
      if (!Number.isSafeInteger(cmd.tick) || cmd.tick < 0 || cmd.tick > cap) return fail('watch.tick', `The cursor must be a fight tick from 0 to ${cap} (got ${String(cmd.tick)})`, { tick: cmd.tick, cap });
      // The round on screen: the watched round, or between rounds the round about to start (only "Simulate the rest" applies there).
      const round = w.round ?? ms.rounds.length + 1;
      if (cmd.round !== round) return fail('watch.round', `Round ${round} is the round in progress, not round ${cmd.round}`, { round, requested: cmd.round });
      if (cmd.mode === 'simulate') {
        // "Simulate the rest": the pending round is committed from its locked inputs (with its calls) by the next advance,
        // the later rounds are simulated; Watch never comes back within the match. The cursor is moot from here.
        ms.watch = { mode: 'simulate', round: null, cursorTick: Math.max(w.cursorTick, cmd.tick), calls: w.calls };
        return ok(null);
      }
      if (w.round === null) return fail('match.not-watching', 'No round is being watched: the match waits between rounds', { fixtureId: cmd.fixtureId });
      // The reveal frontier only moves forward (LiveWatch.cursorTick); a lower tick is a stale stop.
      if (cmd.tick < w.cursorTick) return fail('watch.tick', `The cursor only moves forward (at ${w.cursorTick}, got ${cmd.tick})`, { tick: cmd.tick, cursorTick: w.cursorTick });
      ms.watch = { ...w, cursorTick: cmd.tick };
      return ok(null);
    }
    case 'match.call':
      return fail('match.calls-unavailable', 'Calls are not part of this build (P-01; staged after M2, owner answer to Q53)', { fixtureId: cmd.fixtureId });

    case 'autoswap.set': {
      const e = autoSwapRulesError(cmd.rules);
      if (e) return fail('autoswap.rules', e);
      draft.clubs[cmd.clubId]!.autoSwap = { ...cmd.rules };
      return ok(null);
    }

    case 'pacing.set': {
      if (!(LEVEL_UP_PACING as readonly string[]).includes(cmd.levelUpPacing)) return fail('pacing.level-up', `Unknown pacing "${String(cmd.levelUpPacing)}"`);
      if (!(PAUSE_BETWEEN_ROUNDS as readonly string[]).includes(cmd.pauseBetweenRounds)) return fail('pacing.pause', `Unknown pause rule "${String(cmd.pauseBetweenRounds)}"`);
      const club = draft.clubs[cmd.clubId]!;
      club.levelUpPacing = cmd.levelUpPacing;
      club.pauseBetweenRounds = cmd.pauseBetweenRounds;
      return ok(null);
    }

    case 'tactics.assign': {
      const f = rosterFighter(draft, cmd.clubId, cmd.fighterId, 'tactics.not-on-roster');
      if (!f.ok) return f;
      if (cmd.tactics.kind !== 'preset') return fail('tactics.custom-unavailable', 'Custom rule lists arrive in M3; choose a preset');
      const resolved = ports.tactics.resolveTactics(cmd.tactics, f.value.classId, content);
      if (!resolved.ok) return resolved;
      draft.clubs[cmd.clubId]!.lineup.tactics[cmd.fighterId] = { kind: 'preset', presetId: cmd.tactics.presetId };
      return ok(null);
    }

    case 'captaincy.set': {
      if (cmd.captainId !== null && cmd.captainId === cmd.viceCaptainId) {
        return fail('captaincy.same', 'Choose a different vice-captain', { fighterId: cmd.captainId });
      }
      for (const id of [cmd.captainId, cmd.viceCaptainId]) {
        if (id === null) continue;
        const f = rosterFighter(draft, cmd.clubId, id, 'captaincy.not-on-roster');
        if (!f.ok) return f;
      }
      const club = draft.clubs[cmd.clubId]!;
      club.captainId = cmd.captainId;
      club.viceCaptainId = cmd.viceCaptainId;
      return ok(null);
    }

    case 'training.set': {
      if (!draft.options.trainingEmphasis) return fail('training.disabled', 'Training emphasis is switched off for this career');
      if (!(TRAINING_EMPHASES as readonly string[]).includes(cmd.emphasis)) return fail('training.emphasis', `Unknown emphasis "${cmd.emphasis}"`);
      const f = rosterFighter(draft, cmd.clubId, cmd.fighterId, 'training.not-on-roster');
      if (!f.ok) return f;
      f.value.trainingEmphasis = cmd.emphasis;
      return ok(null);
    }

    case 'offer.make': {
      const f = getOwn(draft.fighters, cmd.fighterId);
      if (!f || f.status !== 'free-agent') return fail('offer.not-free-agent', `Fighter "${cmd.fighterId}" is not a free agent`, { fighterId: cmd.fighterId });
      for (const [owner, ids] of Object.entries(draft.market.trialsRookies)) {
        if (ids.includes(cmd.fighterId)) {
          return fail('offer.trials-rookie', 'This rookie is exclusive to a club on Trials Day', { fighterId: cmd.fighterId, clubId: owner });
        }
      }
      const lengthCheck = checkTerms(content, cmd.wagePerWeek, cmd.seasons);
      if (lengthCheck) return lengthCheck;
      return ports.economy.makeOffer(
        draft,
        { clubId: cmd.clubId, fighterId: cmd.fighterId, wagePerWeek: cmd.wagePerWeek, seasons: cmd.seasons, acceptCounter: cmd.acceptCounter },
        content,
      );
    }

    case 'offer.withdraw': {
      const r = ports.economy.withdrawOffer(draft, cmd.clubId, cmd.fighterId);
      return r.ok ? ok(null) : r;
    }

    case 'contract.renew': {
      const f = rosterFighter(draft, cmd.clubId, cmd.fighterId, 'renew.not-on-roster');
      if (!f.ok) return f;
      const terms = checkTerms(content, cmd.wagePerWeek, cmd.seasons);
      if (terms) return terms;
      return ports.economy.renewContract(draft, { clubId: cmd.clubId, fighterId: cmd.fighterId, wagePerWeek: cmd.wagePerWeek, seasons: cmd.seasons }, content);
    }

    case 'trials.sign': {
      if (!(draft.market.trialsRookies[cmd.clubId] ?? []).includes(cmd.fighterId)) {
        return fail('trials.not-offered', `Fighter "${cmd.fighterId}" is not one of this club's trials rookies`, { fighterId: cmd.fighterId });
      }
      const terms = checkTerms(content, cmd.wagePerWeek, cmd.seasons);
      if (terms) return terms;
      return ports.economy.signTrialsRookie(draft, { clubId: cmd.clubId, fighterId: cmd.fighterId, wagePerWeek: cmd.wagePerWeek, seasons: cmd.seasons }, content);
    }

    case 'roster.release': {
      const f = rosterFighter(draft, cmd.clubId, cmd.fighterId, 'release.not-on-roster');
      if (!f.ok) return f;
      const club = draft.clubs[cmd.clubId]!;
      const cap = content.tiers.require(club.tierId).rosterCap;
      const capRelief = draft.calendar.phase === 'preseason' && rosterOf(draft, cmd.clubId).length > cap;
      const r = ports.economy.releaseFighter(draft, cmd.clubId, cmd.fighterId, content);
      if (!r.ok) return r;
      if (!capRelief) {
        const memory = draft.ai[cmd.clubId] ?? (draft.ai[cmd.clubId] = { voluntaryReleasesThisSeason: 0 });
        memory.voluntaryReleasesThisSeason++;
      }
      tidyClub(ports, draft, cmd.clubId, content);
      return ok(null);
    }

    case 'shortlist.toggle': {
      if (!getOwn(draft.fighters, cmd.fighterId)) return fail('shortlist.unknown-fighter', `Unknown fighter "${cmd.fighterId}"`);
      const list = draft.clubs[cmd.clubId]!.shortlist;
      const i = list.indexOf(cmd.fighterId);
      if (i >= 0) list.splice(i, 1);
      else list.push(cmd.fighterId);
      return ok(null);
    }

    case 'news.markRead':
    case 'news.setRead': {
      const read = cmd.type === 'news.markRead' ? true : cmd.read;
      const wanted = new Set<string>(cmd.newsIds);
      const items = draft.news.filter((n) => wanted.has(n.id));
      if (items.length !== wanted.size) return fail('news.unknown', 'Some news items do not exist', { requested: wanted.size, found: items.length });
      for (const n of items) n.read = read;
      return ok(null);
    }
  }
}

function autoSwapRulesError(r: AutoSwapRules): string | null {
  if (!(AUTO_SWAP_MODES as readonly string[]).includes(r.mode)) return `Unknown auto-swap mode "${String(r.mode)}"`;
  for (const k of ['freshnessBelow', 'reserveMargin', 'maxRatingGap', 'lostRoundBonus'] as const) {
    const v = r[k];
    if (!Number.isSafeInteger(v) || v < 0 || v > 100) return `${k} must be a whole number 0-100 (got ${String(v)})`;
  }
  if (typeof r.keepOneForInjury !== 'boolean' || typeof r.sameRoleFamilyFirst !== 'boolean') return 'keepOneForInjury and sameRoleFamilyFirst are on/off';
  return null;
}

function checkTerms(content: ContentDB, wage: number, seasons: number): { ok: false; error: EngineError } | null {
  if (!Number.isSafeInteger(wage) || wage <= 0) return fail('offer.wage', `Wage must be a positive whole number (got ${wage})`);
  if (!content.economy.contracts.lengthsSeasons.includes(seasons)) {
    return fail('offer.length', `Contract length must be one of ${content.economy.contracts.lengthsSeasons.join(', ')} seasons`, { seasons });
  }
  return null;
}
