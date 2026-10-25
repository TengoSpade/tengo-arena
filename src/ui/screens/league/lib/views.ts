/**
 * The core view functions WP7 screens call, wrapped so a module that is
 * still a contract stub (NotImplementedError during the parallel build) or a
 * view that fails shows an inline "not available" state instead of crashing
 * the screen. Rules stay in core: nothing here computes game values.
 */
import { NotImplementedError } from '../../../../core/util';

export type View<T> = { ok: true; value: T } | { ok: false; error: string; notImplemented: boolean };

export function tryView<T>(fn: () => T): View<T> {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    const notImplemented = e instanceof NotImplementedError;
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, error, notImplemented };
  }
}

/** Value or fallback, for small decorations (a tooltip number) where an inline error would be noise. */
export function viewOr<T>(fn: () => T, fallback: T): T {
  const v = tryView(fn);
  return v.ok ? v.value : fallback;
}
