/**
 * npm run balance -- [--fights 5000] [--seed balance-1]
 *                    [--mode random-draft|mirror|preset-vs-default|progression|perk-impact|rank-impact|fatigue|squad-match]
 *                    [--profile none|season3|veteran] [--pick auto|uniform] [--per N]
 *                    [--theme default] [--out reports/x.json] [--strict] [--bench 500]
 *
 * Seeded headless fights -> per-class and per-archetype win rates, fight
 * length, overtime and time-cap rates, rarely cast abilities, idle rules and
 * ms per round (V1, vis-002; 03-combat §8). Owner: WP1 / M1.1 WP-A.
 * M1.1 modes (combat-skills.md §8): progression (skills per --profile, chosen
 * by --pick), perk-impact and rank-impact (--per fights per perk / ability;
 * default fights / items), fatigue (the four Freshness profiles; --fights
 * split between them), squad-match (needs WP-C).
 * --bench N times N extra rounds at record 'none' and 'full' (05 §8 budgets).
 * --strict exits 1 when any class or archetype is outside the target band,
 * or (M1.1 modes) any perk, rank or fatigue flag is raised.
 */
import { performance } from 'node:perf_hooks';
import { runBalance, type BalanceMode, type BalanceOptions, type BalanceReport } from '../src/core/harness';
import { intArg, parseArgs, stringArg } from './lib/args';
import { loadThemeOrExit } from './lib/cli-content';
import { writeReport } from './lib/report';

const args = parseArgs(process.argv.slice(2));
const fights = intArg(args, 'fights', 5000);
const seed = stringArg(args, 'seed', 'balance-1');
const theme = stringArg(args, 'theme', 'default');
const mode = stringArg(args, 'mode', 'random-draft') as BalanceMode;
const profile = args.has('profile') ? (stringArg(args, 'profile', 'season3') as BalanceOptions['profile']) : undefined;
const pick = args.has('pick') ? (stringArg(args, 'pick', 'auto') as BalanceOptions['pick']) : undefined;
const perItem = args.has('per') ? intArg(args, 'per', 200) : undefined;
const bench = args.has('bench') ? intArg(args, 'bench', 500) || 500 : 0;
const out = args.get('out');

const content = loadThemeOrExit(theme);
const clock = (): number => performance.now();

const t0 = performance.now();
const report = runBalance({ seed, fights, content, mode, clock, profile, pick, perItem });
const ms = performance.now() - t0;

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
console.log(`balance: ${report.fights} fights (rounds), mode ${mode}${report.profile ? ` (profile ${report.profile}, pick ${report.pick})` : ''}, seed "${seed}", theme "${theme}"`);
// Paired M1.1 modes measure one side against its twin: per-class rates are ~50% by construction.
const paired = mode === 'perk-impact' || mode === 'rank-impact' || mode === 'fatigue';
if (!paired) console.log('  class                     games   wins   win%   95% CI          dmg   heal  life s');
for (const row of paired ? [] : report.classes) {
  const ci = `${pct(row.ciLow ?? 0)}-${pct(row.ciHigh ?? 0)}`;
  const flag = report.outliers.includes(row.classId) ? '  <-- outlier' : '';
  console.log(
    `  ${row.classId.padEnd(24)} ${String(row.appearances).padStart(6)} ${String(row.wins).padStart(6)} ${pct(row.winRate).padStart(6)}   ${ci.padEnd(13)} ${String(row.avgDamage ?? 0).padStart(6)} ${String(row.avgHealing ?? 0).padStart(6)} ${String(row.avgLifetimeS ?? 0).padStart(6)}${flag}`,
  );
}
if (!paired) console.log('  archetype (pure classes; hybrids pooled):');
for (const g of paired ? [] : (report.archetypes ?? [])) console.log(`    ${g.id.padEnd(12)} ${String(g.appearances).padStart(6)} ${pct(g.winRate).padStart(6)}${(report.archetypeOutliers ?? []).includes(g.id) ? '  <-- outlier' : ''}`);
if (mode === 'preset-vs-default') for (const s of report.styles ?? []) console.log(`    style ${s.id.padEnd(20)} ${String(s.appearances).padStart(6)} ${pct(s.winRate).padStart(6)}`);
const fl = report.fightLength!;
console.log(`  fight length: median ${fl.medianS.toFixed(2)} s, P10 ${fl.p10S.toFixed(2)} s, P90 ${fl.p90S.toFixed(2)} s; overtime ${pct(fl.overtimeRate)}; time cap ${pct(fl.timeCapRate)}; home wins ${pct(fl.homeWinRate)}`);
console.log(`  tiebreak steps: ${JSON.stringify(fl.tiebreakSteps)}`);
console.log(`  detectors: healing/damage ${pct(report.detectors!.healingPerDamage)}, overheal ${pct(report.detectors!.overhealShare)}, hard-CC uptime ${pct(report.detectors!.hardCcUptime)}`);
console.log(`  class outliers (outside ${Math.round(report.targetBand.min * 100)}-${Math.round(report.targetBand.max * 100)}%): ${report.outliers.join(', ') || 'none'}`);
const ab = report.archetypeBand ?? report.targetBand;
console.log(`  archetype outliers (outside ${Math.round(ab.min * 100)}-${Math.round(ab.max * 100)}%): ${(report.archetypeOutliers ?? []).join(', ') || 'none'}`);
const pts = (x: number): string => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;
if (report.perks) {
  console.log('  perks (by dominance = veteran pick rate x lift):    pick s3  pick vet  rounds   win%   lift pts (95% CI)      procs/round');
  for (const p of report.perks) {
    const procs = p.procsPerRound === null ? '' : p.procsPerRound.toFixed(2);
    const tag = p.lifecycleOnly ? '  (lifecycle only)' : '';
    console.log(
      `    ${p.perkId.padEnd(24)} ${p.archetype.padEnd(10)} T${p.tier}  ${pct(p.pickRate).padStart(7)}  ${pct(p.pickRateVeteran).padStart(8)}  ${String(p.rounds).padStart(6)} ${pct(p.winRate).padStart(6)}   ${pts(p.liftPts).padStart(5)} (${pts(p.ciLowPts)} to ${pts(p.ciHighPts)})   ${procs.padStart(6)}${tag}${p.flags.length ? `  <-- ${p.flags.join('; ')}` : ''}`,
    );
  }
}
if (report.ranks) {
  console.log('  ranks (rank 3 vs rank 1, by lift):                rounds   win%   lift pts (95% CI)');
  for (const r of report.ranks) {
    console.log(`    ${r.abilityId.padEnd(32)} ${r.slot.padEnd(7)} ${r.family.padEnd(12)} ${String(r.rounds).padStart(6)} ${pct(r.winRate).padStart(6)}   ${pts(r.liftPts).padStart(5)} (${pts(r.ciLowPts)} to ${pts(r.ciHighPts)})${r.flags.length ? `  <-- ${r.flags.join('; ')}` : ''}`);
  }
}
if (report.fatigue) {
  console.log('  fatigue (tired side win rate):  rounds   win%   95% CI          target');
  for (const r of report.fatigue) {
    console.log(`    ${r.label.padEnd(22)} ${String(r.rounds).padStart(6)} ${pct(r.winRate).padStart(6)}   ${`${pct(r.ciLow)}-${pct(r.ciHigh)}`.padEnd(13)}   ${pct(r.target.min)}-${pct(r.target.max)}${r.inTarget ? '' : '  <-- off target'}`);
  }
}
console.log(`  abilities never cast in >50% of rounds: ${(report.rarelyCastAbilities ?? []).length}; preset rules never fired in >80%: ${(report.idleRules ?? []).length}`);
if (report.timing) console.log(`  ms per round (record none): median ${report.timing.medianMs.toFixed(2)}, p99 ${report.timing.p99Ms.toFixed(2)}, mean ${report.timing.meanMs.toFixed(2)}`);
console.log(`  time: ${ms.toFixed(0)} ms total`);

let benchReport: { none: BalanceReport['timing']; full: BalanceReport['timing'] } | undefined;
if (bench > 0) {
  const none = runBalance({ seed: `${seed}-bench`, fights: bench, content, mode, clock, record: 'none', profile, pick, perItem }).timing;
  const full = runBalance({ seed: `${seed}-bench`, fights: bench, content, mode, clock, record: 'full', profile, pick, perItem }).timing;
  benchReport = { none, full };
  console.log(`  bench ${bench} rounds: none median ${none!.medianMs.toFixed(2)} ms p99 ${none!.p99Ms.toFixed(2)} ms; full median ${full!.medianMs.toFixed(2)} ms p99 ${full!.p99Ms.toFixed(2)} ms (budget: none median <= 2, p99 <= 6; full <= 3x)`);
}

const path = writeReport(typeof out === 'string' ? out : undefined, `balance-${mode}-${seed}.json`, { ...report, timingMs: ms, theme, bench: benchReport });
console.log(`  report: ${path}`);

const m11Flags = (report.perks ?? []).some((p) => p.flags.length > 0) || (report.ranks ?? []).some((r) => r.flags.length > 0) || (report.fatigue ?? []).some((r) => !r.inTarget);
if (args.has('strict') && (report.outliers.length > 0 || (report.archetypeOutliers ?? []).length > 0 || m11Flags)) process.exitCode = 1;
