/**
 * Feed polish (designer review): a captain's fall is ONE line, and the feed is ONE roving tab stop (Up and Down move
 * between its lines) instead of one tab stop per line.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureContent } from '../../../core/testkit';
import type { KeyMoment } from '../../../render';
import { liveWatchState, roundPlaybackOf, watchWorld } from '../../debug/arena-test-world';
import { buildRoundContext } from './context';
import { feedItems } from './feed';
import { readArenaPalette } from './palette';
import { ArenaFeed } from './Panels';

afterEach(cleanup);

const content = fixtureContent();
function ctxOf() {
  const w = watchWorld(content);
  const state = liveWatchState(w);
  const playback = roundPlaybackOf(state, content, 'live', 1);
  return buildRoundContext({ state, content, playback, match: null, palette: readArenaPalette('dark'), startTick: 0 });
}
const moment = (seq: number, tick: number, kind: KeyMoment['kind'], unit: number | null, target: number | null): KeyMoment => ({ tick, seq, kind, unit, target, ability: null });

describe('a captain going down is one feed line', () => {
  const ctx = ctxOf();
  const name = (u: number) => ctx.units[u]!.name;

  it('the down and the captain-down at the same tick are one line that names him Captain', () => {
    const items = feedItems([moment(1, 400, 'down', 7, 3), moment(2, 400, 'captain-down', 3, null)], ctx, content);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe(`Captain ${name(3)} downed by ${name(7)}`);
    expect(items[0]!.text).toBe(`Captain ${name(3)} downed by ${name(7)}`);
    expect(items[0]!.captain).toBe(true);
    expect(items[0]!.event).toBe('down');
    expect(items[0]!.ours).toBe(true);
  });

  it('a downed fighter who is not the captain, and a down with no cause, read as before', () => {
    const [plain] = feedItems([moment(1, 400, 'down', 7, 3)], ctx, content);
    expect(plain!.title).toBe(`${name(3)} downed by ${name(7)}`);
    expect(plain!.captain).toBeUndefined();
    const [alone] = feedItems([moment(1, 400, 'down', null, 3), moment(2, 400, 'captain-down', 3, null)], ctx, content);
    expect(alone!.title).toBe(`Captain ${name(3)} downed`);
  });

  it('a captain-down that has no down beside it (another tick or another fighter) stays its own line', () => {
    const items = feedItems([moment(1, 400, 'down', 7, 3), moment(2, 400, 'captain-down', 4, null), moment(3, 460, 'captain-down', 3, null)], ctx, content);
    expect(items.map((i) => i.kind)).toEqual(['down', 'captain-down', 'captain-down']);
    expect(items[0]!.captain).toBeUndefined();
  });
});

describe('the feed is one roving tab stop', () => {
  const ctx = ctxOf();
  const many = Array.from({ length: 20 }, (_, i) => moment(i + 1, 100 + i * 10, 'down', 7, i % 2 === 0 ? 3 : 4));
  const items = feedItems(many, ctx, content);
  const mount = () => render(<ArenaFeed items={items} kind="live" playheadTick={1000} onJump={vi.fn()} />);
  const stops = () => screen.getAllByTestId('feed-item').filter((li) => li.tabIndex === 0);

  it('only one line of twenty is in the tab order: the newest', () => {
    mount();
    const lines = screen.getAllByTestId('feed-item');
    expect(lines).toHaveLength(20);
    expect(stops()).toHaveLength(1);
    expect(stops()[0]).toBe(lines[19]);
    for (const li of lines.slice(0, 19)) expect(li.tabIndex).toBe(-1);
  });

  /** An event the feed reacts to, flushed (the roving stop is state). */
  const press = async (el: Element, key: string) => act(async () => void fireEvent.keyDown(el, { key }));

  it('Up and Down move focus and the tab stop together, and stop at the ends', async () => {
    mount();
    const lines = screen.getAllByTestId('feed-item');
    await act(async () => lines[19]!.focus());
    await press(lines[19]!, 'ArrowUp');
    expect(document.activeElement).toBe(lines[18]);
    expect(stops()).toEqual([lines[18]]);
    await press(lines[18]!, 'ArrowUp');
    expect(document.activeElement).toBe(lines[17]);
    await press(lines[17]!, 'ArrowDown');
    expect(document.activeElement).toBe(lines[18]);
    // The ends.
    await act(async () => lines[0]!.focus());
    await press(lines[0]!, 'ArrowUp');
    expect(document.activeElement).toBe(lines[0]);
    await act(async () => lines[19]!.focus());
    await press(lines[19]!, 'ArrowDown');
    expect(document.activeElement).toBe(lines[19]);
    expect(stops()).toEqual([lines[19]]);
  });

  it('a clicked line becomes the tab stop; Enter still jumps to its moment', async () => {
    const onJump = vi.fn();
    render(<ArenaFeed items={items} kind="live" playheadTick={1000} onJump={onJump} />);
    const lines = screen.getAllByTestId('feed-item');
    await act(async () => void fireEvent.click(lines[5]!));
    expect(onJump).toHaveBeenCalledWith(items[5]!.tick);
    expect(stops()).toEqual([lines[5]]);
    await press(lines[5]!, 'Enter');
    expect(onJump).toHaveBeenCalledTimes(2);
  });

  it('the stop survives a new line arriving', async () => {
    const { rerender } = mount();
    const first = screen.getAllByTestId('feed-item');
    await act(async () => first[3]!.focus());
    expect(stops()).toEqual([first[3]]);
    rerender(<ArenaFeed items={feedItems([...many, moment(99, 400, 'down', 7, 3)], ctx, content)} kind="live" playheadTick={1000} onJump={vi.fn()} />);
    await act(async () => undefined);
    expect(screen.getAllByTestId('feed-item')).toHaveLength(21);
    expect(stops()).toHaveLength(1);
    expect(stops()[0]).toBe(screen.getAllByTestId('feed-item')[3]);
  });

  it('an empty feed has no tab stop', () => {
    render(<ArenaFeed items={[]} kind="live" playheadTick={0} onJump={vi.fn()} />);
    expect(screen.queryAllByTestId('feed-item')).toHaveLength(0);
    expect(screen.getByTestId('feed-empty')).toBeTruthy();
  });
});
