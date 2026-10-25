/**
 * ui/format — every number, money amount, age, week and duration the UI
 * shows goes through here (docs/design 04 "Formatting"). Locale APIs are
 * allowed in this folder only (banned in core).
 *
 * Money: gold displays with the theme's currency (economy.json `currency`,
 * D-K: "11,840 ts"), thousands separators, a true minus sign (U+2212) and
 * "+" on gains. The currency comes from content via configureFormat(); no
 * theme string lives in code.
 */
import type { ContentDB } from '../../core/content';

export const MINUS = '−';

interface CurrencyFormat {
  /** e.g. "{amount} ts". */
  pattern: string;
  abbreviation: string;
  name: string;
  namePlural: string;
  thousandsSeparator: string;
}

let currency: CurrencyFormat = { pattern: '{amount}', abbreviation: '', name: '', namePlural: '', thousandsSeparator: ',' };

/** Read the currency display from content (call once content is loaded). */
export function configureFormat(content: ContentDB): void {
  const c = content.economy.currency;
  currency = {
    pattern: c.format,
    abbreviation: c.abbreviation,
    name: c.displayName,
    namePlural: c.displayNamePlural,
    thousandsSeparator: c.thousandsSeparator,
  };
}

export function currencyAbbreviation(): string {
  return currency.abbreviation;
}

/** 11840 -> "11,840"; negatives use the true minus sign. */
export function formatInt(n: number): string {
  const v = Math.trunc(n);
  const abs = Math.abs(v).toString();
  const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, currency.thousandsSeparator);
  return v < 0 ? MINUS + grouped : grouped;
}

/** Signed integer: "+3", "−2", "0". */
export function formatSigned(n: number): string {
  if (n > 0) return `+${formatInt(n)}`;
  return formatInt(n);
}

export interface MoneyOptions {
  /** Show "+" on gains. */
  signed?: boolean;
  /** Append the currency unit (default true). */
  unit?: boolean;
  /** Append " / wk". */
  perWeek?: boolean;
}

/** 11840 -> "11,840 ts"; -2398 -> "−2,398 ts". */
export function formatMoney(amount: number, options: MoneyOptions = {}): string {
  const num = options.signed ? formatSigned(amount) : formatInt(amount);
  const withUnit = options.unit === false ? num : currency.pattern.split('{amount}').join(num);
  return options.perWeek ? `${withUnit}/wk` : withUnit;
}

/** Basis points as a percent: 1250 -> "12.5%", 300 -> "3%". */
export function formatPercentBp(bp: number, digits = 1): string {
  const pct = bp / 100;
  const text = Number.isInteger(pct) ? pct.toString() : pct.toFixed(digits).replace(/\.?0+$/, '');
  return `${text.replace('-', MINUS)}%`;
}

/** Fraction 0..1 as a whole percent: 0.907 -> "91%". */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Fight time in ticks of 50 ms as m:ss ("0:38"). */
export function formatTicks(ticks: number, ticksPerSecond = 20): string {
  const total = Math.floor(ticks / ticksPerSecond);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** "2 wk" (04 formatting). */
export function formatWeeks(n: number): string {
  return `${formatInt(n)} wk`;
}

/** Ordinal for standings: 1 -> "1st", 22 -> "22nd". English UI copy. */
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

/** ISO wall-clock time for save lists ("25 Oct 2026, 14:05"). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Play time "3 h 12 min" / "12 min". */
export function formatPlaytime(sec: number): string {
  const min = Math.floor(sec / 60);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`;
}

// ---- Bands (04 Notes for implementers; PROPOSED · TUNABLE, OC-9). One helper for all. ----------

export type Band = 1 | 2 | 3 | 4;

/** Attribute on the 1-20 scale: 1-5 -> 1, 6-10 -> 2, 11-15 -> 3, 16-20 -> 4. */
export function attributeBand(value: number): Band {
  if (value >= 16) return 4;
  if (value >= 11) return 3;
  if (value >= 6) return 2;
  return 1;
}

/** Rating or potential on the 1-100 scale: 1-39 -> 1, 40-54 -> 2, 55-69 -> 3, 70-100 -> 4. */
export function ratingBand(value: number): Band {
  if (value >= 70) return 4;
  if (value >= 55) return 3;
  if (value >= 40) return 2;
  return 1;
}

/** Potential as half stars (potential ÷ 20, rounded to the nearest half): 66 -> 3.5. */
export function potentialStars(potential: number): number {
  return Math.round((potential / 20) * 2) / 2;
}

/** Stars as words for tooltips: 3.5 -> "3.5 stars". */
export function starsLabel(stars: number): string {
  return `${stars} ${stars === 1 ? 'star' : 'stars'}`;
}

/**
 * Content prose for the player: drops build-plan notes such as "(From M3: +1 rule slot.)" that some
 * content strings carry for designers.
 */
export function playerText(text: string): string {
  return text.replace(/\s*\((?:from\s+)?M\d+\b[^)]*\)/gi, '').trim();
}
