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
  private dw = -1;
  private dh = -1;
  private dpx = -2;
  private dedge = -1;
  private dversion = -1;

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
   * Lay out `text` in a chip `h` high, at least `minW` wide with `padX` either side; returns its width. `progress`
   * (0..1, or -1 for none) adds the cast bar's fill; `edge` (a colour, or -1) replaces the hairline colour (the
   * callout's side colour). Numeric arguments and fields only: a frame that changes nothing allocates nothing.
   */
  set(text: string, env: ChipEnv, minW: number, padX: number, h: number, progress = -1, edge = -1): number {
    const p = env.palette;
    if (this.text !== text) {
      this.text = text;
      this.label.setText(text);
      this.textW = this.label.width;
    }
    this.label.setColor(p.ink);
    const w = Math.max(minW, this.textW + padX * 2);
    const px = progress < 0 ? -1 : Math.round(Math.min(1, progress) * w);
    const edgeColor = edge >= 0 ? edge : p.edge;
    if (w !== this.dw || h !== this.dh || px !== this.dpx || edgeColor !== this.dedge || env.version !== this.dversion) {
      this.dw = w;
      this.dh = h;
      this.dpx = px;
      this.dedge = edgeColor;
      this.dversion = env.version;
      this.bg.clear().roundRect(0, 0, w, h, 3).fill({ color: p.plate }).roundRect(0.5, 0.5, w - 1, h - 1, 3).stroke({ width: 1, color: edgeColor });
      this.fill.clear();
      if (px > 0) this.fill.rect(1, 1, Math.max(0, Math.min(px, w) - 2), h - 2).fill({ color: p.telegraph, alpha: p.metrics.telegraphProgressAlpha });
    }
    this.label.view.position.set(w / 2, h / 2);
    this.w = w;
    return w;
  }

  dispose(): void {
    this.label.dispose();
    if (!this.view.destroyed) this.view.destroy(DESTROY_ALL);
  }
}
