/**
 * Command validation and application (P-04: one rulebook for the player and
 * AI clubs). applyToDraft validates every game-owned rule BEFORE it writes,
 * then delegates market and contract rules to core/economy, which validates
 * its own (05 §3.2). Error codes are stable; the UI maps them to text.
 */
import { TRAINING_EMPHASES, type ContentDB } from '../content';
import type { ClubId, Command, Fighter, FighterId, GameState, LineupEntry, OfferResponse } from '../model';
import { ok, type EngineError, type Result } from '../util';
import type { GamePorts } from './ports';
import { defaultTactics, fail, onRoster, rosterOf, tidyClub } from './shared';

/** Commands allowed while the season-end step is pending (no club decisions then). */
const SEASON_END_ALLOWED: ReadonlySet<Command['type']> = new Set(['news.markRead', 'shortlist.toggle', 'club.choose']);

function clubCheck(state: GameState, clubId: ClubId): EngineError | null {
  return state.clubs[clubId] ? null : { code: 'club.unknown', message: `Unknown club "${clubId}"`, details: { clubId } };
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
  if (cmd.type !== 'club.choose' && cmd.type !== 'news.markRead') {
    const e = clubCheck(draft, cmd.clubId);
    if (e) return { ok: false, error: e };
  }

  switch (cmd.type) {
    case 'club.choose': {
      if (draft.playerClubId !== null) return fail('club.already-chosen', 'A club has already been chosen for this career');
      const e = clubCheck(draft, cmd.clubId);
      if (e) return { ok: false, error: e };
      draft.playerClubId = cmd.clubId;
      return ok(null);
    }

    case 'lineup.set': {
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
      club.lineup.fighters = cmd.fighters.map((e): LineupEntry => ({ fighterId: e.fighterId, row: e.row }));
      club.lineup.matchCaptainId = cmd.matchCaptainId;
      for (const e of cmd.fighters) {
        if (!club.lineup.tactics[e.fighterId]) club.lineup.tactics[e.fighterId] = defaultTactics(content, draft.fighters[e.fighterId]!);
      }
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
        return fail('captaincy.same-fighter', 'Choose a different vice-captain', { fighterId: cmd.captainId });
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
      const f = draft.fighters[cmd.fighterId];
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
      if (!draft.fighters[cmd.fighterId]) return fail('shortlist.unknown-fighter', `Unknown fighter "${cmd.fighterId}"`);
      const list = draft.clubs[cmd.clubId]!.shortlist;
      const i = list.indexOf(cmd.fighterId);
      if (i >= 0) list.splice(i, 1);
      else list.push(cmd.fighterId);
      return ok(null);
    }

    case 'news.markRead': {
      const wanted = new Set<string>(cmd.newsIds);
      let found = 0;
      for (const n of draft.news) {
        if (wanted.has(n.id)) {
          found++;
          n.read = true;
        }
      }
      if (found !== wanted.size) return fail('news.unknown', 'Some news items do not exist', { requested: wanted.size, found });
      return ok(null);
    }
  }
}

function checkTerms(content: ContentDB, wage: number, seasons: number): { ok: false; error: EngineError } | null {
  if (!Number.isSafeInteger(wage) || wage <= 0) return fail('offer.wage', `Wage must be a positive whole number (got ${wage})`);
  if (!content.economy.contracts.lengthsSeasons.includes(seasons)) {
    return fail('offer.length', `Contract length must be one of ${content.economy.contracts.lengthsSeasons.join(', ')} seasons`, { seasons });
  }
  return null;
}
