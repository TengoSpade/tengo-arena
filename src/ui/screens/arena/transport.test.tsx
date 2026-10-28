/**
 * The transport at narrow widths (designer review, item 3): below 1400 px Skip, Simulate and Dock are icons with
 * accessible names, and scrubber marks closer than 12 px on the track are one mark that says how many it stands for.
 */
import { signal } from '@preact/signals';
import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArenaControls } from './Controls';
import type { FeedItem } from './feed';
import { mergeMarks } from './marks';
import type { ArenaSession, ViewerSnap } from './session';

const item = (key: string, tick: number, over: Partial<FeedItem> = {}): FeedItem => ({
  key,
  tick,
  kind: 'down',
  side: 0,
  mark: 'us',
  ours: true,
  event: 'down',
  title: `moment ${key}`,
  detail: '',
  text: `moment ${key}`,
  time: `0:${String(Math.floor(tick / 20)).padStart(2, '0')}`,
  ...over,
});

const at = (tick: number): number => tick / 1500; // the live track: 75 s = 1,500 ticks

describe('mergeMarks', () => {
  it('merges marks of one side closer than 12 px, measured from the first of the group', () => {
    // 150 px for 1,500 ticks: 12 px = 120 ticks.
    const marks = [item('a', 200), item('b', 230), item('c', 310), item('d', 330), item('e', 700)];
    const groups = mergeMarks(marks, at, 150);
    // a, b, c are within 120 ticks of a (c is 110 away); d (130 away) starts the next group with e alone.
    expect(groups.map((g) => g.items.map((m) => m.key))).toEqual([['a', 'b', 'c'], ['d'], ['e']]);
    expect(groups[0]!.tick).toBe(200);
  });

  it('keeps the two sides apart (ours above the track, theirs below)', () => {
    const groups = mergeMarks([item('a', 200), item('b', 205, { mark: 'them' }), item('c', 210)], at, 150);
    expect(groups.map((g) => [g.lane, g.items.map((m) => m.key)])).toEqual([
      ['us', ['a', 'c']],
      ['them', ['b']],
    ]);
  });

  it('a group is led by its down, and an unmeasured track merges nothing', () => {
    const rule = item('r', 300, { kind: 'rally', event: 'rule' });
    const down = item('d', 310);
    const [g] = mergeMarks([rule, down], at, 150);
    expect(g!.lead.key).toBe('d');
    expect(mergeMarks([item('a', 200), item('b', 201)], at, 0)).toHaveLength(2);
  });

  it('a wide track merges less than a narrow one', () => {
    const marks = [item('a', 200), item('b', 260)];
    expect(mergeMarks(marks, at, 150)).toHaveLength(1); // 6 px apart
    expect(mergeMarks(marks, at, 1200)).toHaveLength(2); // 48 px apart
  });
});

function stubSession(): ArenaSession {
  const snap = signal<ViewerSnap>({ playing: false, tick: 400, head: 1500, end: null, speed: 1 });
  return {
    status: signal('ready'),
    error: signal(null),
    frame: signal(null),
    snap,
    moments: signal([]),
    selected: signal(null),
    lastStop: signal(null),
    viewer: () => null,
    play: () => undefined,
    pause: () => undefined,
    toggle: () => undefined,
    setSpeed: () => undefined,
    cycleSpeed: () => undefined,
    seek: () => undefined,
    step: () => undefined,
    live: () => undefined,
  } as unknown as ArenaSession;
}

function mountControls(marks: FeedItem[] = []) {
  return render(<ArenaControls session={stubSession()} kind="live" capTicks={1500} marks={marks} statusNote={null} dockOpen onToggleDock={() => undefined} onSkip={() => undefined} onSimulateRest={() => undefined} busy={false} />);
}

describe('the transport: collapsible buttons and merged marks', () => {
  const realRect = HTMLElement.prototype.getBoundingClientRect;
  const trackWidth = (px: number) =>
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const w = this.classList.contains('ascrub') ? px : 0;
      return { width: w, height: 0, top: 0, left: 0, right: w, bottom: 0, x: 0, y: 0, toJSON: () => ({}) };
    });
  afterEach(() => {
    cleanup();
    HTMLElement.prototype.getBoundingClientRect = realRect;
    vi.restoreAllMocks();
  });

  it('Skip, Simulate and Dock are collapsible buttons (the designer hides the label and key hint below 1600 px): each keeps its full name', () => {
    mountControls();
    const names: Record<string, RegExp> = { 'arena-skip': /^Skip/, 'arena-simulate-rest': /^Simulate/, 'arena-dock-toggle': /^Dock$/ };
    for (const [id, name] of Object.entries(names)) {
      const b = screen.getByTestId(id);
      expect(b.classList.contains('btn--collapse')).toBe(true);
      // Icon, label and key hint are separate parts so the CSS can drop the last two; the name does not depend on them.
      expect(b.querySelector('[data-icon]')).toBeTruthy();
      expect(b.querySelector('.btn__label')!.textContent!.length).toBeGreaterThan(3);
      expect(b.querySelector('kbd')).toBeTruthy();
      expect(b.getAttribute('aria-label') ?? '').toMatch(name);
      expect(b.getAttribute('aria-keyshortcuts')).toBeTruthy();
      expect(b.getAttribute('data-tip') ?? b.getAttribute('title') ?? '').toMatch(/(.+)$/);
    }
    expect(screen.getByTestId('arena-dock-toggle').querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('dock');
    expect(screen.getByTestId('arena-dock-toggle').getAttribute('aria-pressed')).toBe('true');
  });

  it('marks closer than 12 px on the track are one, with their count; the sides stay apart', () => {
    trackWidth(150);
    mountControls([item('a', 200), item('b', 230), item('c', 250), item('d', 400), item('t', 205, { mark: 'them', ours: false })]);
    const drawn = [...screen.getByTestId('arena-marks').querySelectorAll('.amark')];
    expect(drawn.map((m) => [m.getAttribute('data-side'), m.getAttribute('data-tick'), m.getAttribute('data-count')])).toEqual([
      ['us', '200', '3'],
      ['them', '205', null],
      ['us', '400', null],
    ]);
    const tip = drawn[0]!.getAttribute('data-tip') ?? drawn[0]!.getAttribute('title') ?? '';
    expect(tip).toContain('3 moments from 0:10');
  });

  it('on a wider track the same marks stay separate; unmeasured, nothing merges', () => {
    trackWidth(1200);
    mountControls([item('a', 200), item('b', 230), item('c', 250)]);
    expect(screen.getByTestId('arena-marks').querySelectorAll('.amark')).toHaveLength(3);
    cleanup();
    trackWidth(0);
    mountControls([item('a', 200), item('b', 230), item('c', 250)]);
    expect(screen.getByTestId('arena-marks').querySelectorAll('.amark')).toHaveLength(3);
  });
});
