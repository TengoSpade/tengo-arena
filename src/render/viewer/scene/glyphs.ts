/**
 * Glyph shapes from the palette's SVG markup (the `--glyph-*` and `--glyph-pip-*` tokens decoded by the host: one
 * source for the UI and the arena). A glyph is drawn white and centred on (0, 0) in a `size` px box, so a tint decides
 * its colour with no redraw.
 */
import { Graphics } from 'pixi.js';

/** Fallback outlines (24-unit box) for the D-J role shapes, used only when the palette carries no usable SVG. */
const ROLE_FALLBACK: Record<string, number[]> = {
  tank: [12, 1.5, 21, 5, 21, 11.2, 19, 16, 12, 22.5, 5, 16, 3, 11.2, 3, 5],
  melee: [12, 1, 22.5, 12, 12, 23, 1.5, 12],
  ranged: [12, 2, 23, 21.5, 1, 21.5],
  controller: [3, 2, 21, 2, 14, 12, 21, 22, 3, 22, 10, 12],
};

/**
 * Build a glyph from SVG markup. `fallbackRole` names a built-in role outline (or 'healer', a circle with a cross)
 * for when the markup is empty or cannot be parsed; anything else falls back to a plain disc.
 */
export function buildGlyph(svg: string, size: number, fallbackRole?: string): Graphics {
  const g = new Graphics();
  g.eventMode = 'none';
  const scale = size / 24;
  let drawn = false;
  if (svg) {
    try {
      // Force a white fill so a tint decides the colour; every other attribute (fill-rule) stays.
      g.svg(svg.replace(/\sfill=("[^"]*"|'[^']*')/g, '').replace(/<path\s/g, "<path fill='white' "));
      drawn = g.context.instructions.length > 0;
    } catch {
      drawn = false;
    }
  }
  if (!drawn) {
    g.clear();
    if (fallbackRole === 'healer') {
      g.circle(12, 12, 10.5).fill({ color: 0xffffff });
      g.rect(10.3, 6.3, 3.4, 11.4).cut();
      g.rect(6.3, 10.3, 11.4, 3.4).cut();
    } else if (fallbackRole && ROLE_FALLBACK[fallbackRole]) {
      g.poly(ROLE_FALLBACK[fallbackRole]!).fill({ color: 0xffffff });
    } else {
      g.circle(12, 12, 8).fill({ color: 0xffffff });
    }
  }
  g.scale.set(scale);
  g.position.set(-12 * scale, -12 * scale);
  return g;
}
