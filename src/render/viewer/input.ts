/**
 * Pointer and keyboard input on the canvas (05-technical-m2 §A7, 04 §9). The canvas takes focus; a click selects the
 * token under it (empty floor clears the selection); while it has focus, Tab / Shift+Tab walk the tokens (and leave at
 * either end, so there is no keyboard trap) and Escape clears the selection. Every other key belongs to the UI
 * (Space, speeds, seeking, labels...), which owns the transport shortcuts. Hit-testing is the scene's, over the same
 * transform as drawing.
 */
import type { ViewerCore } from './core';

export interface InputOptions {
  canvas: HTMLCanvasElement;
  core: ViewerCore;
  /** Handle Tab / Shift+Tab / Escape on the canvas (default true). Off when the UI binds them itself. */
  keys: boolean;
  /** Colour of the focus outline (palette text), for `:focus-visible`. */
  focusColor(): number;
}

/** Wire the listeners; returns the function that removes them. */
export function attachInput(o: InputOptions): () => void {
  const { canvas, core } = o;
  const local = (e: PointerEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    canvas.focus({ preventScroll: true });
    const p = local(e);
    core.pointerSelect(p.x, p.y);
  };
  const onMove = (e: PointerEvent): void => {
    const p = local(e);
    canvas.style.cursor = core.hit(p.x, p.y) !== null ? 'pointer' : 'default';
  };
  const onKey = (e: KeyboardEvent): void => {
    if (!o.keys || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Tab') {
      if (core.cycleSelection(e.shiftKey ? -1 : 1)) {
        e.preventDefault();
        e.stopPropagation();
      }
    } else if (e.key === 'Escape') {
      if (core.clearSelectionFromKeyboard()) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };
  const onFocus = (): void => {
    let visible: boolean;
    try {
      visible = canvas.matches(':focus-visible');
    } catch {
      visible = true;
    }
    canvas.style.outline = visible ? `2px solid #${o.focusColor().toString(16).padStart(6, '0')}` : '';
    canvas.style.outlineOffset = '-2px';
  };
  const onBlur = (): void => {
    canvas.style.outline = '';
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('focus', onFocus);
  canvas.addEventListener('blur', onBlur);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('keydown', onKey);
    canvas.removeEventListener('focus', onFocus);
    canvas.removeEventListener('blur', onBlur);
  };
}
