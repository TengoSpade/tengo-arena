/**
 * Dev-engine stand-ins for the M1.1 core stubs (WP-D; until WP-B / WP-C merge): the level-up view
 * and resolution, the between-round view, and Continue on a live match. Same shapes as core's
 * contracts (core/game live.ts, orchestrator.ts); simplified rules, documented per function. Used by
 * createDevEngine (tests, dev fixture worlds) through withFallback: the real core wins as soon as it
 * stops throwing NotImplementedError.
 */
import { combatRating, type ContentDB } from '../../core/content';
import type { BetweenRoundSideView, BetweenRoundView, LevelUpView } from '../../core/game';
import type { Fighter, FighterId, GameState, LevelOption, MatchSideState, StatId, SwapDecision } from '../../core/model';
import { cloneJson, engineError, err, ok, type EngineError, type Result } from '../../core/util';

const freshness = (f: Fighter | undefined) => Math.floor(Math.max(0, Math.min(1000, f?.freshness10 ?? 1000)) / 10);

function statsAfter(f: Fighter, option: LevelOption | null): Record<StatId, number> {
  const out = {} as Record<StatId, number>;
  for (const [k, v] of Object.entries(f.train100) as [StatId, number][]) out[k] = Math.max(1, Math.floor(v / 100));
  if (option?.kind === 'stat') out[option.stat] = Math.floor(Math.min(f.cap100[option.stat] ?? 2000, (f.train100[option.stat] ?? 0) + option.gain100) / 100);
  return out;
}

function legal(f: Fighter, option: LevelOption, content: ContentDB): boolean {
  if (option.kind === 'stat') return (f.train100[option.stat] ?? 0) < (f.cap100[option.stat] ?? 0);
  if (option.kind === 'rank') return f.abilityRanks[option.slot] === option.toRank - 1;
  return !f.perkIds.includes(option.perkId) && f.perkIds.length < content.perkRules.perkCap;
}

/** levelUpView stand-in: options with legality, stat and rating after; auto-pick = the first legal option, the first trait. */
export function levelUpViewDev(state: GameState, fighterId: FighterId, content: ContentDB): LevelUpView | null {
  const f = state.fighters[fighterId];
  if (!f || f.pendingLevelUps.length === 0) return null;
  const club = f.clubId ? state.clubs[f.clubId] : undefined;
  const mode = f.levelUpMode !== 'inherit' ? f.levelUpMode : (club?.levelUpDefault ?? 'manual');
  return {
    fighterId,
    mode,
    level: f.level,
    xpIntoLevel: f.xpIntoLevel,
    xpNeeded: f.xpNeeded,
    etaMatches: null,
    pending: f.pendingLevelUps.map((p) => {
      const options = p.options.map((option) => {
        const ok = legal(f, option, content);
        return {
          option,
          legal: ok,
          statAfter: option.kind === 'stat' ? (statsAfter(f, option)[option.stat] ?? null) : null,
          ratingAfter: option.kind === 'stat' ? combatRating(content, f.classId, statsAfter(f, option)) : null,
        };
      });
      const first = options.findIndex((o) => o.legal);
      return { level: p.level, options, traitOffer: p.traitOffer, autoPick: { optionIndex: first >= 0 ? first : null, traitIndex: p.traitOffer ? 0 : null } };
    }),
  };
}

/** levelup.choose stand-in: applies the option (stat +gain, rank, perk), the trait, and logs it. */
export function resolveLevelUpDev(state: GameState, fighterId: FighterId, level: number, optionIndex: number | null, traitIndex: number | null): Result<GameState, EngineError> {
  const next = cloneJson(state);
  const f = next.fighters[fighterId];
  const i = f?.pendingLevelUps.findIndex((p) => p.level === level) ?? -1;
  if (!f || i < 0) return err(engineError('levelup.unknown', 'no such pending level-up'));
  const offer = f.pendingLevelUps[i]!;
  const picked = optionIndex === null ? null : (offer.options[optionIndex] ?? null);
  if (picked?.kind === 'stat') f.train100[picked.stat] = Math.min(f.cap100[picked.stat] ?? 2000, (f.train100[picked.stat] ?? 0) + picked.gain100);
  if (picked?.kind === 'rank') f.abilityRanks[picked.slot] = picked.toRank;
  if (picked?.kind === 'perk') f.perkIds.push(picked.perkId);
  const trait = traitIndex === null || !offer.traitOffer ? null : (offer.traitOffer[traitIndex] ?? null);
  if (trait) f.traits.push({ id: trait, gainedSeason: next.calendar.season, source: 'level' });
  f.pendingLevelUps.splice(i, 1);
  f.season.levelLog.push({ level, season: next.calendar.season, weekIndex: next.calendar.weekIndex, picked, trait, how: 'player' });
  return ok(next);
}

function sideView(state: GameState, side: MatchSideState, content: ContentDB, lastFreshness: Record<string, number> | null, lostLast: boolean): BetweenRoundSideView {
  const rating = (id: FighterId) => {
    const f = state.fighters[id];
    return f ? combatRating(content, f.classId, statsAfter(f, null)) : 0;
  };
  const club = state.clubs[side.clubId];
  const rules = club?.autoSwap;
  const active = side.active.map((fighterId, slot) => {
    const now = freshness(state.fighters[fighterId]);
    return {
      fighterId,
      slot,
      row: side.rows[slot] ?? 'front',
      freshness: now,
      freshnessBefore: lastFreshness?.[fighterId] ?? now,
      damageTaken: 0,
      downed: false,
      injured: side.injured.includes(fighterId),
    };
  });
  const reserves = side.unusedReserves.map((fighterId) => ({ fighterId, freshness: freshness(state.fighters[fighterId]), rating: rating(fighterId), fit: !state.fighters[fighterId]?.injury }));
  const swapsLeft = Math.max(0, content.combat.match.swaps.maxPerMatch - side.swapsUsed);
  const forced = active.filter((a) => a.injured).map((a) => a.fighterId);
  // Threshold rule (combat-skills.md sys-match "Auto-swap"), simplified: lowest first, reserve margin and rating gap.
  const suggestions: SwapDecision[] = [];
  const pool = reserves.filter((r) => r.fit).sort((a, b) => b.rating - a.rating);
  for (const id of forced) {
    const r = pool.shift();
    if (r && suggestions.length < swapsLeft) suggestions.push({ out: id, in: r.fighterId });
  }
  if (rules && rules.mode === 'threshold') {
    const below = rules.freshnessBelow + (lostLast ? rules.lostRoundBonus : 0);
    const keep = rules.keepOneForInjury ? 1 : 0;
    for (const a of [...active].filter((x) => !x.injured && x.freshness < below).sort((x, y) => x.freshness - y.freshness)) {
      if (suggestions.length >= swapsLeft - keep) break;
      const ri = pool.findIndex((r) => r.freshness >= a.freshness + rules.reserveMargin && r.rating >= rating(a.fighterId) - rules.maxRatingGap);
      if (ri < 0) continue;
      suggestions.push({ out: a.fighterId, in: pool[ri]!.fighterId });
      pool.splice(ri, 1);
    }
  }
  return { clubId: side.clubId, active, reserves, withdrawn: [...side.withdrawn], swapsLeft, forced, suggestions };
}

/** betweenRoundView stand-in from the live MatchState (damage and downs are not tracked here: 0). */
export function betweenRoundViewDev(state: GameState, content: ContentDB): BetweenRoundView | null {
  const ms = state.liveMatch;
  if (!ms || ms.phase !== 'between_rounds') return null;
  const last = ms.roundLineups[ms.roundLineups.length - 1];
  const before = (side: 'home' | 'away'): Record<string, number> | null => {
    if (!last) return null;
    const l = last[side];
    return Object.fromEntries(l.fighterIds.map((id, i) => [id, l.freshness[i] ?? 100]));
  };
  const lastRound = ms.rounds[ms.rounds.length - 1];
  const playerSide = ms.home.clubId === state.playerClubId ? 'home' : ms.away.clubId === state.playerClubId ? 'away' : null;
  return {
    fixtureId: ms.fixtureId,
    afterRound: ms.rounds.length,
    nextRound: ms.rounds.length + 1,
    score: { ...ms.score },
    home: sideView(state, ms.home, content, before('home'), lastRound?.winner === 'away'),
    away: sideView(state, ms.away, content, before('away'), lastRound?.winner === 'home'),
    playerSide,
    urgent: false,
  };
}

/**
 * advance stand-in on a live match: apply the player's decisions (else the suggestions) to his side,
 * record them, close the match and process the week with `advanceWeek` (which plays the match the
 * M1 way). Enough for the screens' flow; WP-C's orchestrator replaces it.
 */
export function finishLiveMatchDev(state: GameState, content: ContentDB): GameState {
  const ms = state.liveMatch;
  if (!ms) return state;
  const next = cloneJson(state);
  const view = betweenRoundViewDev(state, content);
  const sideKey = view?.playerSide ?? null;
  if (sideKey && view) {
    const decisions = ms.playerDecisions ?? view[sideKey].suggestions;
    const side = next.liveMatch![sideKey];
    for (const d of decisions) {
      const slot = side.active.indexOf(d.out);
      if (slot < 0 || !side.unusedReserves.includes(d.in)) continue;
      side.active[slot] = d.in;
      side.withdrawn.push(d.out);
      side.unusedReserves = side.unusedReserves.filter((x) => x !== d.in);
      side.swapsUsed++;
    }
  }
  next.liveMatch = null;
  return next;
}
