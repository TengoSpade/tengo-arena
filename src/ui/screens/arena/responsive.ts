/**
 * The scrubber track's width in CSS pixels, to merge marks that would touch. 0 until measured and without a layout engine
 * (the test DOM), where nothing merges.
 */
import { useLayoutEffect, useState } from 'preact/hooks';
import type { RefObject } from 'preact';

/** The element's current width in CSS pixels (0 until measured, and without a layout engine). */
export function useElementWidth(ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = (): void => setWidth(Math.round(el.getBoundingClientRect().width));
    read();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(read) : null;
    ro?.observe(el);
    window.addEventListener('resize', read);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', read);
    };
  }, []);
  return width;
}
