import { describe, expect, it } from 'vitest';
import { runBalance, type BalanceMode } from '../../src/core/harness';
import { fixtureContent } from '../../src/core/testkit';
import { balanceReportLines } from './balance-print';

const content = fixtureContent();

function lines(mode: BalanceMode, fights: number, perItem?: number): string[] {
  return balanceReportLines(runBalance({ seed: 'print', fights, content, mode, perItem }), mode);
}

describe('npm run balance report text', () => {
  it('squad-match has no fight lengths, detectors or class rows, and prints without throwing (KI-18)', { timeout: 120_000 }, () => {
    const report = runBalance({ seed: 'print', fights: 4, content, mode: 'squad-match' });
    expect(report.fightLength).toBeUndefined();
    expect(report.detectors).toBeUndefined();
    const text = balanceReportLines(report, 'squad-match').join('\n');
    expect(text).toContain('squad-match:');
    expect(text).toContain('comeback');
    expect(text).toContain('all: swaps/match');
    expect(text).not.toContain('fight length');
    expect(text).not.toContain('detectors');
    expect(text).not.toContain('class outliers');
  });

  it('classic modes still print fight lengths, detectors and the outlier lines', () => {
    for (const mode of ['random-draft', 'mirror'] as const) {
      const text = lines(mode, 8).join('\n');
      expect(text).toContain('fight length: median');
      expect(text).toContain('tiebreak steps:');
      expect(text).toContain('detectors:');
      expect(text).toContain('class outliers');
      expect(text).toContain('archetype outliers');
      expect(text).toContain('abilities never cast');
    }
  });

  it('the M1.1 paired modes print their own table', { timeout: 120_000 }, () => {
    expect(lines('perk-impact', 4, 2).join('\n')).toContain('perks (by dominance');
    expect(lines('rank-impact', 4, 2).join('\n')).toContain('ranks (rank 3 vs rank 1');
    expect(lines('fatigue', 8).join('\n')).toContain('fatigue (tired side');
  });
});
