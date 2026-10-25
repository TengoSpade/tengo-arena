/**
 * Display formatting shared by the WP7 screens (04 "Formatting": money
 * "11,840 ts", signed changes with U+2212, durations "0:38", weeks "2 wk").
 *
 * Thin layer over src/ui/format (WP6): integers and fight time delegate to
 * it; money takes the content explicitly so screens and tests do not depend
 * on the app having called configureFormat() first.
 */
import type { ContentDB } from '../../../../core/content';
import { formatInt, formatTicks } from '../../../format';

export const MINUS = '−';
export const EN_DASH = '–';
export const MID_DOT = '·';

/** Integer with thousands separators: 11840 -> "11,840", -497 -> "−497". */
export function fmtInt(n: number, separator?: string): string {
  if (separator === undefined || separator === ',') return formatInt(n);
  const v = Math.trunc(n);
  const grouped = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return v < 0 ? MINUS + grouped : grouped;
}

/** Signed integer: "+1,200", "−340", "0". */
export function fmtSigned(n: number): string {
  if (n > 0) return `+${fmtInt(n)}`;
  return fmtInt(n);
}

/** Money in the theme currency: "11,840 ts" (economy.json currency.format). */
export function fmtMoney(n: number, content: ContentDB | null, opts: { signed?: boolean } = {}): string {
  const currency = content?.economy.currency;
  const sep = currency?.thousandsSeparator ?? ',';
  const amount = opts.signed && n > 0 ? `+${fmtInt(n, sep)}` : fmtInt(n, sep);
  const format = currency?.format ?? '{amount} ts';
  return format.split('{amount}').join(amount);
}

/** Currency abbreviation ("ts"). */
export function currencyAbbr(content: ContentDB | null): string {
  return content?.economy.currency.abbreviation ?? 'ts';
}

/** Fight time from ticks: 760 ticks at 50 ms -> "0:38". */
export function fmtTicks(ticks: number, tickMs = 50): string {
  return formatTicks(ticks, 1000 / tickMs);
}

/** Seconds with one decimal from ticks: 284 ticks -> "14.2". */
export function fmtSeconds1(ticks: number, tickMs = 50): string {
  const tenths = Math.round((ticks * tickMs) / 100);
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

/** Basis points as a whole percent: 2500 -> "25%". */
export function fmtPctBp(bp: number): string {
  return `${Math.round(bp / 100)}%`;
}

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th". */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "1 season" / "3 seasons" style pluralisation for English UI copy. */
export function plural(n: number, one: string, many: string): string {
  return `${fmtInt(n)} ${n === 1 ? one : many}`;
}
