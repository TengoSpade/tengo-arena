/**
 * Finance charts (04 ui-finances): money by week (income above the line,
 * costs below; one axis in currency per week) and the balance through the
 * season with the projection to season end. Two charts, never a dual axis.
 * The designer's `.chart` classes; every column carries a tooltip.
 */
import type { ContentDB } from '../../../core/content';
import { fmtInt, fmtMoney } from '../league/lib/format';
import { t } from './text';

export interface WeekMoney {
  weekIndex: number;
  id: string;
  income: number;
  costs: number;
  /** Balance at the end of the week (after processing), null for future weeks. */
  balanceAfter: number | null;
}

const W = 640;
const H = 210;
const PAD = { l: 52, r: 12, t: 14, b: 26 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = 10 ** exp;
  const m = v / base;
  const step = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return step * base;
}

export function WeeklyChart({ content, weeks }: { content: ContentDB; weeks: WeekMoney[] }) {
  const max = niceMax(Math.max(1, ...weeks.map((w) => Math.max(w.income, -w.costs))));
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const zeroY = PAD.t + plotH / 2;
  const band = plotW / Math.max(1, weeks.length);
  const barW = Math.max(3, band * 0.56);
  const y = (v: number) => zeroY - (v / max) * (plotH / 2);
  return (
    <svg class="chart finance-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('chart.weekly')} data-testid="chart-weekly">
      <g class="chart__grid">
        <line x1={PAD.l} x2={W - PAD.r} y1={y(max)} y2={y(max)} />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(-max)} y2={y(-max)} />
      </g>
      <g class="chart__axis">
        <line x1={PAD.l} x2={W - PAD.r} y1={zeroY} y2={zeroY} />
      </g>
      <text x={PAD.l - 6} y={y(max) + 4} text-anchor="end">
        {fmtInt(max)}
      </text>
      <text x={PAD.l - 6} y={zeroY + 4} text-anchor="end">
        0
      </text>
      <text x={PAD.l - 6} y={y(-max) + 4} text-anchor="end">
        {fmtInt(-max)}
      </text>
      {weeks.map((w, i) => {
        const x = PAD.l + i * band + (band - barW) / 2;
        const played = w.balanceAfter !== null;
        const tip = t('chart.weekTip', {
          week: w.id,
          income: fmtMoney(w.income, content),
          costs: fmtMoney(-w.costs, content),
          net: fmtMoney(w.income + w.costs, content, { signed: true }),
        });
        return (
          <g key={w.id} class="finance-chart__col" data-tip={played ? tip : undefined}>
            <rect class="finance-chart__hit" x={PAD.l + i * band} y={PAD.t} width={band} height={plotH} />
            {w.income > 0 && <rect class="chart__bar chart__bar--us" x={x} y={y(w.income)} width={barW} height={zeroY - y(w.income) - 1} rx={2} />}
            {w.costs < 0 && <rect class="chart__bar" x={x} y={zeroY + 1} width={barW} height={y(w.costs) - zeroY - 1} rx={2} />}
            {(i % 4 === 0 || i === weeks.length - 1) && (
              <text x={PAD.l + i * band + band / 2} y={H - 8} text-anchor="middle">
                {w.id}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function BalanceChart({
  content,
  weeks,
  opening,
  projected,
  markers,
}: {
  content: ContentDB;
  weeks: WeekMoney[];
  opening: number;
  projected: number | null;
  markers: { weekIndex: number; label: string }[];
}) {
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const n = weeks.length;
  const booked = weeks.filter((w) => w.balanceAfter !== null);
  const values = [opening, ...booked.map((w) => w.balanceAfter!), ...(projected !== null ? [projected] : [])];
  const hi = niceMax(Math.max(1, ...values));
  const lo = Math.min(0, ...values);
  const loNice = lo < 0 ? -niceMax(-lo) : 0;
  const x = (i: number) => PAD.l + (i / Math.max(1, n)) * plotW;
  const y = (v: number) => PAD.t + ((hi - v) / (hi - loNice)) * plotH;
  const pts = [`${x(0)},${y(opening)}`, ...booked.map((w, i) => `${x(i + 1)},${y(w.balanceAfter!)}`)];
  const last = booked.length;
  const lastVal = last > 0 ? booked[last - 1]!.balanceAfter! : opening;
  return (
    <svg class="chart finance-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('chart.balance')} data-testid="chart-balance">
      <g class="chart__grid">
        <line x1={PAD.l} x2={W - PAD.r} y1={y(hi)} y2={y(hi)} />
        <line x1={PAD.l} x2={W - PAD.r} y1={y((hi + loNice) / 2)} y2={y((hi + loNice) / 2)} />
      </g>
      <g class="chart__axis">
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} />
      </g>
      <text x={PAD.l - 6} y={y(hi) + 4} text-anchor="end">
        {fmtInt(hi)}
      </text>
      <text x={PAD.l - 6} y={y(0) + 4} text-anchor="end">
        0
      </text>
      {loNice < 0 && (
        <text x={PAD.l - 6} y={y(loNice) + 4} text-anchor="end">
          {fmtInt(loNice)}
        </text>
      )}
      {markers.map((m) => {
        const i = weeks.findIndex((w) => w.weekIndex === m.weekIndex);
        if (i < 0) return null;
        const mx = x(i + 0.5);
        return (
          <g key={`${m.label}-${m.weekIndex}`}>
            <line class="chart__marker-line" x1={mx} x2={mx} y1={PAD.t} y2={PAD.t + plotH} />
            <text class="chart__marker-label" x={mx + 4} y={PAD.t + 10}>
              {m.label}
            </text>
          </g>
        );
      })}
      <polyline class="chart__curve" points={pts.join(' ')} />
      {projected !== null && last < n && <line class="chart__curve chart__curve--dashed" x1={x(last)} y1={y(lastVal)} x2={x(n)} y2={y(projected)} />}
      <circle class="chart__marker" cx={x(last)} cy={y(lastVal)} r={5} data-tip={fmtMoney(lastVal, content)} />
      {projected !== null && last < n && <circle class="chart__point" cx={x(n)} cy={y(projected)} r={4} data-tip={`${t('chart.projected')}: ${fmtMoney(projected, content)}`} />}
      {weeks.map((w, i) =>
        i % 4 === 0 || i === n - 1 ? (
          <text key={w.id} x={x(i + 1)} y={H - 8} text-anchor="middle">
            {w.id}
          </text>
        ) : null,
      )}
    </svg>
  );
}
