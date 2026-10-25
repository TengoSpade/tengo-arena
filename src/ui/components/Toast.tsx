/**
 * Toast service with Undo (04 §6.2 notification budget, D-M).
 * - Toasts confirm the player's own actions only; at most 3 stacked;
 *   5 s, or 8 s with Undo (TUNABLE).
 * - Reversible changes show "Undo (Ctrl Z)"; undoLast() runs the newest
 *   pending undo (the app maps Ctrl Z to it). Undo callbacks dispatch the
 *   inverse command, so Undo is a command, not a UI trick.
 */
import { signal } from '@preact/signals';
import { t } from '../text';
import { Icon } from './Icon';

export type ToastKind = 'good' | 'bad' | 'info' | 'accent';

export interface ToastOptions {
  title: string;
  sub?: string;
  kind?: ToastKind;
  /** Reverses the change; shows the Undo button and registers Ctrl Z. */
  undo?: () => void;
  /** Extra action, e.g. "Open report". */
  action?: { label: string; onClick: () => void };
  /** Override the display time in ms. */
  durationMs?: number;
}

export interface ToastItem extends ToastOptions {
  id: number;
  leaving: boolean;
}

export const TOAST_LIMIT = 3;
export const TOAST_MS = 5000;
export const TOAST_UNDO_MS = 8000;

export const toasts = signal<readonly ToastItem[]>([]);
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
/** Pending undos, newest last. */
const undoStack: { toastId: number; undo: () => void }[] = [];

export function showToast(options: ToastOptions): number {
  const id = nextId++;
  const item: ToastItem = { ...options, id, leaving: false };
  let list = [...toasts.value, item];
  while (list.length > TOAST_LIMIT) {
    const dropped = list[0]!;
    list = list.slice(1);
    clearTimer(dropped.id);
  }
  toasts.value = list;
  if (options.undo) undoStack.push({ toastId: id, undo: options.undo });
  const ms = options.durationMs ?? (options.undo ? TOAST_UNDO_MS : TOAST_MS);
  timers.set(
    id,
    setTimeout(() => dismissToast(id), ms),
  );
  return id;
}

function clearTimer(id: number): void {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
}

export function dismissToast(id: number): void {
  clearTimer(id);
  const i = undoStack.findIndex((u) => u.toastId === id);
  if (i >= 0) undoStack.splice(i, 1);
  toasts.value = toasts.value.filter((x) => x.id !== id);
}

/** Run the newest pending undo (Ctrl Z). Returns false when there is nothing to undo. */
export function undoLast(): boolean {
  const entry = undoStack.pop();
  if (!entry) return false;
  dismissToast(entry.toastId);
  entry.undo();
  return true;
}

export function hasUndo(): boolean {
  return undoStack.length > 0;
}

/** Test helper: drop every toast and undo. */
export function resetToasts(): void {
  for (const id of timers.keys()) clearTimer(id);
  undoStack.length = 0;
  toasts.value = [];
}

const KIND_ICON = { good: 'check', bad: 'warning', info: 'info', accent: 'info' } as const;

export function ToastRegion() {
  const list = toasts.value;
  return (
    <div class="toast-region" role="status" aria-live="polite" data-testid="toast-region">
      {list.map((item) => (
        <div key={item.id} class={`toast${item.kind && item.kind !== 'accent' ? ` toast--${item.kind}` : ''}`}>
          <Icon name={KIND_ICON[item.kind ?? 'accent']} />
          <div class="toast__text">
            <div class="toast__title">{item.title}</div>
            {item.sub && <div class="toast__sub">{item.sub}</div>}
          </div>
          {item.action && (
            <button
              class="btn btn--sm btn--ghost toast__action"
              type="button"
              onClick={() => {
                dismissToast(item.id);
                item.action!.onClick();
              }}
            >
              {item.action.label}
            </button>
          )}
          {item.undo && (
            <button
              class="btn btn--sm btn--ghost toast__action"
              type="button"
              onClick={() => {
                dismissToast(item.id);
                item.undo!();
              }}
            >
              <Icon name="undo" />
              {t('common.undo')} <kbd>Ctrl Z</kbd>
            </button>
          )}
          <button class="icon-btn" type="button" aria-label={t('common.dismiss')} onClick={() => dismissToast(item.id)}>
            <Icon name="close" />
          </button>
        </div>
      ))}
    </div>
  );
}
