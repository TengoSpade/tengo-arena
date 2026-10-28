/**
 * Camera and projection (05-technical-m2 §A5; WP-M2C). PURE, so the scene, pointer hit-testing
 * and tests share one transform. The projection is configuration, not code paths: M2 is top-down with fixed
 * framing (owner answer to Q55), and a 3/4 view, zoom and follow come with the sprite decision (art §12 Q4)
 * without touching the sim or the render-state model.
 */
import { InvariantError } from '../../core/util';
import type { CameraConfig, ViewTransform } from '../types';

/** M2 (approved, Q55): top-down orthographic, whole arena, no zoom or follow (04 §4). */
export const DEFAULT_CAMERA: CameraConfig = {
  projection: { kind: 'top-down' },
  zoom: 1,
  follow: null,
  padding: { top: 56, right: 16, bottom: 72, left: 16 },
  easeMs: 220,
};

/** An oblique view tilts at most this far from top-down (90 would be edge-on and collapse the floor). */
export const MAX_TILT_DEG = 80;

/**
 * The world-to-screen transform for a viewport of `width` × `height` CSS px and an arena of
 * `arenaCm` (the log header's arena): letterboxed to fit inside the padding at zoom 1, centred on
 * `focusCm` (the followed unit) when zoomed, clamped so the arena edge never leaves the screen.
 *
 * Conventions: world x east, y south, in centimetres; screen x right, y down, in CSS px from the viewport's top-left.
 * - top-down: screen = centre + (world - focus) × scale. `heightCm` has no effect (an orthographic view from above).
 * - oblique (tilt from top-down): world y is squashed by cos(tilt) and `heightCm` lifts a point up the screen by sin(tilt).
 *   `toWorld` inverts the ground plane (height 0), which is what pointer picking needs.
 * At zoom 1 the focus is ignored and the arena is centred in the padded area; at zoom > 1 the view centres on the
 * focus (the arena centre when none is given), and on an axis where the zoomed arena is smaller than the padded
 * area it stays centred.
 */
export function viewTransform(
  camera: CameraConfig,
  viewport: { width: number; height: number },
  arenaCm: { width: number; height: number },
  focusCm?: { x: number; y: number } | null,
): ViewTransform {
  if (!(arenaCm.width > 0) || !(arenaCm.height > 0)) throw new InvariantError(`viewTransform: the arena needs a positive size, got ${arenaCm.width} × ${arenaCm.height} cm`);
  const pad = camera.padding;
  const innerW = Math.max(1, viewport.width - pad.left - pad.right);
  const innerH = Math.max(1, viewport.height - pad.top - pad.bottom);

  const tilt = camera.projection.kind === 'oblique' ? (Math.min(MAX_TILT_DEG, Math.max(0, camera.projection.tiltDeg)) * Math.PI) / 180 : 0;
  const squash = Math.cos(tilt);
  const lift = Math.sin(tilt);

  const fit = Math.min(innerW / arenaCm.width, innerH / (arenaCm.height * squash));
  const scale = fit * camera.zoom;
  const centreX = pad.left + innerW / 2;
  const centreY = pad.top + innerH / 2;

  const clampAxis = (focus: number, arena: number, innerPx: number, pxPerCm: number): number => {
    const half = innerPx / (2 * pxPerCm);
    if (arena <= 2 * half) return arena / 2;
    return Math.min(arena - half, Math.max(half, focus));
  };
  const wantX = camera.zoom > 1 && focusCm ? focusCm.x : arenaCm.width / 2;
  const wantY = camera.zoom > 1 && focusCm ? focusCm.y : arenaCm.height / 2;
  const fx = clampAxis(wantX, arenaCm.width, innerW, scale);
  const fy = clampAxis(wantY, arenaCm.height, innerH, scale * squash);

  return {
    pxPerMetre: scale * 100,
    toScreen(xCm: number, yCm: number, heightCm = 0): { x: number; y: number } {
      return { x: centreX + (xCm - fx) * scale, y: centreY + (yCm - fy) * scale * squash - heightCm * scale * lift };
    },
    toWorld(xPx: number, yPx: number): { x: number; y: number } {
      return { x: fx + (xPx - centreX) / scale, y: fy + (yPx - centreY) / (scale * squash) };
    },
  };
}
