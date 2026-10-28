import type { BalanceMode, BalanceReport } from '../../src/core/harness';

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const pts = (x: number): string => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;

/**
 * The text report `npm run balance` prints after a run, one string per line. Every section is printed
 * only when the report has it: the modes do not share fields (squad-match has no per-class table, fight
 * lengths, detectors, rarely-cast abilities or idle rules; KI-18 was a crash on `report.fightLength!`).
 */
export function balanceReportLines(report: BalanceReport, mode: BalanceMode): string[] {
  const out: string[] = [];
  const log = (line: string): void => void out.push(line);
  // Paired M1.1 modes measure one side against its twin: per-class rates are ~50% by construction.
  const paired = mode === 'perk-impact' || mode === 'rank-impact' || mode === 'fatigue';
  // squad-match plays whole matches: it has no per-class or per-archetype rows at all.
  const squad = mode === 'squad-match';
  const classRows = paired || squad ? [] : report.classes;
  const archetypeRows = paired || squad ? [] : (report.archetypes ?? []);

  if (!paired && !squad) log('  class                     games   wins   win%   95% CI          dmg   heal  life s');
  for (const row of classRows) {
    const ci = `${pct(row.ciLow ?? 0)}-${pct(row.ciHigh ?? 0)}`;
    const flag = report.outliers.includes(row.classId) ? '  <-- outlier' : '';
    log(
      `  ${row.classId.padEnd(24)} ${String(row.appearances).padStart(6)} ${String(row.wins).padStart(6)} ${pct(row.winRate).padStart(6)}   ${ci.padEnd(13)} ${String(row.avgDamage ?? 0).padStart(6)} ${String(row.avgHealing ?? 0).padStart(6)} ${String(row.avgLifetimeS ?? 0).padStart(6)}${flag}`,
    );
  }
  if (!paired && !squad) log('  archetype (pure classes; hybrids pooled):');
  for (const g of archetypeRows) log(`    ${g.id.padEnd(12)} ${String(g.appearances).padStart(6)} ${pct(g.winRate).padStart(6)}${(report.archetypeOutliers ?? []).includes(g.id) ? '  <-- outlier' : ''}`);
  if (mode === 'preset-vs-default') for (const s of report.styles ?? []) log(`    style ${s.id.padEnd(20)} ${String(s.appearances).padStart(6)} ${pct(s.winRate).padStart(6)}`);

  const fl = report.fightLength;
  if (fl) {
    log(`  fight length: median ${fl.medianS.toFixed(2)} s, P10 ${fl.p10S.toFixed(2)} s, P90 ${fl.p90S.toFixed(2)} s; overtime ${pct(fl.overtimeRate)}; time cap ${pct(fl.timeCapRate)}; home wins ${pct(fl.homeWinRate)}`);
    log(`  tiebreak steps: ${JSON.stringify(fl.tiebreakSteps)}`);
  }
  const d = report.detectors;
  if (d) log(`  detectors: healing/damage ${pct(d.healingPerDamage)}, overheal ${pct(d.overhealShare)}, hard-CC uptime ${pct(d.hardCcUptime)}`);
  if (!squad) {
    log(`  class outliers (outside ${Math.round(report.targetBand.min * 100)}-${Math.round(report.targetBand.max * 100)}%): ${report.outliers.join(', ') || 'none'}`);
    const ab = report.archetypeBand ?? report.targetBand;
    log(`  archetype outliers (outside ${Math.round(ab.min * 100)}-${Math.round(ab.max * 100)}%): ${(report.archetypeOutliers ?? []).join(', ') || 'none'}`);
  }
  if (report.perks) {
    log('  perks (by dominance = veteran pick rate x lift):    pick s3  pick vet  rounds   win%   lift pts vs without (95% CI)   procs/round');
    for (const p of report.perks) {
      const procs = p.procsPerRound === null ? '' : p.procsPerRound.toFixed(2);
      const tag = `${p.lifecycleOnly ? '  (lifecycle only)' : ''}${p.context ? `  [${p.context}]` : ''}`;
      log(
        `    ${p.perkId.padEnd(24)} ${p.archetype.padEnd(10)} T${p.tier}  ${pct(p.pickRate).padStart(7)}  ${pct(p.pickRateVeteran).padStart(8)}  ${String(p.rounds).padStart(6)} ${pct(p.winRate).padStart(6)}   ${pts(p.liftPts).padStart(5)} (${pts(p.ciLowPts)} to ${pts(p.ciHighPts)})   ${procs.padStart(6)}${tag}${p.flags.length ? `  <-- ${p.flags.join('; ')}` : ''}`,
      );
    }
  }
  if (report.ranks) {
    log('  ranks (rank 3 vs rank 1, by lift):                rounds   win%   lift pts (95% CI)');
    for (const r of report.ranks) {
      log(`    ${r.abilityId.padEnd(32)} ${r.slot.padEnd(7)} ${r.family.padEnd(12)} ${String(r.rounds).padStart(6)} ${pct(r.winRate).padStart(6)}   ${pts(r.liftPts).padStart(5)} (${pts(r.ciLowPts)} to ${pts(r.ciHighPts)})${r.flags.length ? `  <-- ${r.flags.join('; ')}` : ''}`);
    }
  }
  if (report.fatigue) {
    log('  fatigue (tired side: 50% + change vs the same side fresh):  rounds   win%   95% CI          raw    fresh   target');
    for (const r of report.fatigue) {
      log(
        `    ${r.label.padEnd(22)} ${String(r.rounds).padStart(6)} ${pct(r.winRate).padStart(6)}   ${`${pct(r.ciLow)}-${pct(r.ciHigh)}`.padEnd(13)} ${pct(r.rawWinRate).padStart(6)} ${pct(r.freshWinRate).padStart(6)}   ${pct(r.target.min)}-${pct(r.target.max)}${r.inTarget ? '' : '  <-- off target'}`,
      );
    }
  }
  if (report.squadMatch) {
    const q = report.squadMatch;
    log(`  squad-match: ${q.matches} matches (${q.matchups} matchups x 5 rows x 2 sides x policy/off)`);
    log('    policy side vs off       matches   win%   95% CI          comeback  (off)   swaps/match  target');
    for (const r of q.rows) {
      const cb = r.comebackRate === null ? '   -' : pct(r.comebackRate);
      const ocb = r.offComebackRate === null ? '   -' : pct(r.offComebackRate);
      log(`    ${r.id.padEnd(22)} ${String(r.matches).padStart(7)} ${pct(r.winRate).padStart(6)}   ${`${pct(r.ci.low)}-${pct(r.ci.high)}`.padEnd(13)} ${cb.padStart(8)} ${ocb.padStart(7)}   ${r.swapsPerMatch.toFixed(2).padStart(10)}  ${r.target ? `${pct(r.target.min)}-${pct(r.target.max)}` : '-'}${r.inTarget ? '' : '  <-- off target'}`);
    }
    log(`    all: swaps/match ${q.swapsPerMatch.toFixed(2)}, forced ${q.forcedPer100.toFixed(1)} and emergency ${q.emergencyPer100.toFixed(1)} per 100 matches, Tired ${pct(q.tiredShare)} Spent ${pct(q.spentShare)} of fighter-rounds, ${q.roundsPerMatch.toFixed(2)} rounds a match, time cap ${pct(q.timeCapShare)}`);
    for (const f of q.flags) log(`    FLAG ${f}`);
  }
  if (report.rarelyCastAbilities || report.idleRules) {
    log(`  abilities never cast in >50% of rounds: ${(report.rarelyCastAbilities ?? []).length}; preset rules never fired in >80%: ${(report.idleRules ?? []).length}`);
  }
  if (report.timing) log(`  ms per round (record none): median ${report.timing.medianMs.toFixed(2)}, p99 ${report.timing.p99Ms.toFixed(2)}, mean ${report.timing.meanMs.toFixed(2)}`);
  return out;
}

/** First line of the report. The unit is what `report.fights` counts: rounds, or whole matches for squad-match. */
export function balanceHeaderLine(report: BalanceReport, mode: BalanceMode, seed: string, theme: string): string {
  const unit = mode === 'squad-match' ? 'matches' : 'fights (rounds)';
  return `balance: ${report.fights} ${unit}, mode ${mode}${report.profile ? ` (profile ${report.profile}, pick ${report.pick})` : ''}, seed "${seed}", theme "${theme}"`;
}

/** The `--bench` line, or a note when the mode records no per-round timing (squad-match). */
export function benchLine(bench: number, mode: BalanceMode, none: BalanceReport['timing'], full: BalanceReport['timing']): string {
  if (!none || !full) return `  bench ${bench}: not available for mode ${mode} (it has no per-round timing)`;
  return `  bench ${bench} rounds: none median ${none.medianMs.toFixed(2)} ms p99 ${none.p99Ms.toFixed(2)} ms; full median ${full.medianMs.toFixed(2)} ms p99 ${full.p99Ms.toFixed(2)} ms (budget: none median <= 2, p99 <= 6; full <= 3x)`;
}
