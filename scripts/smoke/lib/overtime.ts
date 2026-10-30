/**
 * Overtime on screen (04 §7, arena-notes §1: "the clock amber plus the word Overtime from 0:45"). A round that passes 45 s must
 * show it three ways, so colour is never the only cue: the clock turns amber (`--c-warn`), the Overtime tag appears next to it,
 * and the HUD centre carries data-overtime. The scrubber also marks where overtime began and the feed says so. This reads
 * them from the page and judges them. Pure except `readOvertimeUi`.
 */
import { colorDistance, parseCssColor } from './checks';
import type { PageDriver } from './page';
import type { CheckResult } from './report';

export interface OvertimeUi {
  /** The HUD centre's data-overtime. */
  overtimeAttr: string | null;
  clockText: string | null;
  /** The clock's computed colour. */
  clockColor: string | null;
  tagText: string | null;
  tagVisible: boolean;
  /** Overtime marks on the scrubber. */
  marks: number;
  /** The feed or the page says "Overtime begins". */
  feedSaysSo: boolean;
}

export async function readOvertimeUi(page: PageDriver): Promise<OvertimeUi> {
  return await page.probe<OvertimeUi>('overtimeUi');
}

export function clockSeconds(text: string | null): number | null {
  const m = /^\s*(\d+):(\d{2})\b/.exec(text ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function checkOvertime(ui: OvertimeUi, palette: { warn: string; text: string }, where: string): CheckResult {
  const seconds = clockSeconds(ui.clockText);
  const warn = parseCssColor(palette.warn);
  const text = parseCssColor(palette.text);
  const clock = parseCssColor(ui.clockColor ?? '');
  const amber = clock !== null && warn !== null && colorDistance(clock, warn) <= 6;
  const notPlain = clock !== null && text !== null && colorDistance(clock, text) > 6;
  const problems: string[] = [];
  if (ui.overtimeAttr !== 'true') problems.push('the HUD centre has no data-overtime');
  if (seconds === null || seconds < 45) problems.push(`the clock reads ${ui.clockText ?? 'nothing'}, not 0:45 or later`);
  if (!amber) problems.push(`the clock colour ${ui.clockColor ?? 'unknown'} is not the amber token ${palette.warn}`);
  if (!notPlain) problems.push('the clock is still the plain text colour');
  if (!ui.tagVisible || !/overtime/i.test(ui.tagText ?? '')) problems.push('the Overtime tag is not visible');
  if (ui.marks < 1) problems.push('the scrubber has no overtime mark');
  if (!ui.feedSaysSo) problems.push('nothing on screen says "Overtime begins"');
  return {
    id: 'arena.overtime',
    title: `Overtime shows: amber clock, the Overtime tag, a scrubber mark (${where})`,
    status: problems.length === 0 ? 'pass' : 'fail',
    ref: 'arena-notes §1, 04 §7',
    expected: 'from 0:45: the clock amber (--c-warn) plus the word Overtime, an overtime mark on the scrubber, "Overtime begins" in the feed',
    actual: problems.length === 0 ? `clock ${ui.clockText} in ${ui.clockColor}, tag "${ui.tagText}", ${ui.marks} scrubber mark(s)` : problems.join('; '),
  };
}
