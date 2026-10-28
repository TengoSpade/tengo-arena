/**
 * The viewer follows the UI designer's specification (arena-notes.md §1, components.css §25; A18): every colour,
 * alpha, size and duration comes from `palette` and `palette.metrics` (a different palette gives a different token),
 * the stack above the disc is in the designer's order, downed bodies flatten to 60% at the palette's opacity, the
 * overtime edge is static and fades in over 360 ms, and the source holds no colour literals.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { type Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import type { ArenaFrameState, ArenaPalette, UnitRenderState } from '../../types';
import { defaultArenaPalette } from '../../colors';
import { assemble, type Headless } from '../testing/headless';
import { fakeContext, fakeLog } from '../testing/fake-timeline';

/** A palette that differs from the defaults in every field the viewer reads. */
function loudPalette(): ArenaPalette {
  const base = defaultArenaPalette('dark');
  return {
    ...base,
    plate: 0x112233,
    hp: 0xff0000,
    focus: 0x00ff00,
    shield: 0x0000ff,
    select: 0xff00ff,
    telegraph: 0x00ffff,
    hitFlash: 0xffff00,
    metrics: { ...base.metrics, ringWidthPx: 6, ringLinePx: 3, ringGapPx: 2, downOpacity: 0.2, barHeightPx: 10, pipSizePx: 20, labelSizePx: 14, hitFlashAlpha: 0.5, zoneAlpha: 0.5 },
  };
}

async function shownWith(palette: ArenaPalette, tick = 250): Promise<Headless> {
  const h = assemble({ palette });
  await h.core.load(fakeLog(), fakeContext({ kind: 'replay' }));
  h.core.seek(tick);
  return h;
}

describe('the token follows the palette and its metrics', () => {
  it('takes the HP, focus and shield colours and the bar height from the palette', async () => {
    const h = await shownWith(loudPalette());
    const shown = h.scene.tokenOf(1)!.shown();
    expect(shown.hpTint).toBe(0xff0000);
    expect(shown.focusTint).toBe(0x00ff00);
    expect(shown.barsHeight).toBeCloseTo(10 + 1 + 10 * 0.6 + 2, 3); // HP bar, 1 px, the 60% focus bar, the hairline
    const dflt = await shownWith(defaultArenaPalette('dark'));
    const bar = defaultArenaPalette('dark').metrics.barHeightPx;
    expect(dflt.scene.tokenOf(1)!.shown().barsHeight).toBeCloseTo(bar + 1 + bar * 0.6 + 2, 3);
    expect(dflt.scene.tokenOf(1)!.shown().hpTint).toBe(defaultArenaPalette('dark').hp);
  });

  it('recolours and resizes live on a palette change (theme, motion or scale)', async () => {
    const h = await shownWith(defaultArenaPalette('dark'));
    h.scene.setPalette(loudPalette());
    h.core.seek(250);
    expect(h.scene.tokenOf(1)!.shown().hpTint).toBe(0xff0000);
    expect(h.scene.tokenOf(1)!.shown().barsHeight).toBeCloseTo(10 + 1 + 6 + 2, 3);
    expect(h.text.configured.length).toBeGreaterThanOrEqual(2); // fonts are re-baked for the new plate colour and sizes
  });

  it('stacks the marks above the disc in the designer\'s order: bars, then badge and pips, then cast bar, tag, name', async () => {
    const h = await shownWith(defaultArenaPalette('dark'), 320);
    h.core.setLabels('all');
    // Unit 3 casts at 320 (cast bar) and the first 3 s are over, so give another unit the Freshness tag at tick 20.
    const s = h.scene.tokenOf(3)!.shown();
    expect(s.cast).toBe(true);
    const y = s.stackY;
    expect(y.bars).toBeGreaterThan(y.row); // the bars are lowest (screen y grows downward), the row above them
    expect(y.row).toBeGreaterThan(y.cast);
    expect(y.cast).toBeGreaterThan(y.name);
    h.core.seek(20);
    const t = h.scene.tokenOf(2)!.shown(); // Tired (52): tag and name
    expect(t.tag).toBe('Tired (52)');
    expect(t.stackY.row).toBeGreaterThan(t.stackY.tag);
    expect(t.stackY.tag).toBeGreaterThan(t.stackY.name);
  });

  it('puts the role plate over the body and draws the captain crown on a chip at the top right', async () => {
    const h = await shownWith(defaultArenaPalette('dark'));
    const token = h.scene.tokenOf(0)!; // hybrid tank + healer, the home captain
    const kids = token.root.children;
    expect(kids.indexOf(token.body.view)).toBeLessThan(kids.indexOf(kids[3]!)); // the plate group is drawn after the body
    expect(token.shown().crown).toBe(true);
    expect(h.scene.tokenOf(5)!.shown().crown).toBe(true); // the away captain too
  });

  it('flattens a downed body, its plate and ring to 60% at the palette\'s down opacity, and hides everything above it', async () => {
    const palette = loudPalette();
    const h = await shownWith(palette, 320);
    const down = h.scene.tokenOf(6)!;
    const s = down.shown();
    expect(s.downMark).toBe(true);
    expect(s.flat).toBeCloseTo(0.6, 5);
    expect(s.ringAlpha).toBeCloseTo(0.2, 5);
    expect(s.bars).toBe(false);
    expect(down.body.view.alpha).toBeCloseTo(0.2, 5); // the skin follows the same opacity
    expect(h.scene.tokenOf(5)!.shown().flat).toBe(1);
  });

  it('draws the hit wash for the palette\'s duration only, and not at all when it is 0 ms (reduced motion)', async () => {
    const h = await shownWith(defaultArenaPalette('dark'));
    const token = h.scene.tokenOf(4)!;
    const base = h.core.currentState!.units[4]!;
    const hit = (tick: number): UnitRenderState => ({ ...base, lastHitTick: tick });
    const limiter = (h.scene as unknown as { limiter: Parameters<typeof token.flashLevel>[4] }).limiter;
    expect(token.flashLevel(hit(100), 100, true, false, limiter, 50_000)).toBeCloseTo(1, 5);
    expect(token.flashLevel(hit(100), 101, true, false, limiter, 50_045)).toBeCloseTo(0.5, 2); // half of 90 ms
    expect(token.flashLevel(hit(100), 102, true, false, limiter, 50_095)).toBe(0);
    const reduced = await shownWith({ ...defaultArenaPalette('dark'), metrics: { ...defaultArenaPalette('dark').metrics, hitFlashMs: 0 } });
    const t2 = reduced.scene.tokenOf(4)!;
    const lim2 = (reduced.scene as unknown as { limiter: Parameters<typeof token.flashLevel>[4] }).limiter;
    expect(t2.flashLevel({ ...reduced.core.currentState!.units[4]!, lastHitTick: 100 }, 100, true, false, lim2, 1000)).toBe(0);
  });

  it('a hit the limiter refuses shows no wash and does not cut an admitted one short', async () => {
    const h = await shownWith(defaultArenaPalette('dark'));
    const token = h.scene.tokenOf(4)!;
    const base = h.core.currentState!.units[4]!;
    const limiter = (h.scene as unknown as { limiter: Parameters<typeof token.flashLevel>[4] }).limiter;
    const lvl = (tick: number, now: number): number => token.flashLevel({ ...base, lastHitTick: tick }, tick, true, false, limiter, now);
    expect(lvl(10, 60_000)).toBeCloseTo(1, 5); // admitted
    const during = lvl(11, 60_030); // refused (too soon): the first wash goes on
    expect(during).toBeCloseTo(1 - 30 / 90, 2);
    expect(lvl(12, 60_100)).toBe(0); // the wash ended; the refused hit left nothing behind
  });
});

describe('the overtime edge (A18 decision 6)', () => {
  const edge = (h: Headless): Container => h.scene.root.children[9] as Container;
  const frame = (h: Headless, over: Partial<ArenaFrameState>, dtMs: number, nowMs: number): void => {
    h.scene.draw({ ...h.core.currentState!, ...over }, { tick: 950, dtMs, speed: 1, playing: true, nowMs });
  };

  it('is a thin amber line on the field edge: hidden before overtime, fading in over 360 ms, never pulsing', async () => {
    const h = await shownWith(defaultArenaPalette('dark'), 100);
    expect(edge(h).visible).toBe(false);
    const alphas: number[] = [];
    let now = 1000;
    for (let i = 0; i < 40; i++) {
      now += 16.7;
      frame(h, { overtime: true }, 16.7, now);
      alphas.push(edge(h).alpha);
    }
    expect(alphas[0]!).toBeGreaterThan(0);
    expect(alphas[0]!).toBeLessThan(0.2);
    expect(alphas[0]!).toBeLessThan(alphas[10]!);
    for (let i = 1; i < alphas.length; i++) expect(alphas[i]!).toBeGreaterThanOrEqual(alphas[i - 1]! - 1e-9); // monotone: no pulse
    expect(alphas.at(-1)!).toBeGreaterThan(0.99);
    // It lies on the field (the arena rectangle), not on the canvas edge.
    const b = edge(h).getBounds();
    expect(b.x).toBeGreaterThan(5);
    expect(b.x + b.width).toBeLessThan(1280 - 5);
    expect(b.height).toBeLessThan(720 - 5);
  });

  it('is instant under reduced motion', async () => {
    const h = assemble({ reducedMotion: true });
    await h.core.load(fakeLog(), fakeContext({ kind: 'replay', startTick: 100 }));
    frame(h, { overtime: true }, 16.7, 2000);
    expect(edge(h).alpha).toBe(1);
    frame(h, { overtime: false }, 16.7, 2017);
    expect(edge(h).visible).toBe(false);
  });
});

const NAMED = 'white|black|red|green|blue|yellow|orange|purple|violet|pink|brown|gray|grey|cyan|magenta|silver|gold|teal|navy|maroon|olive|lime|aqua|fuchsia|transparent|currentcolor';
/** 0xRRGGBB numbers, # hex in 3, 4, 6 or 8 digits, colour functions, and named colours as whole string literals. */
const COLOUR_LITERAL = new RegExp(`0x[0-9a-fA-F]{6}\\b|#[0-9a-fA-F]{8}\\b|#[0-9a-fA-F]{6}\\b|#[0-9a-fA-F]{3,4}\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(|(?<![\\w-])['"](?:${NAMED})['"]`, 'gi');

describe('colours come from the palette (no literals)', () => {
  const ROOT = join(process.cwd(), 'src', 'render');
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.ts$/.test(name)) out.push(full);
    }
    return out;
  };

  it('the scan itself catches every spelling it claims to', () => {
    for (const bad of ['0xff00aa', '#abc', '#abcd', '#aabbcc', '#aabbccdd', 'rgb(1,2,3)', 'rgba(1,2,3,.5)', "'red'", '"white"', 'hsl(10, 5%, 5%)']) {
      expect(bad.match(COLOUR_LITERAL), bad).not.toBeNull();
    }
    for (const fine of ['const width = 0x10;', 'colors.white2', 'x.red', '#/arena', 'redraw', "'whitespace'"]) expect(fine.match(COLOUR_LITERAL), fine).toBeNull();
  });

  it('has no colour literal in the viewer or the placeholder skin but the white of tinted masks, and the default palette', () => {
    const files = [...walk(join(ROOT, 'viewer')), ...walk(join(ROOT, 'skins'))].filter((f) => {
      const rel = relative(ROOT, f).replaceAll('\\', '/');
      return !/\.test\.ts$/.test(rel) && !rel.startsWith('viewer/testing/') && !rel.startsWith('viewer/dev/') && rel !== 'viewer/palette.ts';
    });
    expect(files.length).toBeGreaterThan(10);
    const found: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const rel = relative(ROOT, file).replaceAll('\\', '/');
      for (const m of text.matchAll(COLOUR_LITERAL)) {
        if (m[0].toLowerCase() === '0xffffff') continue; // a white mask: a tint decides the colour
        if (rel === 'viewer/scene/glyphs.ts' && m[0] === "'white'") continue; // the same mask, as SVG markup
        if (rel === 'viewer/scene/arena-scene.ts' && m[0] === "'grey'") continue; // StatusCue.ring's state name, not a colour
        found.push(`${rel}: ${m[0]}`);
      }
    }
    expect(found).toEqual([]);
  });
});
