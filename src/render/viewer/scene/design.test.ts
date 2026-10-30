/**
 * The viewer follows the UI designer's specification (arena-notes.md §1, components.css §25; A18): every colour,
 * alpha, size and duration comes from `palette` and `palette.metrics` (a different palette gives a different token),
 * the stack above the disc is in the designer's order, downed bodies flatten to 60% at the palette's opacity, the
 * overtime edge is static and fades in over 360 ms, and the source holds no colour literals.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { type Container, type Graphics } from 'pixi.js';
import type { StubLabel } from './text';
import { describe, expect, it } from 'vitest';
import type { ArenaFrameState, ArenaPalette, UnitRenderState } from '../../types';
import { defaultArenaPalette } from '../../colors';
import { placeholderSkin } from '../../skins/placeholder';
import type { ArenaSkin, BodyVisual } from '../skin';
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

/** The placeholder skin with its bodies stripped of the token's own role and size, i.e. a plain body under the viewer's glyph plate. */
function plainBodySkin(): ArenaSkin {
  const inner = placeholderSkin();
  return {
    get id() {
      return inner.id;
    },
    load: (ctx) => inner.load(ctx),
    prepare: (units) => inner.prepare(units),
    createBody(info, colors) {
      const body = inner.createBody(info, colors) as { drawsRole?: boolean; diameterPx?: unknown };
      Object.defineProperty(body, 'drawsRole', { value: false });
      Object.defineProperty(body, 'diameterPx', { value: undefined });
      return body as BodyVisual;
    },
    createFloor: (a, p) => inner.createFloor(a, p),
    setPalette: (p) => inner.setPalette(p),
    destroy: () => inner.destroy(),
  };
}

async function shownWith(palette: ArenaPalette, tick = 250, skin?: ArenaSkin): Promise<Headless> {
  const h = assemble({ palette, skin });
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
    const t = h.scene.tokenOf(2)!.shown(); // Tired (42): tag and name
    expect(t.tag).toBe('Tired (42)');
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

describe('polish from the designer\'s review of the built arena', () => {
  const TOP = 8; // the layer of numbers, words and callouts, above the overlays (index 7)
  const stateWith = (h: Headless, patch: (u: UnitRenderState) => UnitRenderState, effects: ArenaFrameState['effects'] = [], extra: Partial<ArenaFrameState> = {}): ArenaFrameState => {
    const base = h.core.currentState!;
    return { ...base, projectiles: [], zones: [], telegraphs: [], ...extra, units: base.units.map(patch), effects };
  };
  const draw = (h: Headless, state: ArenaFrameState, nowMs = 10_000): void => h.scene.draw(state, { tick: 250, dtMs: 0, speed: 1, playing: false, nowMs });
  const num = (id: number, target: number, amount = 10): ArenaFrameState['effects'][number] => ({ id, kind: 'number', unit: 2, target, ability: null, x: 0, y: 0, amount, crit: false, tone: 'physical', age: 0.1 });

  it('draws a stack below the disc when above would leave the host (the north wall), and above otherwise', async () => {
    const h = await shownWith(defaultArenaPalette('dark'), 250);
    const mid = h.scene.tokenOf(4)!.shown();
    expect(mid.stackBelow).toBe(false);
    expect(mid.stackY.bars).toBeLessThan(0);
    // Unit 4 against the north wall: the field's top edge is a few px from the host's.
    draw(h, stateWith(h, (u) => (u.unit === 4 ? { ...u, x: 1600, y: 5 } : u)));
    const north = h.scene.tokenOf(4)!.shown();
    expect(north.stackBelow).toBe(true);
    expect(north.stackY.bars).toBeGreaterThan(0); // below the disc: positive
    expect(north.stackY.row).toBeGreaterThan(north.stackY.bars); // and still in the designer's order outwards
    // The same fighter at the south wall has room above: back above.
    draw(h, stateWith(h, (u) => (u.unit === 4 ? { ...u, x: 1600, y: 1795 } : u)));
    expect(h.scene.tokenOf(4)!.shown().stackBelow).toBe(false);
  });

  it('keeps the stack of a fighter at the west wall inside the host (nudged sideways)', async () => {
    // No camera padding: the field's west edge is the host's, so a fighter on it has half a stack outside.
    const h = assemble({ camera: { padding: { top: 0, right: 0, bottom: 0, left: 0 } } });
    await h.core.load(fakeLog(), fakeContext({ kind: 'replay' }));
    h.core.seek(250);
    draw(h, stateWith(h, (u) => (u.unit === 4 ? { ...u, x: 0, y: 900 } : u)));
    const t = h.scene.tokenOf(4)!;
    expect(t.shown().stackDx).toBeGreaterThan(0);
    expect(t.overlay.getBounds().x).toBeGreaterThanOrEqual(0 - 1e-6); // the stack's left edge is in the host
    // And at the east wall the other way.
    draw(h, stateWith(h, (u) => (u.unit === 4 ? { ...u, x: 3200, y: 900 } : u)));
    expect(h.scene.tokenOf(4)!.shown().stackDx).toBeLessThan(0);
    const b = h.scene.tokenOf(4)!.overlay.getBounds();
    expect(b.x + b.width).toBeLessThanOrEqual(1280 + 1e-6);
  });

  it('puts floating numbers on the top layer, above the overlays, beside the disc and not over its stack', async () => {
    const h = await shownWith(defaultArenaPalette('dark'), 250);
    draw(h, stateWith(h, (u) => u, [num(31, 7, 50)]));
    const layers = h.scene.root.children as Container[];
    const overlays = layers[7]!;
    const top = layers[TOP]!;
    expect(layers.indexOf(top)).toBeGreaterThan(layers.indexOf(overlays)); // above the overlays
    const labels = stubLabels(h).filter((l) => l.text === '\u221250' && isShown(l.view));
    expect(labels).toHaveLength(1);
    const label = labels[0]!;
    expect(top.children.some((c) => c.children.includes(label.view))).toBe(true); // it lives in the top layer
    expect(overlays.children.some((c) => c.children.includes(label.view))).toBe(false);
    const p = h.scene.tokenPosition(7)!;
    expect(label.view.position.x).toBeGreaterThan(p.x + 0.5 * 31); // to the right of the disc, clear of it
    expect(Math.abs(label.view.position.y - p.y)).toBeLessThan(0.6 * 31 + 20); // at the disc's height, not up in the stack
  });

  it('puts a number on the left of the disc when the right would leave the host', async () => {
    const h = await shownWith(defaultArenaPalette('dark'), 250);
    draw(h, stateWith(h, (u) => (u.unit === 7 ? { ...u, x: 3190, y: 900 } : u), [num(32, 7, 50)]));
    const label = stubLabels(h).find((l) => l.text === '\u221250' && isShown(l.view))!;
    expect(label.view.position.x).toBeLessThan(h.scene.tokenPosition(7)!.x);
  });

  it('queues the down callouts at one end of the field, away from every body, one line each', async () => {
    const h = await shownWith(defaultArenaPalette('dark'), 250);
    const down = (id: number, unit: number, by: number): ArenaFrameState['effects'][number] => ({ id, kind: 'down', unit, target: by, ability: 'a.cleave' as never, x: 0, y: 0, amount: null, crit: false, tone: 'neutral', age: 0.3 });
    // Two fighters fall in the middle of a crowd.
    draw(h, stateWith(h, (u) => ({ ...u, x: 1600 + (u.unit - 5) * 40, y: 900 + (u.unit % 3) * 40 }), [down(41, 6, 1), down(42, 7, 2)]));
    const chips = stubLabels(h).filter((l) => /downed by/.test(l.text) && isShown(l.view));
    expect(chips).toHaveLength(2);
    const [a, b] = chips.map((l) => (l.view.parent as Container).getBounds());
    // Away from the bodies: no token disc sits inside either chip.
    for (const u of [...Array(10).keys()]) {
      const p = h.scene.tokenPosition(u)!;
      for (const box of [a!, b!]) expect(p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height).toBe(false);
    }
    // A queue: the two lines share a column and do not overlap (one under the other).
    const [top, bottom] = [a!, b!].sort((p, q) => p.y - q.y);
    expect(bottom!.y).toBeGreaterThanOrEqual(top!.y + top!.height - 1e-6);
    expect(Math.abs(top!.x + top!.width / 2 - (bottom!.x + bottom!.width / 2))).toBeLessThan(80);
    // At an end of the field (the queue's first line is right inside the north or the south wall).
    const field = (h.scene as unknown as { env: { field: { y0: number; y1: number } } }).env.field;
    const nearTop = top!.y - field.y0 < 30;
    const nearBottom = field.y1 - (bottom!.y + bottom!.height) < 30;
    expect(nearTop || nearBottom).toBe(true);
  });

  it('folds the captain line into the down line: one callout, "Captain ..." in it', async () => {
    const h = await shownWith(defaultArenaPalette('dark'), 250);
    const fx = (id: number, kind: 'down' | 'captain-down', age: number): ArenaFrameState['effects'][number] => ({ id, kind, unit: 6, target: 1, ability: kind === 'down' ? ('a.cleave' as never) : null, x: 0, y: 0, amount: null, crit: false, tone: 'neutral', age });
    draw(h, stateWith(h, (u) => u, [fx(51, 'down', 0.2), fx(52, 'captain-down', 0.2)]));
    const lines = stubLabels(h).filter((l) => /downed|Captain down/.test(l.text) && isShown(l.view));
    expect(lines.map((l) => l.text)).toEqual(['Captain Duelist downed by Duelist \u00b7 Cleave']);
    // The line keeps its text as the captain cue expires first (it is the down line's own).
    draw(h, stateWith(h, (u) => u, [fx(51, 'down', 0.6)]));
    expect(stubLabels(h).filter((l) => /downed/.test(l.text) && isShown(l.view)).map((l) => l.text)).toEqual(['Captain Duelist downed by Duelist \u00b7 Cleave']);
    // A captain-down with no down cue keeps its own line.
    const h2 = await shownWith(defaultArenaPalette('dark'), 250);
    draw(h2, stateWith(h2, (u) => u, [fx(53, 'captain-down', 0.2)]));
    expect(stubLabels(h2).filter((l) => /Captain down/.test(l.text) && isShown(l.view))).toHaveLength(1);
  });

  it('writes a cast\'s name once: on the cast bar, not again under the telegraph', async () => {
    const h = await shownWith(defaultArenaPalette('dark'), 320); // unit 3 casts a fireball with a telegraph at 320
    const named = stubLabels(h).filter((l) => l.text === 'Fireball' && isShown(l.view));
    expect(named).toHaveLength(1);
    expect(h.scene.tokenOf(3)!.shown().cast).toBe(true);
  });

  it('clips the ground marks to the field: a telegraph never runs over the wall', async () => {
    const h = await shownWith(defaultArenaPalette('dark'), 320);
    const ground = h.scene.root.children[2] as Container;
    expect(ground.mask).toBeTruthy();
    // (A mask is not measurable, so read its geometry from the graphics context.)
    const maskBounds = (): { minX: number; minY: number; maxX: number; maxY: number } => (ground.mask as Graphics).context.bounds;
    const mask = { ...maskBounds() };
    const field = (h.scene as unknown as { env: { field: { x0: number; y0: number; x1: number; y1: number } } }).env.field;
    expect(mask.minX).toBeCloseTo(field.x0, 3);
    expect(mask.minY).toBeCloseTo(field.y0, 3);
    expect(mask.maxX).toBeCloseTo(field.x1, 3);
    expect(mask.maxY).toBeCloseTo(field.y1, 3);
    expect(mask.maxX - mask.minX).toBeGreaterThan(100);
    h.scene.setViewport(1000, 600);
    h.core.seek(320);
    const after = maskBounds();
    expect(after.maxX - after.minX).toBeLessThan(mask.maxX - mask.minX); // it follows the field on a resize
  });

  it('reads the bar width, plate radii and glyph sizes from palette.metrics (the designer\'s tokens, in metres of arena)', async () => {
    const base = defaultArenaPalette('dark');
    const m = base.metrics;
    const plain = await shownWith(base, 320, plainBodySkin());
    const custom = await shownWith({ ...base, metrics: { ...m, barWidthM: 1.7, glyphSizeHybridM: 0.4, plateRadiusHybridM: 0.45, glyphSizeM: 0.5, plateRadiusM: 0.4 } }, 320, plainBodySkin());
    const ppm = (h: Headless): number => {
      const a = h.scene.tokenPosition(0)!;
      const b = h.scene.tokenPosition(1)!;
      const wa = h.core.currentState!.units[0]!;
      const wb = h.core.currentState!.units[1]!;
      return (Math.hypot(a.x - b.x, a.y - b.y) / Math.hypot(wa.x - wb.x, wa.y - wb.y)) * 100;
    };
    const barW = (h: Headless): number => h.scene.tokenOf(1)!.overlay.getBounds().width; // the bars and the cast bar share the width
    // (The track's keylines add a couple of px outside the bar.)
    expect(barW(plain)).toBeGreaterThanOrEqual(m.barWidthM * ppm(plain));
    expect(barW(plain)).toBeLessThan(m.barWidthM * ppm(plain) + 4);
    expect(barW(custom) - barW(plain)).toBeCloseTo((1.7 - m.barWidthM) * ppm(plain), 0);
    const hybrid = (h: Headless) => h.scene.tokenOf(0)!.shown(); // unit 0 is a hybrid
    const single = (h: Headless) => h.scene.tokenOf(1)!.shown();
    // The plate is a circle of exactly the token's radius; a glyph fills part of its box, so compare it by ratio.
    expect(hybrid(plain).plateRadius).toBeCloseTo(m.plateRadiusHybridM * ppm(plain), 0);
    expect(single(plain).plateRadius).toBeCloseTo(m.plateRadiusM * ppm(plain), 0);
    expect(hybrid(custom).plateRadius).toBeCloseTo(0.45 * ppm(custom), 0);
    expect(single(custom).plateRadius).toBeCloseTo(0.4 * ppm(custom), 0);
    expect(hybrid(custom).glyphSize / hybrid(plain).glyphSize).toBeCloseTo(0.4 / m.glyphSizeHybridM, 1);
    expect(single(custom).glyphSize / single(plain).glyphSize).toBeCloseTo(0.5 / m.glyphSizeM, 1);
    // Two glyphs and their gap fit inside the hybrid plate (the reason the plate is wider).
    expect(2 * m.glyphSizeHybridM).toBeLessThanOrEqual(2 * m.plateRadiusHybridM);
  });
});

/** Every text a label in the scene currently holds (stub labels remember their text). */
function stubLabels(h: Headless): StubLabel[] {
  return h.text.created;
}

function isShown(view: Container): boolean {
  for (let c: Container | null = view; c; c = c.parent) if (!c.visible) return false;
  return true;
}
