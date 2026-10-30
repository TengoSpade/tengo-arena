/**
 * Tooltip service (04 §6.2 "Tooltips everywhere a number appears").
 *
 * Any element carries a tip through data attributes, so tables can attach
 * tips to hundreds of cells without components or listeners per cell:
 *   <span {...tipAttrs('Plain text')}>12</span>
 *   <span {...tipAttrs({ kicker, title, body, rows, flavor, meta })}>62</span>
 * One <TooltipLayer/> (mounted by the app frame) shows them: hover opens
 * after the delay (280 ms, Settings), keyboard focus opens at once, Shift
 * pins the open tip, Esc closes. Markup follows components.css `.tooltip`.
 */
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

export interface TipRow {
  label: string;
  value: string;
  /** Total line (bold, rule above). */
  total?: boolean;
}

export interface TipContent {
  kicker?: string;
  title?: string;
  body?: string;
  /** Extra body lines (rule sentences, effect lines). */
  lines?: readonly string[];
  rows?: readonly TipRow[];
  flavor?: string;
  meta?: string;
}

export type Tip = string | TipContent;

const ATTR_PLAIN = 'data-tip';
const ATTR_RICH = 'data-tip-rich';
const SELECTOR = `[${ATTR_PLAIN}],[${ATTR_RICH}]`;

const ATTR_OVERFLOW = 'data-tip-overflow';

/**
 * A tip that only opens while the element's own text is clipped (an ellipsised name in a narrow
 * column). Full names stay one hover away without a tooltip on every name that already fits.
 */
export function overflowTipAttrs(text: string | null | undefined): Record<string, string> {
  return text ? { [ATTR_PLAIN]: text, [ATTR_OVERFLOW]: '' } : {};
}

/** True when an overflow-only tip has nothing hidden to reveal. */
function overflowTipIdle(el: Element): boolean {
  return el.hasAttribute(ATTR_OVERFLOW) && el instanceof HTMLElement && el.scrollWidth <= el.clientWidth + 1;
}

/** Attributes that attach a tip to any element. Empty object for no tip. */
export function tipAttrs(tip: Tip | null | undefined): Record<string, string> {
  if (tip === null || tip === undefined || tip === '') return {};
  if (typeof tip === 'string') return { [ATTR_PLAIN]: tip };
  return { [ATTR_RICH]: JSON.stringify(tip) };
}

/** Read the tip an element carries (exported for tests and the coverage check, ux-004). */
export function readTip(el: Element): Tip | null {
  const rich = el.getAttribute(ATTR_RICH);
  if (rich) {
    try {
      return JSON.parse(rich) as TipContent;
    } catch {
      return null;
    }
  }
  return el.getAttribute(ATTR_PLAIN);
}

/** Hover delay in ms (Settings > Interface > tooltip delay). */
export const tooltipDelayMs = signal(280);

interface OpenTip {
  target: Element;
  tip: Tip;
}

export function TooltipLayer() {
  const [open, setOpen] = useState<OpenTip | null>(null);
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinned = useRef(false);
  const current = useRef<Element | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const show = (el: Element, now: boolean) => {
      clear();
      const tip = readTip(el);
      if (!tip || overflowTipIdle(el)) return;
      const go = () => {
        current.current = el;
        setShown(false);
        setOpen({ target: el, tip });
      };
      if (now) go();
      else timer.current = setTimeout(go, tooltipDelayMs.value);
    };
    const hide = (force = false) => {
      clear();
      if (pinned.current && !force) return;
      pinned.current = false;
      current.current?.removeAttribute('aria-describedby');
      current.current = null;
      setOpen(null);
    };
    const onOver = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.(SELECTOR);
      if (el && el !== current.current) {
        pinned.current = false;
        show(el, false);
      }
    };
    const onOut = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.(SELECTOR);
      if (el && !(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) hide();
    };
    const onFocusIn = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.(SELECTOR);
      if (el) show(el, true);
    };
    const onFocusOut = () => hide();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && current.current) hide(true);
      else if (e.key === 'Shift' && current.current) pinned.current = true;
    };
    const onScroll = () => {
      if (!pinned.current) hide();
    };
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      clear();
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  // Place after the content renders (reads layout, then lets the fade-in run).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !open) return;
    if (!open.target.isConnected) {
      setOpen(null);
      return;
    }
    // A tooltip opened from inside a modal dialog must show above it: the dialog sits in the browser's top layer,
    // where no z-index reaches. A manual popover joins the top layer too (and later, so above the dialog).
    try {
      if (typeof el.showPopover === 'function' && !el.matches(':popover-open')) el.showPopover();
    } catch {
      /* no popover support: the tooltip shows as before */
    }
    const r = open.target.getBoundingClientRect();
    const tr = el.getBoundingClientRect();
    const gap = 8;
    let top = r.top - tr.height - gap;
    if (top < 8) top = r.bottom + gap;
    let left = r.left + r.width / 2 - tr.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));
    if (top + tr.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - tr.height - 8);
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
    open.target.setAttribute('aria-describedby', 'al-tooltip');
    setShown(true);
  }, [open]);

  if (!open) return null;
  const tip = open.tip;
  const plain = typeof tip === 'string';
  return (
    <div
      ref={ref}
      id="al-tooltip"
      role="tooltip"
      popover="manual"
      class={plain ? 'tooltip tooltip--plain' : 'tooltip'}
      data-open={shown ? '' : undefined}
      style={{ top: '-9999px', left: '0px' }}
    >
      {plain ? tip : <TipBody tip={tip} />}
    </div>
  );
}

export function TipBody({ tip }: { tip: TipContent }) {
  return (
    <>
      {tip.kicker && <div class="tooltip__kicker">{tip.kicker}</div>}
      {tip.title && <div class="tooltip__title">{tip.title}</div>}
      {tip.body && <div class="tooltip__body">{tip.body}</div>}
      {tip.lines?.map((line, i) => (
        <div key={i} class="tooltip__body">
          {line}
        </div>
      ))}
      {tip.rows && tip.rows.length > 0 && (
        <dl class="tooltip__rows">
          {tip.rows.map((row, i) => (
            <TipRowView key={i} row={row} />
          ))}
        </dl>
      )}
      {tip.flavor && <div class="tooltip__flavor">{tip.flavor}</div>}
      {tip.meta && <div class="tooltip__meta">{tip.meta}</div>}
    </>
  );
}

function TipRowView({ row }: { row: TipRow }) {
  return (
    <>
      <dt class={row.total ? 'is-total' : undefined}>{row.label}</dt>
      <dd class={row.total ? 'is-total' : undefined}>{row.value}</dd>
    </>
  );
}
