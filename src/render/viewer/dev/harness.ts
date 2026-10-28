/**
 * The dev harness (see harness.html): the real createArenaViewer in a real browser, over the REAL timeline, cue table,
 * camera and content with a committed simulator log (src/render/timeline/fixtures), or with `?fake=1` over the scripted
 * fake Timeline (src/render/viewer/testing). It is how WP-M2D proves WebGL canvas capture, reads an early frame rate and
 * runs the teardown checks, and a starting point for the smoke (WP-M2F). Not bundled into the app.
 */
import type { ContentDB } from '../../../core/content';
import type { FightLog } from '../../../core/model';
import { DEFAULT_CAMERA } from '../../camera';
import { defaultArenaPalette } from '../../colors';
import { buildCueTable } from '../../cues';
import { placeholderSkin } from '../../skins/placeholder';
import type { Timeline } from '../../timeline';
import type { ArenaPalette, ArenaRoundContext, CueTable, PlaybackStop, ViewTransformFn } from '../../types';
import { createArenaViewer, type ArenaSkin, type ArenaViewer } from '../index';
import { createFakeTimeline, fakeContent, fakeContext, fakeCues, fakeLog, fakeViewTransform } from '../testing/fake-timeline';
import { FIXTURES, realContent, realContext, realLog } from './real';

const q = new URLSearchParams(location.search);
const theme = q.get('theme') === 'light' ? 'light' : 'dark';
const reduced = q.get('reduced') === '1';
const fake = q.get('fake') === '1';
const host = document.getElementById('host') as HTMLElement;
const hud = document.getElementById('hud') as HTMLElement;
document.body.style.background = theme === 'light' ? '#e9e5dc' : '#0e1013';
document.body.style.color = theme === 'light' ? '#1d1c19' : '#ebe6da';

const frames: number[] = [];
/** A test can set this to act inside onStop (call play(), as a UI might). */
let stopHook: ((stop: PlaybackStop) => void) | null = null;

/** What the harness feeds the viewer: the real modules, or the scripted fakes. */
interface Kit {
  name: 'real' | 'fake';
  content: ContentDB;
  cues: CueTable;
  /** Undefined = the viewer's default (the real timeline). */
  timeline: Timeline | undefined;
  viewTransform: ViewTransformFn | undefined;
  palette: ArenaPalette;
  log(): Promise<FightLog>;
  ctx(log: FightLog, kind?: 'live' | 'replay'): ArenaRoundContext;
}

async function makeKit(): Promise<Kit> {
  const palette = defaultArenaPalette(theme);
  if (fake) {
    return { name: 'fake', content: fakeContent(), cues: fakeCues(), timeline: createFakeTimeline(), viewTransform: fakeViewTransform, palette, log: () => Promise.resolve(fakeLog()), ctx: (_log, kind = 'replay') => fakeContext({ kind }) };
  }
  const content = realContent();
  const logs = new Map<string, FightLog>();
  const name = FIXTURES.includes(q.get('fixture') as never) ? (q.get('fixture') as (typeof FIXTURES)[number]) : 'long';
  return {
    name: 'real',
    content,
    cues: buildCueTable(content),
    timeline: undefined,
    viewTransform: undefined,
    palette,
    async log() {
      let l = logs.get(name);
      if (!l) {
        l = await realLog(name);
        logs.set(name, l);
      }
      return l;
    },
    ctx: (log, kind = 'replay') => realContext(log, content, kind, 0, theme),
  };
}

export interface HarnessMeasure {
  n: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  fps: number;
  cpuP50: number;
  cpuP95: number;
}

async function main(): Promise<void> {
  const kit = await makeKit();
  const options = (h: HTMLElement = host): Parameters<typeof createArenaViewer>[0] => ({ host: h, content: kit.content, palette: kit.palette, reducedMotion: reduced, cues: kit.cues, ...(kit.timeline ? { timeline: kit.timeline } : {}), ...(kit.viewTransform ? { viewTransform: kit.viewTransform } : {}) });
  const viewer: ArenaViewer = await createArenaViewer({
    ...options(),
    camera: { ...DEFAULT_CAMERA },
    onFrame: (s) => {
      frames.push(s.tick);
      hud.textContent = `tick ${s.tick.toFixed(1)}  ${s.fightSeconds.toFixed(1)} s  standing ${s.standing.home}-${s.standing.away}${s.overtime ? '  OVERTIME' : ''}`;
    },
    onStop: (stop) => {
      hud.textContent += `  [stop: ${stop.kind}]`;
      stopHook?.(stop);
    },
  });
  const log = await kit.log();
  const ctx = kit.ctx(log);
  await viewer.load(log, ctx);
  viewer.setSpeed((Number(q.get('speed')) as 1 | 2 | 4) || 1);
  if (q.get('tick')) viewer.seek(Number(q.get('tick')));
  if (q.get('labels')) viewer.setLabels(q.get('labels') as 'all');
  if (q.get('select')) viewer.select(Number(q.get('select')));
  if (q.get('play') === '1') viewer.play();
  document.querySelector('#bar')?.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).dataset['act'];
    if (act === 'play') viewer.play();
    else if (act === 'pause') viewer.pause();
    else if (act === 'seek') viewer.seek(320);
    else if (act === '1' || act === '2' || act === '4') viewer.setSpeed(Number(act) as 1 | 2 | 4);
  });

  const toCanvas = async (): Promise<{ canvas: HTMLCanvasElement; bytes: number; scale: number }> => {
    const blob = await viewer.snapshot();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0);
    return { canvas, bytes: blob.size, scale: bmp.width / host.clientWidth };
  };
  const NO_PAUSE = { ownDowned: false, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: null };

  const api = {
    kit: kit.name,
    viewer,
    log,
    ctx,
    frames,
    setStopHook(fn: ((stop: PlaybackStop) => void) | null): void {
      stopHook = fn;
    },
    /** The RGBA of one pixel of the snapshot at a position in CSS px. */
    async pixelAt(x: number, y: number): Promise<number[]> {
      const { canvas, scale } = await toCanvas();
      return Array.from(canvas.getContext('2d')!.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data);
    },
    /** The snapshot: its size, whether it holds more than one colour, and (optionally) the PNG as a data URL. */
    async capture(withData = false): Promise<{ bytes: number; width: number; height: number; distinctColours: number; dataUrl: string | null }> {
      const { canvas, bytes } = await toCanvas();
      const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < data.length; i += 4 * 97) seen.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
      return { bytes, width: canvas.width, height: canvas.height, distinctColours: seen.size, dataUrl: withData ? canvas.toDataURL('image/png') : null };
    },
    /** toDataURL() on the live canvas, which is what the F8 screenshot library reads: its length and a non-blank check. */
    async liveCanvasDataUrl(): Promise<{ length: number; distinctColours: number }> {
      const canvas = host.querySelector('canvas') as HTMLCanvasElement;
      const url = canvas.toDataURL('image/png');
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, c.width, c.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < data.length; i += 4 * 97) seen.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
      return { length: url.length, distinctColours: seen.size };
    },
    /** Frame intervals (ms) over `ms` of real playback at `speed`, from requestAnimationFrame, independent of the viewer. */
    async measure(ms: number, speed: 1 | 2 | 4): Promise<HarnessMeasure> {
      viewer.pause();
      viewer.seek(0);
      viewer.setAutoPause(NO_PAUSE);
      viewer.setSpeed(speed);
      viewer.play();
      const intervals: number[] = [];
      let last = performance.now();
      const start = last;
      await new Promise<void>((resolve) => {
        const step = (): void => {
          const now = performance.now();
          intervals.push(now - last);
          last = now;
          if (now - start < ms) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      const stats = viewer.stats();
      viewer.pause();
      const sorted = intervals.slice(2).sort((a, b) => a - b);
      const pick = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
      const mean = sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length);
      return { n: sorted.length, medianMs: pick(0.5), p95Ms: pick(0.95), maxMs: sorted.at(-1) ?? 0, fps: 1000 / mean, cpuP50: stats.frameMsP50, cpuP95: stats.frameMsP95 };
    },
    /** Create, use and destroy n whole viewers (each its own WebGL context) in a throwaway host: the destroy check. */
    async cycle(n: number): Promise<{ canvasesLeft: number }> {
      const scratch = document.createElement('div');
      scratch.style.cssText = 'position:absolute;left:0;top:0;width:640px;height:360px;visibility:hidden';
      document.body.appendChild(scratch);
      for (let i = 0; i < n; i++) {
        const v = await createArenaViewer(options(scratch));
        await v.load(await kit.log(), kit.ctx(await kit.log()));
        v.setSpeed(4);
        v.play();
        await new Promise((r) => setTimeout(r, 120));
        v.destroy();
        v.destroy(); // idempotent
      }
      const left = scratch.querySelectorAll('canvas').length;
      scratch.remove();
      return { canvasesLeft: left };
    },
    /** Failed creations leave nothing behind: a skin that fails to load, a cue table that cannot be built, no WebGL. */
    async failures(): Promise<{ skin: string; cues: string; webgl: string; canvasesLeft: number }> {
      const scratch = document.createElement('div');
      scratch.style.cssText = 'position:absolute;left:0;top:0;width:640px;height:360px;visibility:hidden';
      document.body.appendChild(scratch);
      const message = (e: unknown): string => (e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e));
      const inner = placeholderSkin();
      const bad: ArenaSkin = { id: 'bad', load: () => Promise.reject(new Error('skin boom')), prepare: (u) => inner.prepare(u), createBody: (i, c) => inner.createBody(i, c), createFloor: (a, p) => inner.createFloor(a, p), setPalette: (p) => inner.setPalette(p), destroy: () => inner.destroy() };
      let skin = 'resolved';
      let cues = 'resolved';
      let webgl = 'resolved';
      try {
        await createArenaViewer({ ...options(scratch), skin: bad });
      } catch (e) {
        skin = message(e);
      }
      try {
        // No cue table and content the cue builder cannot read: buildCueTable throws after init.
        const { cues: _omit, ...rest } = options(scratch);
        void _omit;
        await createArenaViewer({ ...rest, content: {} as ContentDB });
      } catch (e) {
        cues = message(e);
      }
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = (() => null) as typeof getContext;
      try {
        await createArenaViewer(options(scratch));
      } catch (e) {
        webgl = message(e);
      } finally {
        HTMLCanvasElement.prototype.getContext = getContext;
      }
      const left = scratch.querySelectorAll('canvas').length;
      scratch.remove();
      return { skin, cues, webgl, canvasesLeft: left };
    },
    /** How many times aria-label of the canvas is rewritten during `ms` of playback, and during a pause that follows. */
    async ariaWrites(ms: number): Promise<{ whilePlaying: number; afterPause: number }> {
      const canvas = host.querySelector('canvas') as HTMLCanvasElement;
      const mo = new MutationObserver(() => undefined);
      mo.observe(canvas, { attributes: true, attributeFilter: ['aria-label'] });
      viewer.pause();
      viewer.seek(0);
      viewer.setAutoPause(NO_PAUSE);
      await new Promise((r) => setTimeout(r, 50));
      mo.takeRecords();
      viewer.play();
      await new Promise((r) => setTimeout(r, ms));
      const whilePlaying = mo.takeRecords().length;
      viewer.pause();
      const afterPause = mo.takeRecords().length;
      mo.disconnect();
      return { whilePlaying, afterPause };
    },
    /** Load the round `n` times back to back, playing a little each time (the teardown check). */
    async rounds(n: number, playMs: number): Promise<void> {
      for (let i = 0; i < n; i++) {
        const l = await kit.log();
        await viewer.load(l, kit.ctx(l));
        viewer.setSpeed(4);
        viewer.play();
        await new Promise((r) => setTimeout(r, playMs));
        viewer.pause();
      }
    },
  };
  (window as unknown as { __harness: typeof api }).__harness = api;
  document.documentElement.dataset['ready'] = '1';
}

main().catch((e: unknown) => {
  document.documentElement.dataset['error'] = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
  console.error(e);
});
