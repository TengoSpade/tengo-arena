/**
 * Text for the arena canvas. One small seam so the scene logic runs in happy-dom tests with a stub (no canvas 2D
 * there) and the real viewer uses PixiJS BitmapText over pre-installed bitmap fonts: glyphs are rendered once, so a
 * changing number allocates nothing and costs no per-label texture.
 *
 * Two kinds, as in the designer's marks (components.css §25):
 * - labels and the rule badge sit on plate chips: a white, un-stroked font tinted `ink` by the caller;
 * - floating numbers have no chip and carry a plate-coloured stroke so text keeps 4.5:1 on any floor: a font per tone
 *   with the tone colour and the plate stroke baked in (a tint cannot recolour a stroke separately).
 * Fonts are re-baked when the palette (theme) or the label size (interface scale) changes (`configure`).
 */
import { BitmapFont, BitmapText, Cache, Container } from 'pixi.js';
import type { ArenaPalette } from '../../types';
import { toneColor, type Tone } from '../palette';

/** One piece of canvas text, reused across frames. */
export interface TextLabel {
  readonly view: Container;
  setText(text: string): void;
  /** Fill colour of a label or badge (tinted). A number's colour is its tone, baked into its font. */
  setColor(color: number): void;
  /** 0..1 anchor, like PixiJS. */
  setAnchor(ax: number, ay: number): void;
  /** Width of the current text at scale 1, in px. */
  readonly width: number;
  /** Remove from the factory's bookkeeping and destroy the view. */
  dispose(): void;
}

export type LabelKind = 'label' | 'badge';

export interface TextFactory {
  /** Text on a plate chip: tinted by the caller (ink). `badge` is the monospace rule badge. */
  label(kind: LabelKind): TextLabel;
  /** A floating number: the tone colour with a plate stroke; `crit` is the larger size. */
  number(tone: Tone, crit: boolean): TextLabel;
  /** The palette or the label size changed: re-bake fonts and restyle every label. */
  configure(palette: ArenaPalette): void;
  destroy(): void;
}

const FONT_UI = '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
const FONT_MONO = '"Cascadia Mono", Consolas, "Courier New", monospace';
/** Everything the arena prints: ASCII plus the few typographic marks the labels use (the minus is U+2212). */
const LABEL_CHARS: (string | string[])[] = [[' ', '~'], '·–—×…✕−'];
const NUMBER_CHARS = '0123456789+−-!';
/** Number size relative to the label size (--fs-md over --fs-xs), and the crit factor (--k: 1.3). */
const NUMBER_SCALE = 1.35;
const CRIT_SCALE = 1.3;
/** Plate stroke around a number, px (the designer's text-shadow reaches 2 px). */
const NUMBER_STROKE_PX = 4;

let factorySeq = 0;

/**
 * Uninstall a bitmap font without PixiJS's "[BindGroup] a 'textureSource' was destroyed while still bound to a shader"
 * warnings. A label of 50 or more glyphs is too big to batch and is drawn as a graphic of its own, whose texture bind
 * group PixiJS caches for good; that group lists the font's page (its source and sampler) and listens to them, so
 * destroying the page warns, one pair per font, whenever such a label was ever drawn (a long "Captain X downed by Y ·
 * Ability" callout, a long name). Nothing draws the font any more when it is released: drop those listeners first.
 */
export function uninstallFont(name: string): void {
  const key = `${name}-bitmap`;
  if (!Cache.has(key)) return; // (Cache.get and BitmapFont.uninstall warn about a font that is not installed)
  const font = Cache.get<{ pages?: { texture?: { source?: { removeAllListeners(event?: string): unknown; style?: { removeAllListeners(event?: string): unknown } | null } } }[] } | undefined>(key);
  for (const page of font?.pages ?? []) {
    const source = page.texture?.source;
    source?.style?.removeAllListeners('change');
    source?.removeAllListeners('change');
  }
  BitmapFont.uninstall(name);
}

type Spec = { kind: 'label' | 'badge' } | { kind: 'number'; tone: Tone; crit: boolean };

/** PixiJS BitmapText labels over pre-installed fonts; `resolution` is the renderer's, so text stays sharp at DPR 2. */
export function createPixiTextFactory(resolution: number, initial: ArenaPalette): TextFactory {
  const id = ++factorySeq;
  let version = 0;
  let palette = initial;
  let installedKey = '';
  let fonts: string[] = [];
  const labels = new Set<PixiLabel>();

  const sizeOf = (spec: Spec): number => {
    const base = palette.metrics.labelSizePx;
    return spec.kind === 'number' ? base * NUMBER_SCALE * (spec.crit ? CRIT_SCALE : 1) : base;
  };

  const install = (name: string, chars: string | (string | string[])[], style: Record<string, unknown>): string => {
    BitmapFont.install({ name, chars, resolution, padding: 2, style: style as never });
    fonts.push(name);
    return name;
  };

  /** The font of a spec for the current version, installed on first use. */
  const fontFor = (spec: Spec): string => {
    const size = sizeOf(spec);
    if (spec.kind === 'number') {
      const name = `al-${id}-${version}-num-${spec.tone}-${spec.crit ? 'c' : 'n'}`;
      if (fonts.includes(name)) return name;
      return install(name, NUMBER_CHARS, {
        fontFamily: FONT_UI,
        fontSize: size,
        fontWeight: '700',
        fill: toneColor(spec.tone, palette),
        stroke: { color: palette.plate, width: NUMBER_STROKE_PX, join: 'round' },
      });
    }
    const name = `al-${id}-${version}-${spec.kind}`;
    if (fonts.includes(name)) return name;
    return install(name, LABEL_CHARS, {
      fontFamily: spec.kind === 'badge' ? FONT_MONO : FONT_UI,
      fontSize: size,
      fontWeight: spec.kind === 'badge' ? '700' : '600',
      fill: 0xffffff,
    });
  };

  class PixiLabel implements TextLabel {
    readonly view: BitmapText;
    constructor(private readonly spec: Spec) {
      this.view = new BitmapText({ text: '', style: { fontFamily: fontFor(spec), fontSize: sizeOf(spec) } });
      labels.add(this);
    }
    restyle(): void {
      this.view.style = { fontFamily: fontFor(this.spec), fontSize: sizeOf(this.spec) };
    }
    setText(text: string): void {
      if (this.view.text !== text) this.view.text = text;
    }
    setColor(color: number): void {
      if (this.spec.kind !== 'number') this.view.tint = color;
    }
    setAnchor(ax: number, ay: number): void {
      this.view.anchor.set(ax, ay);
    }
    get width(): number {
      return this.view.width / (this.view.scale.x || 1);
    }
    dispose(): void {
      labels.delete(this);
      if (!this.view.destroyed) this.view.destroy();
    }
  }

  const keyOf = (p: ArenaPalette): string => `${p.plate}|${p.metrics.labelSizePx}|${[p.fxPhysical, p.fxArcane, p.fxTrue, p.fxHeal, p.fxShield, p.ink].join(',')}`;
  installedKey = keyOf(palette);

  return {
    label: (kind) => new PixiLabel({ kind }),
    number: (tone, crit) => new PixiLabel({ kind: 'number', tone, crit }),
    configure(next) {
      palette = next;
      const key = keyOf(next);
      if (key === installedKey) return;
      installedKey = key;
      // New fonts under a new version, every label moved over, then the old fonts released.
      const old = fonts;
      fonts = [];
      version++;
      for (const label of labels) label.restyle();
      for (const name of old) uninstallFont(name);
    },
    destroy() {
      for (const name of fonts) uninstallFont(name);
      fonts = [];
      labels.clear();
    },
  };
}

// ---- the stub (tests, hosts without a canvas 2D) -----------------------------------------------------------------

/** A text factory with no glyphs: labels are empty containers that remember their text (tests). */
export function createStubTextFactory(): TextFactory & { readonly created: StubLabel[]; configured: ArenaPalette[] } {
  const created: StubLabel[] = [];
  const configured: ArenaPalette[] = [];
  return {
    created,
    configured,
    label(kind) {
      const l = new StubLabel(kind);
      created.push(l);
      return l;
    },
    number(tone, crit) {
      const l = new StubLabel(`number:${tone}${crit ? ':crit' : ''}`);
      created.push(l);
      return l;
    },
    configure(palette) {
      configured.push(palette);
    },
    destroy() {
      for (const label of created) if (!label.view.destroyed) label.view.destroy();
      created.length = 0;
    },
  };
}

export class StubLabel implements TextLabel {
  readonly view = new Container();
  text = '';
  color = 0xffffff;
  disposed = false;
  constructor(readonly kind: string) {}
  setText(text: string): void {
    this.text = text;
  }
  setColor(color: number): void {
    this.color = color;
  }
  setAnchor(): void {}
  get width(): number {
    return this.text.length * 6;
  }
  dispose(): void {
    this.disposed = true;
    if (!this.view.destroyed) this.view.destroy();
  }
}
