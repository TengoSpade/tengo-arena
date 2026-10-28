/**
 * npx tsx scripts/smoke/tools/overtime-seed.ts [--prefix arena-smoke-ot] [--from 1] [--to 60] [--rounds 3] [--first 5]
 *
 * Finds career seeds whose first watched match has a round that goes past 0:45 (overtime), so the smoke can show the amber
 * clock and the Overtime tag on a real round. It plays the same career the smoke plays through the UI, headless in core/game:
 * a new world with the seed, the first club card of the lowest tier (prestige, then name), Continue through the preseason,
 * Watch, and the rounds of the first match. A round is long when its log has `overtime.start`. Prints one line per seed
 * that has one, with the round, the tick overtime starts and the round's length.
 */
import { advance, applyCommand, createWorld, liveRoundPlayback } from '../../../src/core/game';
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

/** The club the smoke picks on the club-select screen: the first card of the lowest tier (club-select/index.tsx: prestige descending, then name). */
export function firstClubOfLowestTier(state: GameState, content: ContentDB): ClubId {
  const lowest = Math.max(...content.tiers.list.map((t) => t.level));
  const tier = content.tierByLevel(lowest);
  const clubs = Object.values(state.clubs)
    .filter((c) => c.tierId === tier.id)
    .sort((a, b) => b.prestige - a.prestige || (a.name < b.name ? -1 : 1));
  return clubs[0]!.id;
}

/** The rounds of the career's first watched match, headless: how long each is and whether it passes into overtime. */
export function firstMatchRounds(content: ContentDB, seed: string, maxRounds = 3): RoundLength[] | null {
  const world = createWorld(content, { rootSeed: seed });
  if (!world.ok) return null;
  let state = world.value;
  const chosen = applyCommand(state, { type: 'club.choose', clubId: firstClubOfLowestTier(state, content) }, content);
  if (!chosen.ok) return null;
  state = chosen.value.state;
  // Continue: weeks until the player's match waits to be watched.
  let watching = false;
  for (let i = 0; i < 30 && !watching; i++) {
    const r = advance(state, content, { playerMatch: 'watch' });
    if (!r.ok) return null;
    state = r.value.state;
    watching = !!r.value.watch;
  }
  if (!watching) return null;
  const out: RoundLength[] = [];
  for (let n = 1; n <= maxRounds; n++) {
    const p = liveRoundPlayback(state, content);
    if (!p.ok) return out.length ? out : null;
    const log = p.value.log;
    const ot = log.events.find((e) => e.type === 'overtime.start');
    out.push({ round: n, durationTicks: log.events[log.events.length - 1]!.tick, overtimeTick: ot ? ot.tick : null });
    // The round is watched to its end, then the match goes on as the between-round screen's Continue does.
    const done = advance(state, content, { watched: { round: n, logHash: log.hash } });
    if (!done.ok) return out;
    state = done.value.state;
    if (!state.liveMatch) break;
    const next = advance(state, content, { playerMatch: 'watch' });
    if (!next.ok) return out;
    state = next.value.state;
    if (!next.value.watch) break;
  }
  return out;
}

if (process.argv[1] && /overtime-seed\.[tj]s$/.test(process.argv[1])) {
  const args = parseArgs(process.argv.slice(2));
  const prefix = stringArg(args, 'prefix', 'arena-smoke-ot');
  const from = intArg(args, 'from', 1);
  const to = intArg(args, 'to', 60);
  const rounds = intArg(args, 'rounds', 3);
  const first = intArg(args, 'first', 5);
  const content = loadThemeOrExit('default');
  let found = 0;
  for (let i = from; i <= to && found < first; i++) {
    const seed = `${prefix}-${i}`;
    const r = firstMatchRounds(content, seed, rounds);
    if (!r) {
      console.log(`${seed}: the career did not reach a watched match`);
      continue;
    }
    const summary = r.map((x) => `R${x.round} ${(x.durationTicks * 0.05).toFixed(1)}s${x.overtimeTick === null ? '' : ` (overtime from ${(x.overtimeTick * 0.05).toFixed(0)}s)`}`).join(', ');
    const hit = r.find((x) => x.overtimeTick !== null);
    console.log(`${seed}: ${summary}${hit ? `   <- overtime in round ${hit.round}` : ''}`);
    if (hit) found++;
  }
}
