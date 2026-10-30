/**
 * The fighter token (owner's design, 2026-10-30): role-coloured disc (split for a hybrid), OVR, the Freshness ring
 * (arc = Freshness, colour = tier from content), the class name, text built once; and the viewer around it (HP bar
 * follows the sampled HP, side ring, downed body) through the real headless scene.
 */
import { type Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import type { ContentDB } from '../../../core/content';
import type { ArenaUnitInfo, RoleId, UnitRenderState } from '../../types';
import { contrastRatio, defaultArenaPalette } from '../../colors';
import type { BodyFrame } from '../../viewer/skin';
import { assemble } from '../../viewer/testing/headless';
import { fakeColors, fakeContent, fakeContext, fakeLog, createFakeTimeline } from '../../viewer/testing/fake-timeline';
import { defaultContent } from '../../viewer/testing/real-fixtures';
import { createStubTokenText, placeholderSkin, freshnessTier, shortRoleLabel, tierColor, type TokenBody } from './index';

const FRAME: BodyFrame = { tick: 0, dtMs: 0, speed: 1, reducedMotion: false, pxPerMetre: 52 };

function state(over: Partial<UnitRenderState> = {}): UnitRenderState {
  const t = createFakeTimeline();
  const index = t.indexFightLog(fakeLog(), fakeContent(), null as never, 'replay');
  return { ...t.sampleAt(index, 100, fakeContext()).units[3]!, ...over };
}

function info(over: Partial<ArenaUnitInfo> = {}): ArenaUnitInfo {
  return { ...fakeContext().units[3]!, roles: ['melee'], className: 'Warrior', overall: 47, freshness: 100, fatigueTag: null, ...over };
}

async function skinWith(content: ContentDB = defaultContent(), theme: 'dark' | 'light' = 'dark') {
  const text = createStubTokenText();
  const skin = placeholderSkin({ text });
  await skin.load({ renderer: null as never, content, palette: defaultArenaPalette(theme) });
  return { skin, text };
}

async function bodyOf(over: Partial<ArenaUnitInfo>, theme: 'dark' | 'light' = 'dark', frame: BodyFrame = FRAME) {
  const { skin, text } = await skinWith(defaultContent(), theme);
  const body = skin.createBody(info(over), fakeColors(0)) as TokenBody;
  body.update(state(), frame);
  return { body, text, skin, shown: () => body.shown() };
}

describe('Freshness tiers come from content', () => {
  it('reads the label and threshold of the tier from levels.json, so renamed or moved tiers need no code', () => {
    const c = defaultContent();
    const tiers = c.levels.freshness.labels;
    for (const l of tiers) {
      expect(freshnessTier(l.min, c)?.id).toBe(l.id);
      expect(freshnessTier(l.min, c)?.label).toBe(l.label);
    }
    expect(freshnessTier(null, c)).toBeNull();
    // A content set with other thresholds and names (the pending 75/50/25 and "Winded"): the tier follows it.
    const moved = { levels: { freshness: { labels: [{ id: 'fresh', label: 'Fresh', min: 75 }, { id: 'ready', label: 'Winded', min: 50 }, { id: 'tired', label: 'Tired', min: 25 }, { id: 'spent', label: 'Spent', min: 0 }] } } } as unknown as ContentDB;
    expect(freshnessTier(70, moved)).toEqual({ id: 'ready', label: 'Winded' });
    expect(freshnessTier(70, c)?.id).toBe('ready'); // the same value in the shipped thresholds
    expect(freshnessTier(55, moved)?.id).toBe('ready');
    expect(freshnessTier(55, c)?.id).toBe('tired');
    expect(freshnessTier(10, moved)?.id).toBe('spent');
  });

  it('colours a tier from the palette, four distinct colours, each at 3:1 on the ring track (the plate), in both themes', () => {
    for (const theme of ['dark', 'light'] as const) {
      const p = defaultArenaPalette(theme);
      const colors = (['fresh', 'ready', 'tired', 'spent'] as const).map((id) => tierColor(id, p));
      expect(new Set(colors).size).toBe(4);
      expect(colors[0]).toBe(p.good);
      expect(colors[1]).toBe(p.warn);
      expect(colors[3]).toBe(p.bad);
      for (const c of colors) expect(contrastRatio(c, p.plate)).toBeGreaterThanOrEqual(3);
      // The disc's role colours also read against the plate band that rings them.
      for (const role of Object.keys(p.roles) as RoleId[]) expect(contrastRatio(p.roles[role], p.plate)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('the token body', () => {
  it('fills the disc with the role colour and shows the overall rating', async () => {
    const p = defaultArenaPalette('dark');
    for (const role of ['tank', 'melee', 'ranged', 'controller', 'healer'] as const) {
      const { shown } = await bodyOf({ roles: [role] });
      expect(shown().fills).toEqual([p.roles[role]]);
      expect(shown().split).toBe(false);
      expect(shown().overall).toBe('47');
    }
    expect((await bodyOf({ overall: null })).shown().overall).toBe('–'); // unknown: a dash, never a guess
  });

  it('splits a hybrid diagonally between its two role colours', async () => {
    const p = defaultArenaPalette('dark');
    const { shown, body } = await bodyOf({ roles: ['melee', 'healer'] });
    expect(shown().split).toBe(true);
    expect(shown().fills).toEqual([p.roles.melee, p.roles.healer]);
    expect(shown().roleLabel).toBe('MEL/HEA');
    // Two filled halves in the disc layer.
    const bounds = (body.view.children[0]!.children[1] as Graphics).getLocalBounds();
    expect(bounds.width).toBeGreaterThan(30);
  });

  it('fills the Freshness ring by the value and colours it by the tier read from content', async () => {
    const c = defaultContent();
    const p = defaultArenaPalette('dark');
    for (const [value, id] of [[100, 'fresh'], [90, 'fresh'], [70, 'ready'], [52, 'tired'], [28, 'spent'], [0, 'spent']] as const) {
      const { shown } = await bodyOf({ freshness: value });
      expect(shown().arc).toBeCloseTo(value / 100, 5);
      expect(shown().tier).toBe(id);
      expect(shown().tierLabel).toBe(freshnessTier(value, c)!.label);
      expect(shown().arcColor).toBe(tierColor(id, p));
    }
    const unknown = (await bodyOf({ freshness: null })).shown();
    expect(unknown.arc).toBe(0);
    expect(unknown.tier).toBeNull();
  });

  it('keeps the ring static during a round: sampled frames never redraw it or the text', async () => {
    const { body, text } = await bodyOf({ freshness: 52 });
    const arc = body.view.children[0]!.children[2] as Graphics;
    const before = arc.context.instructions.length;
    const sets = text.created.map((t) => t.textSets);
    for (let i = 0; i < 120; i++) body.update(state({ hp: 1000 - i * 5 }), { ...FRAME, tick: i, dtMs: 16.7 });
    expect(arc.context.instructions.length).toBe(before);
    expect(text.created.map((t) => t.textSets)).toEqual(sets);
    expect(text.created.length).toBe(4); // OVR number, "OVR", role label, class name: once per fighter
    expect(text.created.every((t) => t.textSets <= 2)).toBe(true); // set at creation (the role label once more when content is known)
    expect(text.created.find((t) => t.kind === 'ovr')!.text).toBe('47');
    expect(text.created.find((t) => t.kind === 'class')!.text).toBe('Warrior');
  });

  it('prints the short role label from content at the default size, and glyphs only where it cannot fit', async () => {
    const c = defaultContent();
    // One place: combat.json archetypes shortName (translatable with the content).
    for (const a of c.combat.archetypes) expect(shortRoleLabel([a.id as RoleId], c)).toBe(a.shortName);
    expect(shortRoleLabel(['melee', 'healer'], c)).toBe('MEL/HEA');
    expect(shortRoleLabel(['tank'], null)).toBe('TAN'); // no content: the id, never nothing
    for (const ppm of [27, 35, 46]) {
      for (const roles of [['melee'], ['melee', 'healer'], ['controller', 'ranged']] as RoleId[][]) {
        const { shown, text } = await bodyOf({ roles }, 'dark', { ...FRAME, pxPerMetre: ppm });
        expect(shown().roleMark).toBe('label');
        const label = text.created.find((t) => t.kind === 'small' && t.text === shortRoleLabel(roles, c))!;
        expect(label.size).toBeGreaterThanOrEqual(6.5);
      }
    }
    // A label content cannot fit (a long custom short name at the smallest token) falls back to the glyphs.
    const long = { ...c, combat: { ...c.combat, archetypes: c.combat.archetypes.map((a) => ({ ...a, shortName: 'VERYLONGNAME' })) } } as unknown as ContentDB;
    const { skin } = await skinWith(long);
    const body = skin.createBody(info({ roles: ['melee', 'healer'] }), fakeColors(0)) as TokenBody;
    body.update(state(), { ...FRAME, pxPerMetre: 27 });
    expect(body.shown().roleMark).toBe('glyphs');
  });

  it('shows the OVR caption from 56 px (the 1920 view) and keeps the number at every size', async () => {
    const small = await bodyOf({}, 'dark', { ...FRAME, pxPerMetre: 27 });
    const caption = (t: typeof small) => t.text.created.find((x) => x.text === 'OVR')!.view.visible;
    expect(caption(small)).toBe(false);
    expect(small.text.created.find((x) => x.kind === 'ovr')!.size).toBeGreaterThanOrEqual(17);
    const normal = await bodyOf({}, 'dark', { ...FRAME, pxPerMetre: 46 });
    expect(normal.shown().diameter).toBe(60);
    expect(caption(normal)).toBe(true);
  });

  it('redraws for a new theme and re-bakes the text once (palette change, not per frame)', async () => {
    const { skin, body, text } = await bodyOf({ roles: ['healer'], freshness: 52 });
    const dark = body.shown();
    skin.setPalette(defaultArenaPalette('light'));
    expect(text.configured).toBeGreaterThanOrEqual(2);
    body.update(state(), FRAME);
    expect(body.shown().fills).toEqual([defaultArenaPalette('light').roles.healer]);
    expect(body.shown().fills).not.toEqual(dark.fills);
    expect(body.shown().arcColor).toBe(tierColor('tired', defaultArenaPalette('light')));
  });

  it('flattens and fades when downed, and hides the class name', async () => {
    const { body } = await bodyOf({});
    const token = body.view.children[0]!;
    body.update(state({ standing: false }), FRAME);
    expect(token.scale.y).toBeCloseTo(0.6, 5);
    expect(body.view.alpha).toBeCloseTo(0.4, 5);
    expect(body.view.children[1]!.visible).toBe(false);
    body.update(state({ standing: true }), FRAME);
    expect(token.scale.y).toBe(1);
    expect(body.view.children[1]!.visible).toBe(true);
  });

  it('survives without text (a host with no canvas 2D) and releases its text on destroy', async () => {
    const skin = placeholderSkin();
    await skin.load({ renderer: null as never, content: defaultContent(), palette: defaultArenaPalette('dark') });
    const body = skin.createBody(info(), fakeColors(0)) as TokenBody;
    body.update(state(), FRAME);
    expect(body.shown().overall).toBe('47');
    const { skin: s2, text } = await skinWith();
    const b2 = s2.createBody(info(), fakeColors(0));
    b2.destroy();
    expect(text.created.every((t) => t.view.destroyed)).toBe(true);
  });
});

describe('the viewer around the token', () => {
  it('draws the HP bar from the sampled HP, keeps the side ring and no second role plate', async () => {
    const h = assemble();
    await h.core.load(fakeLog(), fakeContext({ kind: 'replay' }));
    const bars: number[] = [];
    for (const tick of [0, 100, 250, 400, 600]) {
      h.core.seek(tick);
      const u = h.core.currentState!.units[1]!;
      const t = h.scene.tokenOf(1)!;
      const shown = t.shown();
      if (u.standing) {
        const px = shown.hpPx;
        bars.push(px);
        expect(px).toBeCloseTo(Math.max(0, Math.min(1, u.hp / Math.max(1, u.maxHp, u.hp + (u.shield ?? 0)))) * (t.overlay.getBounds().width - 2), -1);
      }
      expect(shown.plateRadius).toBe(0); // the token body draws the roles itself
    }
    expect(new Set(bars).size).toBeGreaterThan(1); // it moved with the fight
  });

  it('draws the selected and the hovered token (with its bars and pips) above every other', async () => {
    const h = assemble();
    await h.core.load(fakeLog(), fakeContext({ kind: 'replay' }));
    h.core.seek(250);
    const top = (unit: number, layer: 'root' | 'overlay') => {
      const z = h.scene.tokenOf(unit)![layer].zIndex;
      for (let i = 0; i < 10; i++) if (i !== unit) expect(z).toBeGreaterThan(h.scene.tokenOf(i)![layer].zIndex);
    };
    h.core.select(4);
    h.core.seek(251);
    top(4, 'root');
    top(4, 'overlay');
    h.core.select(null);
    h.core.hover(7);
    top(7, 'root');
    top(7, 'overlay');
    h.core.hover(null);
    expect(h.scene.tokenOf(7)!.raised).toBe(false);
  });

  it('hides a class name only where another token\'s stack overlaps it, never the raised token\'s', async () => {
    const h = assemble();
    await h.core.load(fakeLog(), fakeContext({ kind: 'replay' }));
    h.core.setLabels('all');
    const classShown = (u: number) => (h.skin.bodies[u]!.view.children[1] as { visible: boolean }).visible;
    for (const tick of [0, 120, 250, 400]) {
      h.core.seek(tick);
      for (let a = 0; a < 10; a++) {
        const A = h.scene.tokenOf(a)!;
        if (!A.standing) {
          expect(classShown(a)).toBe(false);
          continue;
        }
        const overlapped = [...Array(10).keys()].some((b) => {
          const B = h.scene.tokenOf(b)!;
          if (b === a || !B.standing || B.stackAbove <= 0) return false;
          const dy = B.screenY - A.screenY;
          return dy > 0 && dy < A.belowReach + B.stackAbove && Math.abs(B.screenX + B.stackShift - A.screenX) < A.belowHalfWidth + B.stackHalfWidth;
        });
        expect(classShown(a)).toBe(A.raised || !overlapped);
      }
    }
    h.core.select(0);
    h.core.seek(250);
    if (h.scene.tokenOf(0)!.standing) expect(classShown(0)).toBe(true);
  });

  it('sizes the ring and stack to the token at a small zoom (27 px/m -> a 44 px disc)', async () => {
    const small = assemble({ viewTransform: (_c, vp, a) => ({ pxPerMetre: 27, toScreen: (x, y) => ({ x: (x / a.width) * vp.width, y: (y / a.height) * vp.height }), toWorld: () => ({ x: 0, y: 0 }) }) });
    await small.core.load(fakeLog(), fakeContext({ kind: 'replay' }));
    small.core.seek(250);
    expect(small.scene.tokenOf(1)!.shown().stackBelow).toBeDefined();
  });
});
