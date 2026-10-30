/**
 * npm run freshness-table -- [--rounds 3]
 *
 * KI-21 / O36 proof table: Freshness at the start of each week's match (its first round) for a young (22), middle-aged (28) and older (34)
 * human-age fighter at low (8), median (13) and high (18) Stamina who starts fully fresh and plays a full match
 * (default 3 rounds, typical load) every week, with the weekly played-week recovery in between. Uses the real
 * drain and recovery functions of core/fighters. "Matches before needing rest" = consecutive matches in which no
 * round starts in the Tired tier, below levels.json freshness.threshold (50: the first of the three penalty tiers
 * with a real cost, and where Q48's half drain begins).
 */
import { freshness10Of, playedWeekRest10, roundDrain10, setFreshness10, staminaOf } from '../src/core/fighters/freshness';
import { fighterHumanAge100 } from '../src/core/fighters/stats';
import { createGameEngine, realGamePorts } from '../src/core/game';
import { intArg, parseArgs } from './lib/args';
import { loadThemeOrExit } from './lib/cli-content';

const args = parseArgs(process.argv.slice(2));
const rounds = intArg(args, 'rounds', 3);
const content = loadThemeOrExit('default');
const engine = createGameEngine(realGamePorts);
const w = engine.createWorld(content, { rootSeed: 'freshness-table' });
if (!w.ok) throw new Error(w.error.message);
const proto = Object.values(w.value.fighters).find((f) => f.raceId === 'human' && f.clubId !== null)!;
const threshold10 = content.levels.freshness.threshold * content.levels.freshness.storageUnitsPerPoint;
const load = { durationS: 36, damageTaken: 0.6, maxHp: 1, downed: false };

console.log(`Freshness at the start of each week's match (first round); full ${rounds}-round matches every week, typical load, fresh start; "matches before a Tired round" = matches played before a round would start below ${content.levels.freshness.threshold}`);
for (const [name, age] of [['young', 22], ['middle', 28], ['older', 34]] as const) {
  for (const sta of [8, 13, 18]) {
    const f = JSON.parse(JSON.stringify(proto)) as typeof proto;
    f.age = age;
    f.perkIds = [];
    f.wear100 = Object.fromEntries(Object.keys(f.wear100).map((k) => [k, 0])) as typeof f.wear100;
    (f.train100 as Record<string, number>)['stamina'] = sta * 100;
    const eff = staminaOf(f, content);
    const ha = fighterHumanAge100(f, content) / 100;
    setFreshness10(f, 1000);
    const path: number[] = [];
    let before: number | null = null;
    for (let wk = 1; wk <= 8; wk++) {
      path.push(Math.floor(freshness10Of(f) / 10));
      let tired = false;
      for (let r = 0; r < rounds; r++) {
        if (freshness10Of(f) < threshold10) tired = true;
        setFreshness10(f, freshness10Of(f) - roundDrain10(f, load, content));
      }
      if (tired && before === null) before = wk - 1;
      setFreshness10(f, freshness10Of(f) + playedWeekRest10(f, content));
    }
    console.log(`${name.padEnd(6)} age ${ha} STA ${String(eff).padStart(2)}: ${path.map((v) => String(v).padStart(3)).join(' ')}  -> matches before a Tired round: ${before ?? '8+'}`);
  }
}
