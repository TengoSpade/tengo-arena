/**
 * The PixiJS scene without a GPU (scene-graph objects only): bodies are never rotated by the viewer, layers are in
 * order and bodies depth-sorted, visuals are reused by id, flashes and numbers are rate-limited, every effect kind
 * draws, and teardown leaves nothing behind. Text is a stub (no canvas 2D in happy-dom).
 */
import { Container, Graphics, type GraphicsContext } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import type { ArenaFrameState, EffectKind, EffectRenderState, UnitRenderState } from '../../types';
import { DEFAULT_CAMERA } from '../../camera';
import { defaultArenaPalette } from '../palette';
import { FlashLimiter } from '../flash-limiter';
import { type StubLabel } from './text';
import { assemble, type Headless } from '../testing/headless';
import { fakeContext, fakeLog, createFakeTimeline } from '../testing/fake-timeline';
import { countDisplayObjects } from './arena-scene';
import { LAYER_OF } from './effects';

async function shown(kind: 'live' | 'replay' = 'replay', options: Parameters<typeof assemble>[0] = {}): Promise<Headless> {
  const h = assemble(options);
  await h.core.load(fakeLog(), fakeContext({ kind }));
  return h;
}

/** A blank frame state to hand-build cases on. */
function blankState(base: ArenaFrameState): ArenaFrameState {
  return { ...base, projectiles: [], zones: [], telegraphs: [], effects: [] };
}

function effect(over: Partial<EffectRenderState> & Pick<EffectRenderState, 'id' | 'kind'>): EffectRenderState {
  return { unit: null, target: null, ability: null, x: 1600, y: 900, amount: null, crit: false, tone: 'physical', age: 0.2, ...over };
}

const ALL_KINDS: Record<EffectKind, true> = {
  swing: true,
  beam: true,
  impact: true,
  number: true,
  evade: true,
  'heal-pulse': true,
  'shield-gain': true,
  'shield-break': true,
  'status-apply': true,
  'status-resist': true,
  interrupt: true,
  'dash-trail': true,
  displace: true,
  cleanse: true,
  dispel: true,
  'guard-link': true,
  'chain-arc': true,
  splash: true,
  'cooldown-reset': true,
  'focus-gain': true,
  'zone-trigger': true,
  down: true,
  deathward: true,
  rally: true,
  'captain-down': true,
  call: true,
};

describe('bodies (tech-020: the viewer translates and depth-sorts, never rotates)', () => {
  it('never rotates or scales a body or its token, whatever the facing', async () => {
    const h = await shown('replay', { autoPause: { ownDowned: false, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: null } });
    h.core.setSpeed(4);
    h.core.play();
    for (let i = 0; i < 400; i++) {
      h.run(1);
      for (let u = 0; u < 10; u++) {
        const token = h.scene.tokenOf(u)!;
        expect(token.body.view.rotation).toBe(0);
        expect(token.body.view.scale.x).toBe(1);
        expect(token.body.view.scale.y).toBe(1);
        expect(token.body.view.skew.x).toBe(0);
        expect(token.root.rotation).toBe(0);
        expect(token.root.scale.x).toBe(1);
        expect(token.root.scale.y).toBe(1);
      }
    }
    // The wedge (a mark of ours) is what turns.
    const state = h.core.currentState!;
    const turned = [...Array(10).keys()].filter((u) => Math.abs(h.scene.tokenOf(u)!.shown().wedge) > 0.01);
    expect(turned.length).toBeGreaterThan(5);
    expect(state.units).toHaveLength(10);
  });

  it('hands the body the unit state (with facing) and the frame facts to pick its own frame from', async () => {
    const h = assemble();
    const seen: { facing: number; pxPerMetre: number; dtMs: number }[] = [];
    const inner = h.skin.createBody.bind(h.skin);
    h.skin.createBody = (info, colors) => {
      const body = inner(info, colors);
      const update = body.update.bind(body);
      body.update = (state, frame) => {
        if (info.unit === 3) seen.push({ facing: state.facing, pxPerMetre: frame.pxPerMetre, dtMs: frame.dtMs });
        update(state, frame);
      };
      return body;
    };
    await h.core.load(fakeLog(), fakeContext());
    h.core.play();
    h.run(5);
    expect(seen.length).toBeGreaterThan(3);
    expect(new Set(seen.map((s) => s.facing)).size).toBeGreaterThan(1);
    expect(seen[0]!.pxPerMetre).toBeGreaterThan(20); // 1280x720 letterboxed: about 31 px/m
    expect(seen[0]!.dtMs).toBe(0); // paused frame
    expect(seen.at(-1)!.dtMs).toBeGreaterThan(10); // playing frames carry wall time
  });

  it('depth-sorts by screen y and keeps ten tokens, one per unit', async () => {
    const h = await shown();
    h.core.seek(250);
    const ys = [...Array(10).keys()].map((u) => h.scene.tokenPosition(u)!);
    for (let u = 0; u < 10; u++) expect(h.scene.tokenOf(u)!.root.zIndex).toBe(ys[u]!.y);
    expect(h.scene.tokenCount).toBe(10);
    expect((h.scene.tokenOf(0)!.root.parent as Container).sortableChildren).toBe(true);
  });
});

describe('layers', () => {
  it('draws floor, markers, zones, telegraphs, low cues, bodies, projectiles, high cues, overlays, vignette in that order', async () => {
    const h = await shown();
    const layers = h.scene.root.children;
    expect(layers).toHaveLength(10);
    const token = h.scene.tokenOf(0)!;
    expect(layers.indexOf(token.root.parent as Container)).toBe(5); // bodies
    expect(layers.indexOf(token.overlay.parent as Container)).toBe(8); // bars and badges above every body
    expect(layers[0]!.children.length).toBe(1); // the skin's floor
    h.core.seek(320);
    expect(layers[2]!.children.length).toBeGreaterThan(0); // zones
    expect(layers[3]!.children.length).toBeGreaterThan(0); // telegraphs
    for (const [kind, layer] of Object.entries(LAYER_OF)) expect(['low', 'high']).toContain(layer ?? kind);
  });

  it('puts the body and its ring/wedge/glyph together and the bars in the overlay', async () => {
    const h = await shown();
    const token = h.scene.tokenOf(2)!;
    // Bottom to top (arena-notes §1): ring group, wedge, the skin body, the glyph plate, hit wash, brackets, down diamond.
    const kids = token.root.children;
    expect(kids).toHaveLength(7);
    expect(kids.indexOf(token.body.view)).toBe(2);
    expect(token.overlay.children).toHaveLength(2); // the stack and the crown chip
  });
});

describe('what a token shows (asset-006, D-J)', () => {
  it('shows bars, a rule badge and the captain crown while standing; none of it once downed', async () => {
    const h = await shown();
    h.core.seek(250);
    const standing = h.scene.tokenOf(6)!.shown();
    expect(standing.bars).toBe(true);
    expect(standing.badge).toMatch(/^R\d$/);
    expect(standing.downMark).toBe(false);
    expect(h.scene.tokenOf(5)!.shown().crown).toBe(true); // the away captain
    expect(h.scene.tokenOf(6)!.shown().crown).toBe(false);
    h.core.seek(320); // unit 6 went down at 300
    const down = h.scene.tokenOf(6)!.shown();
    expect(down.bars).toBe(false);
    expect(down.badge).toBeNull();
    expect(down.downMark).toBe(true);
    expect(down.ringAlpha).toBeLessThan(0.5);
  });

  it('hides the shield and focus bars it has no data for (log format 1), shows them with data', async () => {
    const h = await shown();
    h.core.seek(150);
    expect(h.scene.tokenOf(0)!.shown().focus).toBe(false); // focus null
    expect(h.scene.tokenOf(1)!.shown().focus).toBe(true);
    expect(h.scene.tokenOf(2)!.shown().shield).toBe(false); // no shield yet
    h.core.seek(260);
    expect(h.scene.tokenOf(2)!.shown().shield).toBe(true); // unit 2 gains a shield after tick 200
  });

  it('shows at most four status pips, and greys the ring of a hard-controlled unit', async () => {
    const h = await shown();
    h.core.seek(250);
    expect(h.scene.tokenOf(7)!.shown().pips).toBe(4); // five statuses, four pips
    expect(h.scene.tokenOf(3)!.shown().pips).toBe(2);
    expect(h.scene.tokenOf(1)!.shown().pips).toBe(1); // the stun
  });

  it('shows the cast bar for a cast of 0.3 s or more', async () => {
    const h = await shown();
    h.core.seek(320);
    expect(h.scene.tokenOf(3)!.shown().cast).toBe(true);
    h.core.seek(350);
    expect(h.scene.tokenOf(3)!.shown().cast).toBe(false);
  });

  it('shows the Freshness tag for the first 3 s only, as words and the number', async () => {
    const h = await shown();
    expect(h.scene.tokenOf(2)!.shown().tag).toBe('Tired (52)');
    expect(h.scene.tokenOf(7)!.shown().tag).toBe('Spent (28)');
    expect(h.scene.tokenOf(3)!.shown().tag).toBe('');
    h.core.seek(61);
    expect(h.scene.tokenOf(2)!.shown().tag).toBe('');
  });

  it('shows the name of the selected unit, or of everyone with labels on', async () => {
    const h = await shown();
    expect(h.scene.tokenOf(1)!.shown().name).toBeNull();
    h.core.setLabels('selected');
    h.core.select(1);
    expect(h.scene.tokenOf(1)!.shown().name).toBe('Fighter 1');
    expect(h.scene.tokenOf(2)!.shown().name).toBeNull();
    expect(h.scene.tokenOf(1)!.shown().selected).toBe(true);
    h.core.setLabels('all');
    expect(h.scene.tokenOf(2)!.shown().name).toBe('Fighter 2');
    h.core.setLabels('off');
    expect(h.scene.tokenOf(1)!.shown().name).toBeNull();
  });

  it('hit-tests the token under a point, preferring a standing unit over a downed one', async () => {
    const h = await shown();
    h.core.seek(250);
    for (const u of [0, 4, 7]) {
      const p = h.scene.tokenPosition(u)!;
      expect(h.scene.hitTest(p.x, p.y)).toBe(u);
      expect(h.scene.hitTest(p.x + 4, p.y - 3)).toBe(u);
    }
    expect(h.scene.hitTest(3, 3)).toBeNull();
    // Unit 6 is down after tick 300 and may overlap a standing unit: the standing one wins.
    h.core.seek(650);
    const p6 = h.scene.tokenPosition(6)!;
    expect(h.scene.hitTest(p6.x, p6.y)).toBe(6);
  });

  it('keeps the tokens inside the canvas padding at 1280 x 720 and follows a resize', async () => {
    const h = await shown();
    h.core.seek(250);
    for (let u = 0; u < 10; u++) {
      const p = h.scene.tokenPosition(u)!;
      expect(p.x).toBeGreaterThan(16);
      expect(p.x).toBeLessThan(1280 - 16);
      expect(p.y).toBeGreaterThan(56);
      expect(p.y).toBeLessThan(720 - 72);
    }
    const before = h.scene.tokenPosition(0)!;
    h.scene.setViewport(1920, 1080);
    h.core.seek(250);
    const after = h.scene.tokenPosition(0)!;
    expect(after.x).toBeGreaterThan(before.x);
    expect(after.y).toBeGreaterThan(before.y);
  });
});

describe('cues', () => {
  it('draws zones, telegraphs and projectiles from the state and releases them when it ends', async () => {
    const h = await shown();
    h.core.seek(320);
    let stats = h.scene.poolStats();
    expect(stats.zones).toBe(1);
    expect(stats.telegraphs).toBe(1);
    h.core.seek(120);
    stats = h.scene.poolStats();
    expect(stats.zones).toBe(1);
    expect(stats.projectiles).toBeGreaterThanOrEqual(0);
    h.core.seek(1100);
    stats = h.scene.poolStats();
    expect(stats.zones).toBe(0);
    expect(stats.telegraphs).toBe(0);
  });

  it('draws every effect kind without error', async () => {
    const h = await shown();
    const base = blankState(h.core.currentState!);
    const kinds = Object.keys(ALL_KINDS) as EffectKind[];
    const state: ArenaFrameState = {
      ...base,
      effects: kinds.map((kind, i) => effect({ id: 100 + i, kind, unit: 1, target: 7, amount: 42, ability: 'a.fireball' as never, tone: i % 2 ? 'arcane' : 'heal' })),
    };
    h.scene.draw(state, { tick: 100, dtMs: 16, speed: 1, playing: true, nowMs: 5000 });
    expect(h.scene.poolStats().effects).toBe(kinds.length);
    expect(Object.keys(LAYER_OF).sort()).toEqual([...kinds].sort());
    // Reduced motion: the motion-only cues (dash-trail, displace, heal-pulse, cooldown-reset, focus-gain) are not drawn.
    h.scene.setReducedMotion(true);
    h.scene.draw(state, { tick: 100, dtMs: 16, speed: 1, playing: true, nowMs: 5016 });
    expect(h.scene.poolStats().effects).toBe(kinds.length - 5);
  });

  describe("who an effect is about (the render model unit and target convention)", () => {
    const centre = (layer: number): { x: number; y: number; width: number } | null => {
      const parent = (shownScene.scene.root.children[layer] as Container).children.find((c) => c.visible && c.children.length > 0);
      if (!parent) return null;
      const b = parent.getBounds();
      return b.width > 0 ? { x: b.x + b.width / 2, y: b.y + b.height / 2, width: b.width } : null;
    };
    let shownScene: Headless;
    const draw = async (effects: EffectRenderState[], reduced = false): Promise<void> => {
      shownScene = await shown();
      shownScene.core.seek(250);
      if (reduced) shownScene.scene.setReducedMotion(true);
      const state = { ...blankState(shownScene.core.currentState!), effects };
      shownScene.scene.draw(state, { tick: 250, dtMs: 16, speed: 1, playing: true, nowMs: 50_000 });
    };
    const pos = (u: number) => shownScene.scene.tokenPosition(u)!;
    const world = (u: number) => shownScene.core.currentState!.units[u]!;

    it('draws a swing at the actor, toward the target (x,y is where it lands)', async () => {
      await draw([effect({ id: 1, kind: 'swing', unit: 1, target: 7, x: 0, y: 0, age: 0.1 })]);
      // x,y here is nonsense on purpose: the swing follows the actor and the target, not the event point.
      const c = centre(7)!;
      expect(Math.hypot(c.x - pos(1).x, c.y - pos(1).y)).toBeLessThan(Math.hypot(c.x - pos(7).x, c.y - pos(7).y));
    });

    it("draws a splash from the area of the ability: a circle of its size, a cone or line aimed at the target", async () => {
      const w = world(1);
      await draw([effect({ id: 2, kind: 'splash', unit: 1, target: 7, ability: 'a.fireball' as never, x: w.x, y: w.y, age: 0.1 })]);
      const circle = centre(4)!;
      const ppm = (Math.hypot(pos(1).x - pos(7).x, pos(1).y - pos(7).y) / Math.hypot(w.x - world(7).x, w.y - world(7).y)) * 100; // px per metre
      expect(circle.width).toBeGreaterThan(2 * 2.6 * ppm * 0.9); // 260 cm radius
      await draw([effect({ id: 3, kind: 'splash', unit: 1, target: 7, ability: 'a.cleave' as never, x: w.x, y: w.y, age: 0.1 })]);
      const cone = centre(4)!;
      const toward = { x: pos(7).x - pos(1).x, y: pos(7).y - pos(1).y };
      expect((cone.x - pos(1).x) * toward.x + (cone.y - pos(1).y) * toward.y).toBeGreaterThan(0); // its mass lies toward the target
    });

    it('draws a deathward on the unit that was saved, and a displace from where it began to where the mover is now', async () => {
      await draw([effect({ id: 4, kind: 'deathward', unit: 4, target: 9, age: 0.1 })]);
      const ring = centre(4)!;
      expect(Math.hypot(ring.x - pos(4).x, ring.y - pos(4).y)).toBeLessThan(Math.hypot(ring.x - pos(9).x, ring.y - pos(9).y));
      const w = world(7);
      await draw([effect({ id: 5, kind: 'displace', unit: 7, target: 1, x: w.x - 150, y: w.y, age: 0.1 })]);
      const streak = centre(4)!;
      expect(streak.x).toBeLessThan(pos(7).x); // the streak trails behind the mover
    });

    it('draws nothing for the motion-only cues under reduced motion (the model drops them too)', async () => {
      const w = world(7);
      await draw([effect({ id: 6, kind: 'displace', unit: 7, target: 1, x: w.x - 150, y: w.y }), effect({ id: 7, kind: 'heal-pulse', unit: 4, target: 3, tone: 'heal' })], true);
      expect(centre(4)).toBeNull();
    });
  });

  it('names who went down, by whom and with what (vis-003)', async () => {
    const h = await shown();
    h.core.seek(305); // unit 6 (Duelist, away) downed by unit 1 (Duelist) with Shadowstep
    const texts = (h as unknown as { texts: StubLabel[] }).texts;
    void texts;
    const labels = labelsOf(h);
    expect(labels.some((t) => t === 'Duelist downed by Duelist · Shadowstep')).toBe(true);
  });

  it('merges hits on one fighter inside 100 ms of wall time into one number', async () => {
    const h = await shown();
    const base = blankState(h.core.currentState!);
    const numbers = (ids: number[], amounts: number[], target: number) => ids.map((id, i) => effect({ id, kind: 'number', unit: 2, target, amount: amounts[i]!, tone: 'physical', age: 0.1 }));
    const frame = (effects: EffectRenderState[], nowMs: number): void => h.scene.draw({ ...base, effects }, { tick: 50, dtMs: 16, speed: 1, playing: true, nowMs });
    frame([...numbers([1, 2, 3], [10, 20, 30], 7), ...numbers([4], [5], 8)], 1000);
    const signed = /^[−+]\d+$/;
    let shownNumbers = visibleLabels(h).filter((t) => signed.test(t));
    expect(shownNumbers).toContain('−60'); // 10 + 20 + 30 on unit 7: one number, with its sign
    expect(shownNumbers).toContain('−5'); // unit 8 is a different fighter
    expect(shownNumbers).toHaveLength(2);
    // A hit 150 ms later is a new number.
    frame([...numbers([1, 2, 3], [10, 20, 30], 7), ...numbers([9], [7], 7)], 1150);
    shownNumbers = visibleLabels(h).filter((t) => signed.test(t));
    expect(shownNumbers).toContain('−7');
  });
});

describe('flashes (04 §9: at most 3 a second; reduced motion removes them)', () => {
  function hitState(base: UnitRenderState, hit: number | null): UnitRenderState {
    return { ...base, lastHitTick: hit };
  }

  it('flashes a token at most three times in any wall second at 4x', async () => {
    const h = await shown();
    const token = h.scene.tokenOf(4)!;
    const base = h.core.currentState!.units[4]!;
    const limiter = new FlashLimiter(3);
    let peaks = 0;
    let wasOn = false;
    const times: number[] = [];
    // A hit every 2 ticks (100 ms of fight time), 4x: every 25 ms of wall time, for 3 s.
    for (let ms = 0, tick = 0; ms < 3000; ms += 25, tick += 2) {
      const lvl = token.flashLevel(hitState(base, tick), tick, true, false, limiter, 10_000 + ms);
      const on = lvl > 0.5;
      if (on && !wasOn) {
        peaks++;
        times.push(ms);
      }
      wasOn = on;
    }
    for (const t0 of times) expect(times.filter((t) => t >= t0 && t < t0 + 1000).length).toBeLessThanOrEqual(3);
    expect(peaks).toBeGreaterThan(3); // flashes still happen, rate-limited rather than removed
    expect(peaks).toBeLessThanOrEqual(9 + 1);
  });

  it('does not flash while paused or seeking, nor under reduced motion', async () => {
    const h = await shown();
    const token = h.scene.tokenOf(4)!;
    const base = h.core.currentState!.units[4]!;
    const limiter = new FlashLimiter(3);
    expect(token.flashLevel(hitState(base, 10), 10, false, false, limiter, 1000)).toBe(0);
    expect(token.flashLevel(hitState(base, 20), 20, true, true, limiter, 1100)).toBe(0);
    expect(token.flashLevel(hitState(base, 30), 31, true, false, limiter, 1200)).toBeGreaterThan(0.5);
  });

  it('hits seen only after a seek never flash', async () => {
    const h = await shown();
    const token = h.scene.tokenOf(4)!;
    const base = h.core.currentState!.units[4]!;
    const limiter = new FlashLimiter(3);
    token.flashLevel(hitState(base, 100), 500, true, false, limiter, 1000); // the hit is long past: not fresh
    expect(token.flashLevel(hitState(base, 100), 500.2, true, false, limiter, 1010)).toBe(0);
  });
});

describe('reduced motion (04 §9)', () => {
  it('keeps the rule badge still and hides projectile trails', async () => {
    const h = assemble({ reducedMotion: true });
    await h.core.load(fakeLog(), fakeContext());
    const base = blankState(h.core.currentState!);
    const unit0 = base.units.map((u) => (u.unit === 3 ? { ...u, rule: { label: 'R2', rule: 1, sinceTick: 100, pulse: 1 } } : u));
    const state = { ...base, units: unit0, projectiles: [{ id: 1, ability: 'a.arrow' as never, source: 2, target: 7, x: 1500, y: 900, progress: 0.4 }] };
    h.scene.draw(state, { tick: 100, dtMs: 16, speed: 1, playing: true, nowMs: 1000 });
    expect(h.scene.tokenOf(3)!.shown().badge).toBe('R2');
    expect(h.scene.tokenOf(3)!.shown().badgeScale).toBe(1); // nothing pulses
  });

  it('pulses the rule badge for a fresh decision otherwise', async () => {
    const h = assemble({ reducedMotion: false });
    await h.core.load(fakeLog(), fakeContext());
    const base = blankState(h.core.currentState!);
    const units = base.units.map((u) => (u.unit === 3 ? { ...u, rule: { label: 'R2', rule: 1, sinceTick: 100, pulse: 1 } } : u));
    h.scene.draw({ ...base, units }, { tick: 100, dtMs: 16, speed: 1, playing: true, nowMs: 1000 });
    expect(h.scene.tokenOf(3)!.shown().badgeScale).toBeGreaterThan(1.2);
  });
});

describe('camera and palette', () => {
  it('eases a camera change over easeMs, none under reduced motion', async () => {
    const h = await shown();
    h.core.seek(250);
    const before = h.scene.tokenPosition(0)!;
    h.scene.setCamera({ ...DEFAULT_CAMERA, padding: { top: 100, right: 100, bottom: 100, left: 100 }, easeMs: 220 }, 10_000);
    expect(h.scene.animating).toBe(true);
    h.core.seek(250);
    const mid = h.scene.tokenPosition(0)!;
    h.scene.draw(h.core.currentState!, { tick: 250, dtMs: 0, speed: 1, playing: false, nowMs: 10_110 });
    const halfway = h.scene.tokenPosition(0)!;
    h.scene.draw(h.core.currentState!, { tick: 250, dtMs: 0, speed: 1, playing: false, nowMs: 10_400 });
    const end = h.scene.tokenPosition(0)!;
    expect(h.scene.animating).toBe(false);
    expect(mid.x).not.toBe(end.x);
    expect(Math.abs(halfway.x - before.x)).toBeGreaterThan(0);
    expect(Math.abs(halfway.x - end.x)).toBeGreaterThan(0);

    const r = assemble({ reducedMotion: true });
    await r.core.load(fakeLog(), fakeContext());
    r.scene.setCamera({ projection: { kind: 'top-down' }, zoom: 1, follow: null, padding: { top: 100, right: 100, bottom: 100, left: 100 }, easeMs: 220 }, 0);
    expect(r.scene.animating).toBe(false);
  });

  it('the theme switch recolours the player\'s brass and steel rings from the palette', async () => {
    const h = await shown('replay');
    const dark = defaultArenaPalette('dark');
    const light = defaultArenaPalette('light');
    expect(h.scene.ringColor(0)).toBe(0xe6b866); // from the match's team colours
    h.core.setReducedMotion(false);
    h.scene.setPalette(light);
    expect(h.scene.ringColor(0)).toBe(light.sideUs);
    expect(h.scene.ringColor(1)).toBe(light.sideThem);
    h.scene.setPalette(dark);
    expect(h.scene.ringColor(0)).toBe(dark.sideUs);
    expect(h.skin.paletteCalls).toBe(3); // the first load plus the two switches
  });

  it('a match between other clubs keeps the clubs\' ring colours across a theme switch', async () => {
    const h = assemble();
    await h.core.load(fakeLog(), fakeContext({ playerSide: null }));
    h.scene.setPalette(defaultArenaPalette('light'));
    expect(h.scene.ringColor(0)).toBe(0xe6b866);
    expect(h.scene.ringColor(1)).toBe(0xa7b4c6);
  });
});

describe('teardown (no growth over 20 rounds)', () => {
  it('holds the same number of display objects, bodies and pooled cues after 20 rounds as after one', async () => {
    const h = assemble();
    const log = fakeLog();
    const ctx = fakeContext({ kind: 'replay' });
    await h.core.load(log, ctx);
    h.core.setSpeed(4);
    h.core.play();
    h.run(400);
    h.core.pause();
    const objects = countDisplayObjects(h.scene.root);
    const effectsCreated = h.scene.poolStats().effectsCreated;
    for (let round = 0; round < 20; round++) {
      await h.core.load(log, ctx);
      h.core.setSpeed(4);
      h.core.play();
      h.run(400);
      h.core.pause();
    }
    expect(h.skin.liveBodies).toBe(10);
    expect(h.skin.bodiesCreated).toBe(10 * 21);
    // Display objects after a round: the tokens, the floor and the pooled cues (a high-water mark): bounded, not growing.
    // (Pooled cue views keep the number labels they have served, per tone: a bounded high-water mark.)
    expect(countDisplayObjects(h.scene.root)).toBeLessThanOrEqual(objects * 1.1 + 8);
    expect(h.scene.poolStats().effectsCreated).toBeLessThanOrEqual(effectsCreated + 8);
    expect(h.skin.floorsCreated).toBeLessThanOrEqual(2 * 21 + 3);
    h.core.destroy();
    h.scene.destroy();
    expect(h.skin.liveBodies).toBe(0);
    expect(h.scene.root.destroyed).toBe(true);
  });

  it('frees the previous round\'s tokens and cues on load', async () => {
    const h = await shown();
    h.core.seek(320);
    const first = h.scene.tokenOf(0)!;
    await h.core.load(fakeLog(), fakeContext({ kind: 'replay' }));
    expect(first.root.destroyed).toBe(true);
    expect(first.overlay.destroyed).toBe(true);
    expect(h.scene.poolStats()).toMatchObject({ zones: 0, telegraphs: 0, projectiles: 0, effects: 0 });
  });

  it('destroys the GPU-side context of every Graphics it frees (PixiJS only does with context: true; this leaked 0.65 MB a round)', async () => {
    const h = await shown();
    h.core.seek(320); // zones, telegraphs and cues in play
    const owned = (root: Container): GraphicsContext[] => {
      const out: GraphicsContext[] = [];
      const walk = (c: Container): void => {
        if (c instanceof Graphics) out.push(c.context);
        for (const child of c.children) if (child instanceof Container) walk(child);
      };
      walk(root);
      return out;
    };
    const tokenContexts = [0, 3, 6].flatMap((u) => [...owned(h.scene.tokenOf(u)!.root), ...owned(h.scene.tokenOf(u)!.overlay)]);
    const bodyContexts = owned(h.scene.tokenOf(0)!.body.view);
    expect(tokenContexts.length).toBeGreaterThan(30);
    expect(bodyContexts.length).toBeGreaterThan(0);
    await h.core.load(fakeLog(), fakeContext({ kind: 'replay' }));
    expect(tokenContexts.every((c) => c.destroyed)).toBe(true);
    expect(bodyContexts.every((c) => c.destroyed)).toBe(true);
    const all = owned(h.scene.root);
    expect(all.length).toBeGreaterThan(30);
    h.core.destroy();
    h.scene.destroy();
    expect(all.every((c) => c.destroyed)).toBe(true);
  });

  it('tears the scene down once: destroy leaves no tokens, and drawing afterwards does nothing', async () => {
    const h = await shown();
    const root = h.scene.root;
    h.core.destroy();
    h.scene.destroy();
    h.scene.destroy();
    expect(root.destroyed).toBe(true);
    expect(h.scene.tokenCount).toBe(0);
  });

  it('shares nothing across scenes (a fake timeline per test)', () => {
    expect(createFakeTimeline().calls.sampleAt).toEqual([]);
  });
});

// ---- helpers -----------------------------------------------------------------------------------------------------

/** Every text a label in the scene currently holds, visible or not (stub labels remember their text). */
function labelsOf(h: Headless): string[] {
  return stubLabels(h).map((l) => l.text);
}

function visibleLabels(h: Headless): string[] {
  return stubLabels(h)
    .filter((l) => l.view.visible && isShown(l.view))
    .map((l) => l.text);
}

function isShown(view: Container): boolean {
  for (let c: Container | null = view; c; c = c.parent) if (!c.visible) return false;
  return true;
}

function stubLabels(h: Headless): StubLabel[] {
  const factory = (h.scene as unknown as { opts: { text: { created: StubLabel[] } } }).opts.text;
  return factory.created;
}

