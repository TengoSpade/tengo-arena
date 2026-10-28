/**
 * Pointer input on the canvas (05-technical-m2 §A7, A18 decision 3). A click selects the token under it (empty floor
 * clears the selection) and reports it through onSelect, so the UI can focus that fighter's card in the strip; moving
 * over a token shows a pointer. The keyboard belongs to the UI: Tab selection moves through the fighter strip's ten card
 * buttons (focus is selection), so the canvas is one tab stop (role="img") that never cycles internally and never traps
 * focus. Hit-testing is the scene's, over the same transform as drawing.
 */
import type { ViewerCore } from './core';

export interface InputOptions {
  canvas: HTMLCanvasElement;
  core: ViewerCore;
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
    const p = local(e);
    core.pointerSelect(p.x, p.y);
  };
  const onMove = (e: PointerEvent): void => {
    const p = local(e);
    canvas.style.cursor = core.hit(p.x, p.y) !== null ? 'pointer' : 'default';
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
  };
}
