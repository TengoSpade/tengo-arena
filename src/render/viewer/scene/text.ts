/**
 * Text for the arena canvas (labels, the rule badge, numbers, callouts). One small seam so the scene logic runs in
 * happy-dom tests with a stub (no canvas 2D there) and the real viewer uses PixiJS BitmapText: glyphs come from a
 * few pre-installed bitmap fonts (white fill, dark outline) tinted per label, so text costs no per-label texture and
 * a changing number allocates nothing.
 */
import { BitmapFont, BitmapText, Container } from 'pixi.js';

/** One piece of canvas text, reused across frames. */
export interface TextLabel {
  readonly view: Container;
  setText(text: string): void;
  /** Fill colour (the outline stays dark). */
  setTint(color: number): void;
  /** 0..1 anchor, like PixiJS. */
  setAnchor(ax: number, ay: number): void;
  /** Width of the current text at scale 1, in px. */
  readonly width: number;
}

/** The three text sizes the arena uses (px at 100% interface scale and 1080p). */
export type TextSize = 'small' | 'normal' | 'large';

export interface TextFactory {
  create(size: TextSize): TextLabel;
  destroy(): void;
}

const SIZE_PX: Record<TextSize, number> = { small: 10, normal: 12, large: 17 };
const FONT_FAMILY = '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
/** Everything the arena prints: ASCII plus the few typographic marks the labels use. */
const CHARS: (string | string[])[] = [[' ', '~'], '·–—×…✕'];

let fontSeq = 0;

/** PixiJS BitmapText labels over pre-installed fonts; `resolution` is the renderer's, so text stays sharp at DPR 2. */
export function createPixiTextFactory(resolution: number, fontFamily: string = FONT_FAMILY): TextFactory {
  const prefix = `al-arena-${++fontSeq}`;
  const names: string[] = [];
  const nameOf = (size: TextSize): string => `${prefix}-${size}`;
  let installed = false;
  const ensureFonts = (): void => {
    if (installed) return;
    installed = true;
    for (const size of Object.keys(SIZE_PX) as TextSize[]) {
      const name = nameOf(size);
      names.push(name);
      BitmapFont.install({
        name,
        chars: CHARS,
        resolution,
        padding: 2,
        style: {
          fontFamily,
          fontSize: SIZE_PX[size],
          fontWeight: size === 'normal' ? '600' : '700',
          fill: 0xffffff,
          stroke: { color: 0x000000, width: size === 'large' ? 4 : 3, join: 'round' },
        },
      });
    }
  };
  return {
    create(size) {
      ensureFonts();
      const text = new BitmapText({ text: '', style: { fontFamily: nameOf(size), fontSize: SIZE_PX[size] } });
      return {
        view: text,
        setText(value) {
          if (text.text !== value) text.text = value;
        },
        setTint(color) {
          text.tint = color;
        },
        setAnchor(ax, ay) {
          text.anchor.set(ax, ay);
        },
        get width() {
          return text.width / (text.scale.x || 1);
        },
      };
    },
    destroy() {
      for (const name of names) BitmapFont.uninstall(name);
      names.length = 0;
      installed = false;
    },
  };
}

/** A text factory with no glyphs: labels are empty containers that remember their text (tests, no-canvas hosts). */
export function createStubTextFactory(): TextFactory & { readonly created: StubLabel[] } {
  const created: StubLabel[] = [];
  return {
    created,
    create() {
      const label = new StubLabel();
      created.push(label);
      return label;
    },
    destroy() {
      for (const label of created) label.view.destroy();
      created.length = 0;
    },
  };
}

export class StubLabel implements TextLabel {
  readonly view = new Container();
  text = '';
  tint = 0xffffff;
  setText(text: string): void {
    this.text = text;
  }
  setTint(color: number): void {
    this.tint = color;
  }
  setAnchor(): void {}
  get width(): number {
    return this.text.length * 6;
  }
}
