/**
 * vis-003 asks an observer to name the cause of every down. The canvas callout ("Duelist downed by Rook · Pike Thrust")
 * must carry all three (the fallen, the credited fighter, the ability) for the whole of its life (2 s, 40 ticks), on
 * every down of the real simulator's committed rounds, replayed or live. The smoke run's two "ability not named" results
 * (fight 1 down at tick 944, fight 2 at 1135) were not the callout: the smoke reads the DOM only, where the feed puts the
 * ability on a second line, and its line-by-line check returned early after an earlier "interrupted by" line with the
 * same pair; the canvas text is not in the DOM at all.
 */
import { type Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { viewTransform } from '../camera';
import { defaultArenaPalette } from '../colors';
import { timeline } from '../timeline';
import type { ArenaFrameState, EffectRenderState } from '../types';
import { assemble, type Headless } from './testing/headless';
import { defaultContent, defaultCues, loadFixture, makeCtx, truncateLog, type FixtureName } from './testing/real-fixtures';

const FIXTURES: FixtureName[] = ['long', 'a', 'b', 'c', 'd', 'e', 'f'];
/** The down callout lives 2 s (EFFECT_LIFETIME_TICKS.down); check the start, the middle and the last tick or two. */
const AGES = [1, 8, 20, 36];

function onRealModel(): Headless {
  return assemble({ timeline, cues: defaultCues(), content: defaultContent(), viewTransform, palette: defaultArenaPalette('dark') });
}

const isShown = (view: Container): boolean => {
  for (let c: Container | null = view; c; c = c.parent) if (!c.visible) return false;
  return true;
};

/** The callout lines on screen now. */
function callouts(h: Headless): string[] {
  return h.text.created.filter((l) => / downed( |$)/.test(l.text) && isShown(l.view)).map((l) => l.text);
}

describe('the down callout over real rounds', () => {
  it('names the fallen, the credited fighter and the ability on every down, for the callout\'s whole life', async () => {
    const content = defaultContent();
    let checked = 0;
    for (const name of FIXTURES) {
      const { log } = loadFixture(name);
      const ctx = makeCtx(log, 0, 'replay');
      for (const e of log.events) {
        if (e.type !== 'unit.down' || e.unit === undefined || !e.data) continue;
        const d = e.data as { by: number | null; ability: string | null };
        const victim = ctx.units[e.unit]!.className;
        const killer = d.by === null ? null : ctx.units[d.by]!.className;
        const ability = d.ability === null ? null : (content.abilities.get(d.ability as never)?.name ?? d.ability);
        // The sim credits a fighter and an ability on every down (400 random rounds: none without).
        expect(d.by, `${name} tick ${e.tick}`).not.toBeNull();
        expect(d.ability, `${name} tick ${e.tick}`).not.toBeNull();
        const want = new RegExp(`^(Captain )?${victim} downed by ${killer} · ${ability}$`);
        const h = onRealModel();
        await h.core.load(log, ctx);
        for (const age of AGES) {
          h.core.seek(e.tick + age);
          const lines = callouts(h);
          expect(
            lines.some((l) => want.test(l)),
            `${name}: ${victim} downed at tick ${e.tick} by ${killer} with ${ability}; at +${age} ticks the callouts are ${JSON.stringify(lines)}`,
          ).toBe(true);
        }
        h.scene.destroy();
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(40);
  }, 120_000);

  it('does so on a live round, at the head and a second later', async () => {
    const content = defaultContent();
    for (const name of FIXTURES) {
      const { log } = loadFixture(name);
      const ctx = makeCtx(log, 0, 'live');
      const downs = log.events.filter((e) => e.type === 'unit.down' && e.unit !== undefined && e.data);
      for (const e of downs.slice(0, 3)) {
        const d = e.data as { by: number; ability: string };
        const want = new RegExp(`^(Captain )?${ctx.units[e.unit!]!.className} downed by ${ctx.units[d.by]!.className} · ${content.abilities.get(d.ability as never)?.name}$`);
        for (const later of [0, 20]) {
          const h = onRealModel();
          await h.core.load(truncateLog(log, e.tick + later), { ...ctx, startTick: e.tick + later });
          const lines = callouts(h);
          expect(
            lines.some((l) => want.test(l)),
            `${name} live: down at tick ${e.tick}, shown at head ${e.tick + later}: ${JSON.stringify(lines)}`,
          ).toBe(true);
          h.scene.destroy();
        }
      }
    }
  }, 120_000);

  it('never shows an internal id: an ability the content does not know is left out, and an uncredited down still reads', async () => {
    const h = onRealModel();
    const { log } = loadFixture('a');
    await h.core.load(log, makeCtx(log, 0, 'replay'));
    h.core.seek(250);
    const base = h.core.currentState as ArenaFrameState;
    const down = (id: number, over: Partial<EffectRenderState>): EffectRenderState => ({ id, kind: 'down', unit: 3, target: 8, ability: null, x: 0, y: 0, amount: null, crit: false, tone: 'neutral', age: 0.3, ...over });
    const draw = (effects: EffectRenderState[]): void => h.scene.draw({ ...base, projectiles: [], zones: [], telegraphs: [], effects }, { tick: 250, dtMs: 0, speed: 1, playing: false, nowMs: 90_000 });
    draw([down(1, { ability: 'unknown_ability' as never })]);
    expect(callouts(h)).toEqual(['Berserker downed by Archer']); // no raw id
    draw([down(2, { target: null, ability: null })]);
    expect(callouts(h)).toEqual(['Berserker downed']);
    draw([down(3, { target: null, ability: 'longeye_aimed_shot' as never })]);
    expect(callouts(h)).toEqual(['Berserker downed · Aimed Shot']);
  });
});
