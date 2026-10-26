/**
 * M1.1 lifecycle (WP-B; docs/design/05 M1.1 addendum §WP-B). Specs:
 * progression.md sys-development (round XP, bench XP, levels, offers,
 * auto-pick, queue), sys-freshness, sys-injury amendment (immediate
 * injuries); combat-skills.md sys-perks / sys-ability-ranks eligibility.
 *
 * Round hooks (core/game playRound, in this order after each round):
 *   freshnessAfterRound  drain of everyone who started the round (Tired / Spent round-start counters)
 *   xpAfterRound         round XP into season XP, round XP and the level bar (committed with the round)
 *   injuriesAfterRound   immediate injury rolls with the Freshness multiplier at the round's start
 * freshnessBetweenRounds (applyBetweenRound): perk gains for active fighters and unused reserves.
 * matchEndProgression: match counters, bench XP, level-ups (at most 2 per match), offers, auto-resolution.
 *
 * Every random draw is keyed (stream, season, week or fixture, round, fighter, level), so the order in
 * which fighters are processed never shifts a result, and reloading never rerolls an offer (P-05).
 */
import { TICKS_PER_SECOND, type ContentDB } from '../content';
import {
  clubRoster,
  idNumber,
  type ClubId,
  type Fighter,
  type FighterId,
  type GameState,
  type LevelOption,
  type LevelUpMode,
  type LevelUpResolution,
  type MatchResult,
  type MatchState,
  type NewsId,
  type PendingLevelUp,
  type ResolvedLevelUp,
  type RoundOutcome,
  type StatId,
  type TraitId,
} from '../model';
import { Rng, STREAM } from '../rng';
import { engineError, err, ok, type EngineError, type Result } from '../util';
import { checkThresholds, gainTrait } from './acquired';
import { isFitFighter } from './captaincy';
import { effectSources, multFactorsBp } from './effects';
import { BP, bp, truncN } from './fixed';
import { freshness10Of, perkBetweenRoundsGain10, rest10, roundDrain10, setFreshness10, typicalDrain10 } from './freshness';
import { PROVISIONAL_TYPICAL_ROUNDS_PER_MATCH_X10, SEVERITY_ORDER, isAtRisk, roundInjuryChanceBp, seriousShareBp, severityWeights, type RoundExposure } from './injury';
import { freshnessLabel, freshnessOf, levelMentorMult, xpNeededFor } from './levels';
import { EVENT_TRAIT_IDS, STILL_TENDER, applyInjury, roundXp, type MatchInjury } from './match';
import { pushNews } from './news';
import { autoPick, generateOffer, offerContextOf, optionLegal, traitEntryEligible, type OfferContext } from './offers';
import { ratingOf } from './stats';
import { addAcquiredTrait } from './traits';

// ---- pure reads ----------------------------------------------------------------------------------

/** Answer to one pending level-up: index into its options (null only for an empty level) and the trait offer (index, or null = neither). */
export interface LevelUpChoice {
  optionIndex: number | null;
  traitIndex: number | null;
}

/** Whether an option is still legal now (stat below cap, rank below 3, perk eligible); illegal options show greyed out. */
export function levelOptionLegal(fighter: Fighter, option: LevelOption, content: ContentDB): boolean {
  return optionLegal(fighter, option, content);
}

/**
 * The policy's pick for an offer (lvl-011, lvl-012): highest score, ties stat before skill, then lower index;
 * never a burden trait. `context` (additive): captain or vice (the perk captain tag and the trait fit) and the
 * fighter's preset; without it the fighter is read as no captain, training on, his class default preset.
 */
export function autoPickChoice(fighter: Fighter, offer: PendingLevelUp, mode: Exclude<LevelUpMode, 'manual'>, content: ContentDB, context: Partial<OfferContext> = {}): LevelUpChoice {
  const ctx: OfferContext = { captainOrVice: false, trainingEnabled: content.development.training.enabled, ...context };
  return autoPick(fighter, offer, mode, content, ctx);
}

/** The fighter's effective policy: his levelUpMode, or the club's levelUpDefault for 'inherit'; free agents and hired blades 'auto'. */
export function effectiveLevelUpMode(state: GameState, fighter: Fighter): LevelUpMode {
  if (fighter.levelUpMode !== 'inherit') return fighter.levelUpMode;
  const club = fighter.clubId === null ? undefined : state.clubs[fighter.clubId];
  return club && fighter.status === 'active' ? club.levelUpDefault : 'auto';
}

/** Typical Freshness drain of one round, tenths (intensity 1.0; young and perk multipliers): UI forecasts and AI rotation. */
export function typicalRoundDrain10(fighter: Fighter, content: ContentDB): number {
  return typicalDrain10(fighter, content);
}

/** Weekly rest gain in tenths for a week with no round started (× squadReserveRestShare for an unused squad reserve). */
export function weeklyRest10(fighter: Fighter, content: ContentDB, wasSquadReserve: boolean): number {
  return rest10(fighter, content, wasSquadReserve);
}

/**
 * PROVISIONAL (OPEN, content request): the default expected match XP before a
 * fighter's first match of the season (levels.json levelEta gives 32 starter /
 * 11 reserve only as text).
 */
export const PROVISIONAL_LEVEL_ETA_DEFAULT_XP = { starter: 32, bench: 11 } as const;

/** "Next level in ≈ N matches" (null when no match XP is expected): ceil(remaining ÷ mean match XP this season; 32 starter / 11 bench before his first match). */
export function levelEtaMatches(fighter: Fighter, content: ContentDB): number | null {
  void content;
  if (fighter.status === 'retired' || fighter.status === 'free-agent' || fighter.status === 'academy') return null;
  const remaining = Math.max(0, fighter.xpNeeded - fighter.xpIntoLevel);
  if (remaining === 0) return 0;
  const s = fighter.season;
  let mean: number;
  if (s.matchesStarted > 0 && s.roundXp > 0) mean = s.roundXp / s.matchesStarted;
  else if (fighter.status === 'hired-blade') mean = PROVISIONAL_LEVEL_ETA_DEFAULT_XP.starter;
  else mean = PROVISIONAL_LEVEL_ETA_DEFAULT_XP.bench;
  return mean > 0 ? Math.ceil(remaining / mean) : null;
}

// ---- round hooks (core/game orchestrator; levels.json hooks) ----------------------------------------

function sortedAftermath(outcome: RoundOutcome): RoundOutcome['aftermath'] {
  return outcome.aftermath.slice().sort((a, b) => idNumber(a.fighterId) - idNumber(b.fighterId) || (a.fighterId < b.fighterId ? -1 : 1));
}

function durationS(outcome: RoundOutcome): number {
  return outcome.result.durationTicks / TICKS_PER_SECOND;
}

/** After each round: drain Freshness of everyone who started it (round intensity, young and perk multipliers); tired/spent counters. */
export function freshnessAfterRound(draft: GameState, ms: MatchState, outcome: RoundOutcome, content: ContentDB): void {
  void ms;
  for (const a of sortedAftermath(outcome)) {
    const f = draft.fighters[a.fighterId];
    if (!f) continue;
    const start10 = freshness10Of(f);
    const label = freshnessLabel(Math.floor(start10 / 10), content);
    if (label === 'spent') f.season.spentRoundStarts += 1;
    else if (label === 'tired') f.season.tiredRoundStarts += 1;
    setFreshness10(f, start10 - roundDrain10(f, { durationS: durationS(outcome), damageTaken: a.damageTaken, maxHp: a.maxHp, downed: a.downed }, content));
  }
}

function isTournament(draft: GameState, ms: MatchState): boolean {
  const stage = draft.fixtures[ms.fixtureId]?.stage;
  return stage !== undefined && stage !== 'league';
}

/** The healed record of a returning fighter is cleared at the first round he starts; a serious one grants Back from the Brink. */
function clearReturningInjury(draft: GameState, f: Fighter, content: ContentDB, news: NewsId[]): void {
  if (!f.injury || f.injury.weeksOut !== 0) return;
  if (f.injury.severity === 'serious' && content.traits.has(EVENT_TRAIT_IDS.backFromBrink)) {
    for (const c of gainTrait(f, EVENT_TRAIT_IDS.backFromBrink, 'event', draft.calendar.season, content, draft.rng.root)) {
      news.push(pushNews(draft, { key: c.change === 'skipped' ? 'fighter.trait_skipped' : `fighter.trait_${c.change}`, clubId: f.clubId, fighterId: f.id, params: { traitId: c.traitId } }));
    }
  }
  f.injury = null;
}

/** After each round: round XP of everyone who started it (×1.25 Reckoning, trait multipliers; floored once per round). */
export function xpAfterRound(draft: GameState, ms: MatchState, outcome: RoundOutcome, content: ContentDB): void {
  const tournament = isTournament(draft, ms);
  const news: NewsId[] = [];
  for (const a of sortedAftermath(outcome)) {
    const f = draft.fighters[a.fighterId];
    if (!f) continue;
    clearReturningInjury(draft, f, content, news);
    const xp = roundXp(f, content, { won: outcome.result.winner === a.side, credits: a.downsInflicted, downed: a.downed }, tournament);
    f.season.xp += xp;
    f.season.roundXp += xp;
    f.xpIntoLevel += xp;
    f.career.xpTotal += xp;
  }
}

/** Freshness 0-100 at the start of this round: the recorded round lineup, else the value before this round's drain. */
function roundStartFreshness(f: Fighter, ms: MatchState, outcome: RoundOutcome, a: RoundOutcome['aftermath'][number], content: ContentDB): number {
  const rl = ms.roundLineups.find((r) => r.round === outcome.result.round);
  const side = rl ? (a.side === 'home' ? rl.home : rl.away) : undefined;
  const i = side ? side.fighterIds.indexOf(f.id) : -1;
  if (side && i >= 0 && side.freshness[i] !== undefined) return side.freshness[i]!;
  // Not recorded yet: freshnessAfterRound has drained him already (hook order), so add this round's drain back.
  const drained = roundDrain10(f, { durationS: durationS(outcome), damageTaken: a.damageTaken, maxHp: a.maxHp, downed: a.downed }, content);
  return Math.floor(Math.min(1000, freshness10Of(f) + drained) / 10);
}

/** After each round: immediate injury rolls (Freshness multiplier from the round start); returns the newly injured, who play no later round. */
export function injuriesAfterRound(draft: GameState, ms: MatchState, outcome: RoundOutcome, content: ContentDB): FighterId[] {
  const injured: FighterId[] = [];
  const sink: { injuries: MatchInjury[] } = { injuries: [] };
  const season = draft.calendar.season;
  const since = { season, weekIndex: draft.calendar.weekIndex };
  const round = outcome.result.round;
  const already = new Set<string>([...ms.home.injured, ...ms.away.injured]);
  for (const a of sortedAftermath(outcome)) {
    const f = draft.fighters[a.fighterId];
    if (!f || f.status === 'retired' || already.has(f.id)) continue;
    // At most one new injury per fighter per match (kept as a rule, although an injured fighter plays no later round).
    if (f.injury && f.injury.fixtureId === ms.fixtureId) continue;
    const tgh = (ms.inputsById[f.id]?.stats as Record<string, number> | undefined)?.[content.development.injury.durability.stat];
    const exposure: RoundExposure = {
      damageRatioBp: a.maxHp > 0 ? truncN((a.damageTaken * BP) / a.maxHp) : 0,
      downed: a.downed,
      freshness: roundStartFreshness(f, ms, outcome, a, content),
    };
    const p = roundInjuryChanceBp(f, content, exposure, tgh);
    const rng = Rng.create(draft.rng.root, STREAM.injury, season, ms.fixtureId, round, f.id);
    if (!rng.chanceBp(p)) continue;
    const w = severityWeights(f, content, exposure);
    const severity = SEVERITY_ORDER[rng.weightedIndex(SEVERITY_ORDER.map((s) => w[s]))]!;
    const seriousMatch = truncN((p * seriousShareBp(w) * PROVISIONAL_TYPICAL_ROUNDS_PER_MATCH_X10) / (BP * 10));
    applyInjury(
      draft,
      f,
      { round, severity, rng },
      { byFighterId: a.downCause?.byFighterId ?? null, exposure },
      { atRisk: isAtRisk(f, content), seriousMatch, fixtureId: ms.fixtureId, season, since },
      content,
      sink,
    );
    injured.push(f.id);
  }
  return injured;
}

/** At each between-round step, after the swaps: freshnessBetweenRounds perk gains for active fighters and unused reserves (not withdrawn, not injured). */
export function freshnessBetweenRounds(draft: GameState, ms: MatchState, content: ContentDB): void {
  for (const side of [ms.home, ms.away]) {
    const out = new Set<string>([...side.withdrawn, ...side.injured]);
    for (const id of [...side.active, ...side.unusedReserves]) {
      if (out.has(id)) continue;
      const f = draft.fighters[id];
      if (!f) continue;
      const gain = perkBetweenRoundsGain10(f, content);
      if (gain !== 0) setFreshness10(f, freshness10Of(f) + gain);
    }
  }
}

// ---- match end ----------------------------------------------------------------------------------------

export interface MatchProgressionOutcome {
  /** Bench XP per fit roster fighter of both clubs who started no round (squad reserves included). */
  benchXp: Record<FighterId, number>;
  /** Level-ups gained (at most levels.json maxLevelUpsPerMatch per fighter), with offers stored in pendingLevelUps. */
  levelUps: { fighterId: FighterId; level: number }[];
  /** Pending level-ups resolved by policy (auto modes, AI clubs, a full queue). */
  autoResolved: ResolvedLevelUp[];
  newsIds: NewsId[];
  /** Round XP each fighter earned in this match (what xpAfterRound paid, rebuilt from the result): the match news and report. Integrator addition (WP-C). */
  xp?: Record<FighterId, number>;
}

function sortIds(ids: Iterable<string>): FighterId[] {
  return ([...ids] as FighterId[]).sort((a, b) => idNumber(a) - idNumber(b) || (a < b ? -1 : a > b ? 1 : 0));
}

/** Rounds each fighter started: from the recorded round lineups, else rounds 1..roundsPlayed (whole-match results). */
function roundsStartedBy(result: MatchResult): Map<string, number[]> {
  const out = new Map<string, number[]>();
  if (result.roundLineups && result.roundLineups.length > 0) {
    for (const rl of result.roundLineups) {
      for (const id of [...rl.home.fighterIds, ...rl.away.fighterIds]) {
        const list = out.get(id) ?? [];
        list.push(rl.round);
        out.set(id, list);
      }
    }
    return out;
  }
  for (const [id, s] of Object.entries(result.fighterStats)) {
    const n = Math.min(s.roundsPlayed, result.rounds.length);
    if (n > 0) out.set(id, Array.from({ length: n }, (_, i) => i + 1));
  }
  return out;
}

/** clubMatchXp: the round XP of every club fighter who started a round, after the Reckoning multiplier, before personal trait multipliers. */
export function clubMatchXp(result: MatchResult, clubId: ClubId, content: ContentDB): number {
  const x = content.development.xp;
  const tournament = result.stage !== 'league';
  const side = clubId === result.homeClubId ? 'home' : 'away';
  const credits = new Map<string, number>();
  const downed = new Set<string>();
  for (const [id, s] of Object.entries(result.fighterStats)) {
    for (const d of s.downs) {
      downed.add(`${id}|${d.round}`);
      if (d.byFighterId) credits.set(`${d.byFighterId}|${d.round}`, (credits.get(`${d.byFighterId}|${d.round}`) ?? 0) + 1);
    }
  }
  let total = 0;
  for (const [id, rounds] of roundsStartedBy(result)) {
    if (result.fighterStats[id as FighterId]?.clubId !== clubId) continue;
    for (const r of rounds) {
      const won = result.rounds[r - 1]?.winner === side;
      const raw =
        x.perRoundStarted +
        (won ? x.winBonus : 0) +
        Math.min(x.downCreditMax, credits.get(`${id}|${r}`) ?? 0) * x.downCreditEach +
        (downed.has(`${id}|${r}`) ? 0 : x.surviveBonus);
      total += tournament ? truncN((raw * bp(x.tournamentMult)) / BP) : raw;
    }
  }
  return total;
}

/** Bench XP (bxp-001): floor(clubMatchXp × ⅓ × own trait XP multipliers ÷ lineup slots), one floor at the end. */
export function benchXpFor(fighter: Fighter, clubXp: number, content: ContentDB): number {
  const b = content.levels.benchXp;
  let v = (clubXp * bp(b.shareOfStarterMean)) / BP;
  for (const f of multFactorsBp(effectSources(fighter, content), 'xp')) v = (v * f) / BP;
  return truncN(v / b.lineupSlots);
}

function matchCounters(draft: GameState, result: MatchResult, started: Map<string, number[]>, content: ContentDB, out: MatchProgressionOutcome): void {
  const root = draft.rng.root;
  const thisWeek = { season: draft.calendar.season, weekIndex: draft.calendar.weekIndex };
  for (const id of sortIds(started.keys())) {
    const f = draft.fighters[id];
    const stats = result.fighterStats[id];
    if (!f || !stats) continue;
    const rounds = started.get(id) ?? [];
    const side = stats.clubId === result.homeClubId ? 'home' : 'away';
    const won = rounds.filter((r) => result.rounds[r - 1]?.winner === side).length;
    f.season.roundsStarted += rounds.length;
    f.season.matchesStarted += 1;
    f.career.matches += 1;
    f.career.roundsStarted += rounds.length;
    f.career.roundsWon += won;
    f.career.downsInflicted += stats.downsInflicted;
    f.career.downsSuffered += stats.downsSuffered;
    f.career.damageDealt += stats.damageDealt;
    f.career.healingDone += stats.healingDone;
    // Still tender counts matches in which he starts a round (one set in this match counts from the next).
    for (const s of f.statuses) {
      const setNow = s.since.season === thisWeek.season && s.since.weekIndex === thisWeek.weekIndex;
      if (s.id === STILL_TENDER && s.remainingMatches !== null && !setNow) s.remainingMatches -= 1;
    }
    f.statuses = f.statuses.filter((s) => !(s.id === STILL_TENDER && s.remainingMatches !== null && s.remainingMatches <= 0));
    const changes = checkThresholds(f, 'matchEnd', draft.calendar.season, content, root);
    if (result.stage === 'final' && result.winnerClubId === stats.clubId && content.traits.has(EVENT_TRAIT_IDS.titleTested)) {
      changes.push(...gainTrait(f, EVENT_TRAIT_IDS.titleTested, 'event', draft.calendar.season, content, root));
    }
    for (const c of changes) {
      out.newsIds.push(pushNews(draft, { key: c.change === 'skipped' ? 'fighter.trait_skipped' : `fighter.trait_${c.change}`, clubId: f.clubId, fighterId: f.id, params: { traitId: c.traitId } }));
    }
  }
}

/**
 * Bench XP for both clubs, then level-up checks for everyone who earned XP
 * in the match (also used after an M1 whole-match result, so the level bar
 * fills on either path).
 */
export function benchAndLevels(draft: GameState, result: MatchResult, content: ContentDB, out: MatchProgressionOutcome, started = roundsStartedBy(result)): void {
  const earned = new Set<string>(started.keys());
  for (const clubId of [result.homeClubId, result.awayClubId]) {
    const clubXp = clubMatchXp(result, clubId, content);
    const side = clubId === result.homeClubId ? 'home' : 'away';
    const reserves = new Set<string>(result.squads?.[side].reserves ?? []);
    for (const f of clubRoster(draft, clubId)) {
      if (started.has(f.id)) continue;
      if (reserves.has(f.id)) f.season.squadReserveMatches += 1;
      if (!isFitFighter(f)) continue;
      const xp = benchXpFor(f, clubXp, content);
      out.benchXp[f.id] = xp;
      if (xp <= 0) continue;
      f.season.xp += xp;
      f.season.benchXp += xp;
      f.xpIntoLevel += xp;
      f.career.xpTotal += xp;
      earned.add(f.id);
    }
  }
  for (const id of sortIds(earned)) {
    const f = draft.fighters[id];
    if (f && f.status !== 'retired') checkLevelUps(draft, f, content, out);
  }
}

/** Level-ups at match end: while the bar holds xpNeeded, at most maxLevelUpsPerMatch (lvl-006). */
export function checkLevelUps(draft: GameState, f: Fighter, content: ContentDB, out: MatchProgressionOutcome): void {
  const max = content.levels.xpPerLevel.maxLevelUpsPerMatch;
  for (let n = 0; n < max && f.xpNeeded > 0 && f.xpIntoLevel >= f.xpNeeded; n++) {
    f.xpIntoLevel -= f.xpNeeded;
    f.level += 1;
    f.career.levelsGained += 1;
    out.levelUps.push({ fighterId: f.id, level: f.level });
    enqueue(draft, f, generateOffer(draft, f, f.level, content), content, out);
    // The next requirement starts with the new level, after the pick (it may move the gap factor).
    f.xpNeeded = xpNeededFor(f, content, { mentor: levelMentorMult(draft, f, content) });
  }
}

function enqueue(draft: GameState, f: Fighter, offer: PendingLevelUp, content: ContentDB, out: MatchProgressionOutcome): void {
  const mode = effectiveLevelUpMode(draft, f);
  f.pendingLevelUps = [...f.pendingLevelUps, offer];
  if (mode !== 'manual') {
    out.autoResolved.push(resolveByPolicy(draft, f, offer.level, mode, 'auto', content));
    return;
  }
  out.newsIds.push(pushNews(draft, { key: 'fighter.level_up', clubId: f.clubId, fighterId: f.id, params: { level: offer.level } }));
  while (f.pendingLevelUps.length > content.levels.offers.pending.maxQueued) {
    const oldest = f.pendingLevelUps[0]!;
    out.autoResolved.push(resolveByPolicy(draft, f, oldest.level, 'auto', 'queue_full', content));
    out.newsIds.push(pushNews(draft, { key: 'fighter.level_auto_resolved', clubId: f.clubId, fighterId: f.id, params: { level: oldest.level } }));
  }
}

/** Resolve a pending level-up by a policy (manual fighters use 'auto' when the queue is full or the season ends). */
export function resolveByPolicy(draft: GameState, f: Fighter, level: number, mode: LevelUpMode, how: LevelUpResolution, content: ContentDB): ResolvedLevelUp {
  const offer = f.pendingLevelUps.find((p) => p.level === level);
  if (!offer) throw new RangeError(`resolveByPolicy: ${f.id} has no pending level ${level}`);
  const policy = mode === 'manual' ? 'auto' : mode;
  const choice = autoPick(f, offer, policy, content, offerContextOf(draft, f, content));
  return applyChoice(draft, f, offer, choice, how, content);
}

/** Apply a validated choice: the pick (an option that became illegal resolves to null), the learned trait, the log. */
function applyChoice(draft: GameState, f: Fighter, offer: PendingLevelUp, choice: LevelUpChoice, how: LevelUpResolution, content: ContentDB): ResolvedLevelUp {
  let picked: LevelOption | null = choice.optionIndex === null ? null : (offer.options[choice.optionIndex] ?? null);
  if (picked && !optionLegal(f, picked, content)) picked = null;
  if (picked) {
    switch (picked.kind) {
      case 'stat': {
        const room = (f.cap100[picked.stat] ?? 0) - (f.train100[picked.stat] ?? 0);
        const gain = Math.min(picked.gain100, room);
        f.train100 = { ...f.train100, [picked.stat]: (f.train100[picked.stat] ?? 0) + gain } as Record<StatId, number>;
        picked = { ...picked, gain100: gain };
        break;
      }
      case 'rank':
        f.abilityRanks = { ...f.abilityRanks, [picked.slot]: picked.toRank };
        break;
      case 'perk':
        f.perkIds = [...f.perkIds, picked.perkId];
        break;
    }
  }
  let trait: TraitId | null = null;
  if (choice.traitIndex !== null && offer.traitOffer) {
    const id = offer.traitOffer[choice.traitIndex];
    const entry = id ? [...content.levels.traitOfferPool.positive, ...content.levels.traitOfferPool.burdens].find((e) => e.id === id) : undefined;
    if (id && entry && traitEntryEligible(f, entry, content) && addAcquiredTrait(f, id, 'level', draft.calendar.season, content)) trait = id;
  }
  f.pendingLevelUps = f.pendingLevelUps.filter((p) => p.level !== offer.level);
  const resolved: ResolvedLevelUp = { level: offer.level, season: offer.season, weekIndex: offer.weekIndex, picked, trait, how };
  f.season.levelLog = [...f.season.levelLog, resolved];
  const r = ratingOf(f, content);
  if (r > f.career.peakRating) f.career.peakRating = r;
  return resolved;
}

/** Round XP of each fighter's started rounds in a played match, as xpAfterRound computed it (integrator addition, WP-C: the match news). */
function matchRoundXp(draft: GameState, result: MatchResult, started: Map<string, number[]>, content: ContentDB): Record<FighterId, number> {
  const tournament = result.stage !== 'league';
  const credits = new Map<string, number>();
  const downed = new Set<string>();
  for (const [id, s] of Object.entries(result.fighterStats)) {
    for (const d of s.downs) {
      downed.add(`${id}|${d.round}`);
      if (d.byFighterId) credits.set(`${d.byFighterId}|${d.round}`, (credits.get(`${d.byFighterId}|${d.round}`) ?? 0) + 1);
    }
  }
  const out: Record<FighterId, number> = {};
  for (const id of sortIds(started.keys())) {
    const f = draft.fighters[id];
    const st = result.fighterStats[id];
    if (!f || !st) continue;
    const side = st.clubId === result.homeClubId ? 'home' : 'away';
    let xp = 0;
    for (const r of started.get(id) ?? []) {
      xp += roundXp(f, content, { won: result.rounds[r - 1]?.winner === side, credits: credits.get(`${id}|${r}`) ?? 0, downed: downed.has(`${id}|${r}`) }, tournament);
    }
    out[id] = xp;
  }
  return out;
}

/** Match end (levels.json hooks.matchEnd): match counters, bench XP, level-up checks, offers, auto-resolution. */
export function matchEndProgression(draft: GameState, result: MatchResult, content: ContentDB): MatchProgressionOutcome {
  const out: MatchProgressionOutcome = { benchXp: {}, levelUps: [], autoResolved: [], newsIds: [] };
  const started = roundsStartedBy(result);
  out.xp = matchRoundXp(draft, result, started, content);
  matchCounters(draft, result, started, content, out);
  benchAndLevels(draft, result, content, out, started);
  return out;
}

// ---- commands -----------------------------------------------------------------------------------------------

/**
 * Resolve one pending level-up of `fighterId` (levelup.choose, auto-pick,
 * queue overflow, season end): apply the pick (train100 += gain, rank, perk,
 * learned trait), log it in season.levelLog, drop it from pendingLevelUps.
 * Errors: levelup.unknown, levelup.option, levelup.trait (core/game validates
 * club ownership and the match-in-progress rule first).
 */
export function resolveLevelUp(
  draft: GameState,
  fighterId: FighterId,
  level: number,
  choice: LevelUpChoice,
  how: LevelUpResolution,
  content: ContentDB,
): Result<ResolvedLevelUp, EngineError> {
  const f = draft.fighters[fighterId];
  const offer = f?.pendingLevelUps.find((p) => p.level === level);
  if (!f || !offer) return err(engineError('levelup.unknown', `No pending level ${level} for ${fighterId}`, { fighterId, level }));
  const legal = offer.options.map((o) => optionLegal(f, o, content));
  if (choice.optionIndex === null) {
    if (legal.some(Boolean)) return err(engineError('levelup.option', 'An option must be picked while one is legal', { fighterId, level }));
  } else if (!Number.isInteger(choice.optionIndex) || choice.optionIndex < 0 || choice.optionIndex >= offer.options.length || !legal[choice.optionIndex]) {
    return err(engineError('levelup.option', `Option ${choice.optionIndex} is not a legal option`, { fighterId, level, optionIndex: choice.optionIndex }));
  }
  if (choice.traitIndex !== null) {
    const id = offer.traitOffer?.[choice.traitIndex];
    const entry = id ? [...content.levels.traitOfferPool.positive, ...content.levels.traitOfferPool.burdens].find((e) => e.id === id) : undefined;
    if (!Number.isInteger(choice.traitIndex) || !id || !entry || !traitEntryEligible(f, entry, content)) {
      return err(engineError('levelup.trait', `Trait option ${choice.traitIndex} is not available`, { fighterId, level, traitIndex: choice.traitIndex }));
    }
  }
  return ok(applyChoice(draft, f, offer, choice, how, content));
}

/** Season-end step 6.1: auto-resolve every pending level-up (oldest first) by the fighter's policy. */
export function resolveAllPending(draft: GameState, f: Fighter, content: ContentDB): ResolvedLevelUp[] {
  const out: ResolvedLevelUp[] = [];
  while (f.pendingLevelUps.length > 0) out.push(resolveByPolicy(draft, f, f.pendingLevelUps[0]!.level, effectiveLevelUpMode(draft, f), 'season_end', content));
  return out;
}

// ---- weekly rest (inside weeklyLifecycle) ----------------------------------------------------------------

/** Fighters who started a round, and squad reserves who never entered, in this week's results. */
export function weekParticipation(state: GameState): { started: Set<string>; reserves: Set<string> } {
  const started = new Set<string>();
  const reserves = new Set<string>();
  const { season, weekIndex } = state.calendar;
  for (const r of Object.values(state.results)) {
    if (r.season !== season || r.weekIndex !== weekIndex) continue;
    for (const [id, s] of Object.entries(r.fighterStats)) if (s.roundsPlayed > 0) started.add(id);
    for (const rl of r.roundLineups ?? []) for (const id of [...rl.home.fighterIds, ...rl.away.fighterIds]) started.add(id);
    for (const id of [...(r.squads?.home.reserves ?? []), ...(r.squads?.away.reserves ?? [])]) reserves.add(id);
  }
  for (const id of started) reserves.delete(id);
  return { started, reserves };
}

/** The Freshness label of a fighter now (UI, digest). */
export function freshnessLabelOf(fighter: Fighter, content: ContentDB): ReturnType<typeof freshnessLabel> {
  return freshnessLabel(freshnessOf(fighter), content);
}
