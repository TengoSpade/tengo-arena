/**
 * Attribute bar on the absolute 1-20 scale (04 ui-fighter): band colour,
 * band ticks at 5/10/15, the ceiling as a tick (`cap`), age wear as a
 * hatched segment up to `peak`, a fuzzy range up to `max` (M4), the value
 * and the change this season.
 */
import type { JSX } from 'preact';
import { attributeBand } from '../format';
import { Delta } from './marks';
import { tipAttrs, type Tip } from './Tooltip';

export interface StatBarProps {
  label: string;
  value: number;
  /** Ceiling (1-20) drawn as a tick. */
  cap?: number | null;
  /** Value before age wear; draws the hatched wear segment. */
  peak?: number | null;
  /** Upper end of a fuzzy range (M4 scouting). */
  max?: number | null;
  /** Change this season; null hides the column content. */
  delta?: number | null;
  tip?: Tip;
  scale?: number;
}

export function StatBar({ label, value, cap, peak, max, delta, tip, scale }: StatBarProps) {
  const style: JSX.CSSProperties & Record<string, string | number> = { '--v': value };
  if (cap !== null && cap !== undefined) style['--cap'] = cap;
  if (peak !== null && peak !== undefined && peak > value) style['--peak'] = peak;
  if (max !== null && max !== undefined) style['--max'] = max;
  if (scale) style['--scale'] = scale;
  return (
    <div class="stat-bar" data-band={attributeBand(value)} style={style} tabIndex={0} {...tipAttrs(tip)}>
      <span class="stat-bar__label">{label}</span>
      <span class="stat-bar__track">
        <span class="stat-bar__fill" />
        {max !== null && max !== undefined && max > value && <span class="stat-bar__range" />}
        {peak !== null && peak !== undefined && peak > value && <span class="stat-bar__wear" />}
        {cap !== null && cap !== undefined && <span class="stat-bar__cap" />}
      </span>
      <span class="stat-bar__value">{value}</span>
      <span class="stat-bar__delta">{delta !== null && delta !== undefined && <Delta value={delta} />}</span>
    </div>
  );
}
