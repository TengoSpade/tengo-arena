/**
 * Away matches (designer review, item 4): the HUD and the fighter strip put HOME on the left and AWAY on the right, as the
 * report does, whichever side the player is on. The player's side is cued by the "You" tag and the ring style (solid for
 * ours, double for theirs), not by the place.
 */
import { signal } from '@preact/signals';
import { cleanup, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { fixtureContent } from '../../../core/testkit';
import { liveWatchState, roundPlaybackOf, watchWorld } from '../../debug/arena-test-world';
import { buildHud, buildRoundContext } from './context';
import { ArenaHud } from './Hud';
import { readArenaPalette } from './palette';
import type { ViewerSnap } from './session';
import { ArenaStrip } from './Strip';

afterEach(cleanup);

function setup(playerSide: 0 | 1) {
  const content = fixtureContent();
  const w = watchWorld(content);
  const state = liveWatchState(w);
  const playback = roundPlaybackOf(state, content, 'live', 1);
  const base = buildRoundContext({ state, content, playback, match: null, palette: readArenaPalette('dark'), startTick: 0 });
  // The same fixture round, seen by the other club's manager when playerSide is 1 (the away side).
  const ctx = { ...base, playerSide };
  const hud = buildHud({ state, ctx, playback, kind: 'live' });
  return { ctx, hud, state };
}

const snap = signal<ViewerSnap>({ playing: false, tick: 0, head: 0, end: null, speed: 1 });

function mount(playerSide: 0 | 1) {
  const { ctx, hud } = setup(playerSide);
  render(
    <>
      <ArenaHud info={hud} frame={signal(null)} snap={snap} overtime={{ startS: 60, capS: 75 }} onToggle={() => undefined} onSpeed={() => undefined} />
      <ArenaStrip ctx={ctx} hud={hud} frame={signal(null)} selected={signal(null)} downCause={() => null} onSelect={() => undefined} onToggle={() => undefined} onInspect={() => undefined} roleName={(r) => r} />
    </>,
  );
  return { ctx, hud };
}

describe('home left, away right, whoever the player is', () => {
  it('the player at home: the player left, "You" on the left', () => {
    const { hud } = mount(0);
    expect(hud.left.side).toBe(0);
    expect(screen.getByTestId('hud-left').getAttribute('data-side')).toBe('us');
    expect(screen.getByTestId('hud-left').textContent).toContain('You');
    expect(screen.getByTestId('hud-right').getAttribute('data-side')).toBe('them');
    expect(screen.getByTestId('hud-right').textContent).not.toContain('You');
  });

  it('the player away: still home left; "You" and the solid ring are on the right', () => {
    const { ctx, hud } = mount(1);
    expect(hud.left.side).toBe(0);
    expect(hud.right.side).toBe(1);
    expect(hud.left.name).toBe(ctx.sides[0].name);
    expect(hud.right.name).toBe(ctx.sides[1].name);
    expect(screen.getByTestId('hud-left').textContent).toContain(ctx.sides[0].name);
    expect(screen.getByTestId('hud-left').getAttribute('data-side')).toBe('them');
    expect(screen.getByTestId('hud-left').textContent).not.toContain('You');
    expect(screen.getByTestId('hud-right').textContent).toContain(ctx.sides[1].name);
    expect(screen.getByTestId('hud-right').getAttribute('data-side')).toBe('us');
    expect(screen.getByTestId('hud-right').textContent).toContain('You');
  });

  it('the strip follows: the home cards on the left, the player\'s cards (the away side) on the right with the solid cue', () => {
    const { ctx } = mount(1);
    const strip = screen.getByTestId('arena-strip');
    const groups = strip.querySelectorAll('.astrip__side');
    expect(groups).toHaveLength(2);
    const homeUnits = ctx.units.filter((u) => u.side === 0).map((u) => `strip-unit-${u.unit}`);
    const awayUnits = ctx.units.filter((u) => u.side === 1).map((u) => `strip-unit-${u.unit}`);
    expect([...groups[0]!.querySelectorAll('button')].map((b) => b.getAttribute('data-testid')).sort()).toEqual([...homeUnits].sort());
    expect([...groups[1]!.querySelectorAll('button')].map((b) => b.getAttribute('data-testid')).sort()).toEqual([...awayUnits].sort());
    // Ours is the right-hand group: its cards carry the solid 'us' cue and say "your side"; the left group says opponent.
    for (const b of groups[1]!.querySelectorAll('button')) {
      expect(b.getAttribute('data-side')).toBe('us');
      expect(b.getAttribute('aria-label')).toContain('your side');
    }
    for (const b of groups[0]!.querySelectorAll('button')) expect(b.getAttribute('data-side')).toBe('them');
    expect(within(strip).getAllByRole('group')[1]!.getAttribute('aria-label')).toContain('your side');
  });

  it('a match between other clubs (no player side) keeps home left with the neutral cue', () => {
    const { ctx, state } = setup(0);
    const playback = roundPlaybackOf(state, fixtureContent(), 'live', 1);
    const neutral = buildHud({ state, ctx: { ...ctx, playerSide: null }, playback, kind: 'replay' });
    expect(neutral.left.side).toBe(0);
    expect(neutral.left.ours).toBe(false);
    expect(neutral.right.ours).toBe(false);
  });
});

describe('the Freshness tag replaces the class name on a strip card', () => {
  it('a tired fighter shows the tag and no class text (the class stays in the accessible name); the others show the class', () => {
    const { ctx, hud } = setup(0);
    const units = ctx.units.map((u) => (u.unit === 2 ? { ...u, fatigueTag: 'tired' as const, freshness: 52 } : u));
    render(<ArenaStrip ctx={{ ...ctx, units }} hud={hud} frame={signal(null)} selected={signal(null)} downCause={() => null} onSelect={() => undefined} onToggle={() => undefined} onInspect={() => undefined} roleName={(r) => r} />);
    const tired = screen.getByTestId('strip-unit-2');
    expect(tired.querySelector('[data-testid="strip-fresh-2"]')).toBeTruthy();
    expect(tired.querySelector('.afighter__class')).toBeNull();
    expect(tired.getAttribute('aria-label')).toContain(ctx.units[2]!.className);
    const other = screen.getByTestId('strip-unit-1');
    expect(other.querySelector('.afighter__class')!.textContent).toBe(ctx.units[1]!.className);
  });
});
