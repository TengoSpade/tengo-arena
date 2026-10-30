/**
 * Text of the fighter token (OVR, role label, class name): one seam so the skin runs in happy-dom tests with a counting
 * stub (no canvas 2D there) and the real viewer uses PixiJS BitmapText over fonts installed once per palette. A label
 * is created once per fighter per round and its text is set once: the frame loop never touches it (perf, 05 §8).
 *
 * Every kind is the arena ink with a plate-coloured stroke baked into its font, so the pair that already reaches 4.5:1
 * (ink on plate) is what the text is made of, whatever role colour or floor it sits on.
 */
import { BitmapFont, BitmapText, Container } from 'pixi.js';
import type { ArenaPalette } from '../../types';
import { uninstallFont } from '../../viewer/scene/text';

export type TokenTextKind = 'ovr' | 'small' | 'class';

export interface TokenText {
  readonly view: Container;
  /** Text height in px (the font is scaled to it). */
  setSize(px: number): void;
  setText(text: string): void;
  /** 0..1 anchor. */
  setAnchor(ax: number, ay: number): void;
  destroy(): void;
}

export interface TokenTextFactory {
  configure(palette: ArenaPalette): void;
  create(kind: TokenTextKind): TokenText;
  destroy(): void;
}

const FONT_UI = '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
const CHARS: (string | string[])[] = [[' ', '~'], '·–—×…✕−/'];
/** The size each kind's font is baked at (px); a label is scaled from it. */
const BAKED: Record<TokenTextKind, { size: number; weight: string; stroke: number }> = {
  ovr: { size: 32, weight: '800', stroke: 4 },
  small: { size: 16, weight: '700', stroke: 3 },
  class: { size: 16, weight: '600', stroke: 3 },
};

let seq = 0;

export function createPixiTokenText(resolution: number, initial: ArenaPalette): TokenTextFactory {
  const id = ++seq;
  let version = 0;
  let key = '';
  let fonts: string[] = [];
  let palette = initial;
  const labels = new Set<PixiTokenText>();
  const keyOf = (p: ArenaPalette): string => `${p.ink}|${p.plate}`;

  const fontFor = (kind: TokenTextKind): string => {
    const name = `al-token-${id}-${version}-${kind}`;
    if (fonts.includes(name)) return name;
    const b = BAKED[kind];
    BitmapFont.install({
      name,
      chars: CHARS,
      resolution,
      padding: 2,
      style: { fontFamily: FONT_UI, fontSize: b.size, fontWeight: b.weight as never, fill: palette.ink, stroke: { color: palette.plate, width: b.stroke, join: 'round' } },
    });
    fonts.push(name);
    return name;
  };

  class PixiTokenText implements TokenText {
    readonly view: BitmapText;
    constructor(private readonly kind: TokenTextKind) {
      this.view = new BitmapText({ text: '', style: { fontFamily: fontFor(kind), fontSize: BAKED[kind].size } });
    }
    restyle(): void {
      this.view.style = { fontFamily: fontFor(this.kind), fontSize: this.view.style.fontSize };
    }
    setSize(px: number): void {
      this.view.style.fontSize = px;
    }
    setText(text: string): void {
      if (this.view.text !== text) this.view.text = text;
    }
    setAnchor(ax: number, ay: number): void {
      this.view.anchor.set(ax, ay);
    }
    destroy(): void {
      labels.delete(this);
      if (!this.view.destroyed) this.view.destroy();
    }
  }

  key = keyOf(palette);
  return {
    create(kind) {
      const l = new PixiTokenText(kind);
      labels.add(l);
      return l;
    },
    configure(next) {
      palette = next;
      const k = keyOf(next);
      if (k === key) return;
      key = k;
      const old = fonts;
      fonts = [];
      version++;
      for (const l of labels) l.restyle();
      for (const name of old) uninstallFont(name);
    },
    destroy() {
      for (const name of fonts) uninstallFont(name);
      fonts = [];
      labels.clear();
    },
  };
}

/** A text seam with no glyphs that counts what is asked of it (tests). */
export function createStubTokenText(): TokenTextFactory & { readonly created: StubTokenText[]; configured: number } {
  const created: StubTokenText[] = [];
  const f = {
    created,
    configured: 0,
    create(kind: TokenTextKind) {
      const l = new StubTokenText(kind);
      created.push(l);
      return l;
    },
    configure() {
      f.configured++;
    },
    destroy() {
      for (const l of created) l.destroy();
    },
  };
  return f;
}

export class StubTokenText implements TokenText {
  readonly view = new Container();
  text = '';
  size = 0;
  textSets = 0;
  constructor(readonly kind: TokenTextKind) {}
  setSize(px: number): void {
    this.size = px;
  }
  setText(text: string): void {
    this.textSets++;
    this.text = text;
  }
  setAnchor(): void {}
  destroy(): void {
    if (!this.view.destroyed) this.view.destroy();
  }
}
