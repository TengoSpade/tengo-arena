/**
 * npx tsx scripts/smoke/tools/overtime-seed.ts [--prefix arena-smoke] [--from 1] [--to 60] [--first 5]
 *
 * Finds career seeds for the smoke: the career's first two watched matches yield at least five rounds (vis-003 watches five
 * fights), the club needs no decision before the second match (no "Decide first": an unfit starter, an incomplete lineup), and
 * at least one of the rounds goes past 0:45 (overtime), so the amber clock and the Overtime tag show on a real round. It plays
 * the same career the smoke plays through the UI, headless in core/game: a new world with the seed, the first club card of
 * the lowest tier (prestige, then name), Continue through the preseason, Watch, the rounds of the first match, Continue to the
 * next match day, Watch, its rounds. Prints one line per seed and marks the good ones.
 */
import { advance, applyCommand, createWorld, getBlockers, liveRoundPlayback } from '../../../src/core/game';
import type { ClubId, GameState } from '../../../src/core/model';
import { intArg, parseArgs, stringArg } from '../../lib/args';
import { loadThemeOrExit } from '../../lib/cli-content';
import type { ContentDB } from '../../../src/core/content';

export interface RoundLength {
  round: number;
  durationTicks: number;
  /** The tick overtime starts, or null for a round that ended before it. */
  overtimeTick: number | null;
}

export interface CareerStart {
  seed: string;
  /** The rounds of the first and the second watched match, in order. */
  matches: RoundLength[][];
  /** Why the second match needed a decision (the blockers Continue would stop on), or [] when it needed none. */
  decisions: string[];
}

/** The club the smoke picks on the club-select screen: the first card of the lowest tier (club-select/index.tsx: prestige descending, then name). */
export function firstClubOfLowestTier(state: GameState, content: ContentDB): ClubId {
  const lowest = Math.max(...content.tiers.list.map((t) => t.level));
  const tier = content.tierByLevel(lowest);
  const clubs = Object.values(state.clubs)
    .filter((c) => c.tierId === tier.id)
    .sort((a, b) => b.prestige - a.prestige || (a.name < b.name ? -1 : 1));
  return clubs[0]!.id;
}

/** What Continue stops on ("Decide first"): every blocker but the season end. */
function decisionsNeeded(state: GameState, content: ContentDB): string[] {
  return getBlockers(state, content)
    .filter((b) => b.code !== 'phase.season-end')
    .map((b) => b.code);
}

/** Watch the rounds of the match that waits to be watched; returns the state after the match and what each round was like. */
function watchMatch(state: GameState, content: ContentDB, maxRounds: number): { state: GameState; rounds: RoundLength[] } | null {
  const rounds: RoundLength[] = [];
  for (let n = 1; n <= maxRounds; n++) {
    const p = liveRoundPlayback(state, content);
    if (!p.ok) return rounds.length ? { state, rounds } : null;
    const log = p.value.log;
    const ot = log.events.find((e) => e.type === 'overtime.start');
    rounds.push({ round: n, durationTicks: log.events[log.events.length - 1]!.tick, overtimeTick: ot ? ot.tick : null });
    // The round is watched to its end; then the match goes on as the between-round screen's Continue does.
    const done = advance(state, content, { watched: { round: n, logHash: log.hash } });
    if (!done.ok) return { state, rounds };
    state = done.value.state;
    if (!state.liveMatch) break;
    const next = advance(state, content, { playerMatch: 'watch' });
    if (!next.ok) return { state, rounds };
    state = next.value.state;
    if (!next.value.watch) break;
  }
  return { state, rounds };
}

/** Plays the career's start headless: its first two watched matches. Null when the career cannot be played this far. */
export function careerStart(content: ContentDB, seed: string, maxRounds = 3): CareerStart | null {
  const world = createWorld(content, { rootSeed: seed });
  if (!world.ok) return null;
  let state = world.value;
  const chosen = applyCommand(state, { type: 'club.choose', clubId: firstClubOfLowestTier(state, content) }, content);
  if (!chosen.ok) return null;
  state = chosen.value.state;
  const matches: RoundLength[][] = [];
  const decisions: string[] = [];
  for (let m = 0; m < 2; m++) {
    // Continue: weeks until the player's match waits to be watched.
    let watching = false;
    for (let i = 0; i < 30 && !watching; i++) {
      if (m === 1 && !state.liveMatch) decisions.push(...decisionsNeeded(state, content));
      const r = advance(state, content, { playerMatch: 'watch' });
      if (!r.ok) return matches.length ? { seed, matches, decisions } : null;
      state = r.value.state;
      watching = !!r.value.watch;
    }
    if (!watching) return matches.length ? { seed, matches, decisions } : null;
    const w = watchMatch(state, content, maxRounds);
    if (!w) return matches.length ? { seed, matches, decisions } : null;
    state = w.state;
    matches.push(w.rounds);
  }
  return { seed, matches, decisions: [...new Set(decisions)] };
}

export const roundsOf = (c: CareerStart): RoundLength[] => c.matches.flat();

/** Good for the smoke: five rounds in two matches, no decision needed, and a round past 0:45 among the first five. */
export function isGoodSeed(c: CareerStart): boolean {
  const rounds = roundsOf(c);
  return rounds.length >= 5 && c.decisions.length === 0 && rounds.slice(0, 5).some((r) => r.overtimeTick !== null);
}

export function describe(c: CareerStart): string {
  const fmt = (r: RoundLength): string => `${(r.durationTicks * 0.05).toFixed(1)}s${r.overtimeTick === null ? '' : '*'}`;
  const ms = c.matches.map((m, i) => `M${i + 1} [${m.map(fmt).join(' ')}]`).join(' ');
  return `${c.seed}: ${ms}${c.decisions.length ? `  decisions before match 2: ${c.decisions.join(', ')}` : ''}${isGoodSeed(c) ? '   <- GOOD' : ''}`;
}

if (process.argv[1] && /overtime-seed\.[tj]s$/.test(process.argv[1])) {
  const args = parseArgs(process.argv.slice(2));
  const prefix = stringArg(args, 'prefix', 'arena-smoke');
  const from = intArg(args, 'from', 1);
  const to = intArg(args, 'to', 60);
  const first = intArg(args, 'first', 5);
  const content = loadThemeOrExit('default');
  console.log('* = the round passes 0:45 (overtime)');
  let found = 0;
  for (let i = from; i <= to && found < first; i++) {
    const seed = `${prefix}-${i}`;
    const c = careerStart(content, seed);
    if (!c) {
      console.log(`${seed}: the career did not reach a watched match`);
      continue;
    }
    console.log(describe(c));
    if (isGoodSeed(c)) found++;
  }
}
