/**
 * A plate chip with text (labels, tags, names, the cast bar, the rule badge, "+n", the telegraph's ability name, the
 * down callout): a plate rectangle with an edge hairline inside it, the text in ink, the width following the text
 * (arena-notes.md §1; components.css .alabel, .atag, .acast, .arule).
 */
import { Container, Graphics } from 'pixi.js';
import type { ArenaPalette } from '../../types';
import { DESTROY_ALL } from '../destroy';
import type { LabelKind, TextFactory, TextLabel } from './text';

/** What a chip needs from its scene: the palette, and a number that changes whenever drawings must refresh. */
export interface ChipEnv {
  palette: ArenaPalette;
  /** Bumped on every relayout or palette change so cached drawings refresh. */
  version: number;
}

export class Chip {
  readonly view = new Container();
  private readonly bg = new Graphics();
  private readonly fill = new Graphics();
  readonly label: TextLabel;
  w = 0;
  private text = '';
  private textW = 0;
  private drawn = '';

  constructor(text: TextFactory, kind: LabelKind) {
    this.view.eventMode = 'none';
    this.label = text.label(kind);
    this.label.setAnchor(0.5, 0.5);
    this.view.addChild(this.bg, this.fill, this.label.view);
  }

  get content(): string {
    return this.text;
  }

  /**
   * Lay out `text` in a chip of height `h`; returns its width. `progress` (0..1) adds the cast bar's fill; `keyline`
   * is a colour for a thin outline in place of the edge hairline (the callout's side colour).
   */
  set(text: string, env: ChipEnv, o: { minW: number; padX: number; h: number; progress?: number; edge?: number }): number {
    const p = env.palette;
    if (this.text !== text) {
      this.text = text;
      this.label.setText(text);
      this.textW = this.label.width;
    }
    this.label.setColor(p.ink);
    const w = Math.max(o.minW, this.textW + o.padX * 2);
    const px = o.progress === undefined ? -1 : Math.round(Math.max(0, Math.min(1, o.progress)) * w);
    const edge = o.edge ?? p.edge;
    const key = `${w.toFixed(1)}|${o.h}|${px}|${edge}|${env.version}`;
    if (key !== this.drawn) {
      this.drawn = key;
      this.bg.clear().roundRect(0, 0, w, o.h, 3).fill({ color: p.plate }).roundRect(0.5, 0.5, w - 1, o.h - 1, 3).stroke({ width: 1, color: edge });
      this.fill.clear();
      if (px > 0) this.fill.rect(1, 1, Math.max(0, Math.min(px, w) - 2), o.h - 2).fill({ color: p.telegraph, alpha: 0.28 });
    }
    this.label.view.position.set(w / 2, o.h / 2);
    this.w = w;
    return w;
  }

  dispose(): void {
    this.label.dispose();
    if (!this.view.destroyed) this.view.destroy(DESTROY_ALL);
  }
}
