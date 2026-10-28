/**
 * The dev harness (see harness.html): the real createArenaViewer over the scripted fake Timeline, in a real browser.
 * It is how WP-M2D proves WebGL canvas capture, reads an early frame rate and runs the 20-round teardown check, and a
 * starting point for the smoke (WP-M2F). Not bundled into the app.
 */
import { DEFAULT_CAMERA } from '../../camera';
import { createArenaViewer, defaultArenaPalette, type ArenaViewer } from '../index';
import { createFakeTimeline, fakeContent, fakeContext, fakeCues, fakeLog, fakeViewTransform } from '../testing/fake-timeline';

const q = new URLSearchParams(location.search);
const theme = q.get('theme') === 'light' ? 'light' : 'dark';
const reduced = q.get('reduced') === '1';
const host = document.getElementById('host') as HTMLElement;
const hud = document.getElementById('hud') as HTMLElement;
document.body.style.background = theme === 'light' ? '#e9e5dc' : '#0e1013';
document.body.style.color = theme === 'light' ? '#1d1c19' : '#ebe6da';

const timeline = createFakeTimeline();
const frames: number[] = [];

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
  const viewer: ArenaViewer = await createArenaViewer({
    host,
    content: fakeContent(),
    palette: defaultArenaPalette(theme),
    reducedMotion: reduced,
    timeline,
    cues: fakeCues(),
    viewTransform: fakeViewTransform,
    camera: { ...DEFAULT_CAMERA },
    onFrame: (s) => {
      frames.push(s.tick);
      hud.textContent = `tick ${s.tick.toFixed(1)}  ${s.fightSeconds.toFixed(1)} s  standing ${s.standing.home}-${s.standing.away}${s.overtime ? '  OVERTIME' : ''}`;
    },
    onStop: (stop) => {
      hud.textContent += `  [stop: ${stop.kind}]`;
    },
  });
  const log = fakeLog();
  const ctx = fakeContext({ kind: 'replay' });
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

  const api = {
    viewer,
    timeline,
    log,
    ctx,
    frames,
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
      viewer.setAutoPause({ ownDowned: false, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: null });
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
        const v = await createArenaViewer({ host: scratch, content: fakeContent(), palette: defaultArenaPalette(theme), reducedMotion: false, timeline: createFakeTimeline(), cues: fakeCues(), viewTransform: fakeViewTransform });
        await v.load(fakeLog(), fakeContext({ kind: 'replay' }));
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
    /** Load the round `n` times back to back, playing a little each time (the teardown check). */
    async rounds(n: number, playMs: number): Promise<void> {
      for (let i = 0; i < n; i++) {
        await viewer.load(fakeLog(), fakeContext({ kind: 'replay' }));
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
