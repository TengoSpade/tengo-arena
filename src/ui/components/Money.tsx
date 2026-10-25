/**
 * Money (D-K): "11,840 ts", true minus, "+" on gains when `signed`.
 * Every money figure carries a tooltip (04 §6.2): pass `tip` with its
 * source or breakdown.
 */
import { formatMoney } from '../format';
import { tipAttrs, type Tip } from './Tooltip';

export interface MoneyProps {
  amount: number;
  signed?: boolean;
  perWeek?: boolean;
  /** Hide the currency unit (dense tables with the unit in the header). */
  unit?: boolean;
  /** Colour gains good and losses bad (words/signs still carry the meaning). */
  tone?: boolean;
  strong?: boolean;
  tip?: Tip;
  class?: string;
  focusable?: boolean;
}

export function Money({ amount, signed, perWeek, unit, tone, strong, tip, class: cls, focusable }: MoneyProps) {
  const toneCls = tone ? (amount > 0 ? 'u-good' : amount < 0 ? 'u-bad' : '') : '';
  const className = ['u-num', toneCls, strong ? 'u-strong' : '', cls ?? ''].filter(Boolean).join(' ');
  return (
    <span class={className} tabIndex={focusable ? 0 : undefined} {...tipAttrs(tip)}>
      {formatMoney(amount, { signed, perWeek, unit })}
    </span>
  );
}
