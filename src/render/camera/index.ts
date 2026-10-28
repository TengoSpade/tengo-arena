/**
 * Camera and projection (05-technical-m2 §A5; WP-M2C implements). PURE, so the scene, pointer hit-testing
 * and tests share one transform. The projection is configuration, not code paths: the owner has not chosen
 * the camera (art §12 Q4; owner question Q55), and the sim and the render-state model are unaffected by it.
 */
import { notImplemented } from '../../core/util';
import type { CameraConfig, ViewTransform } from '../types';

/** M2 working assumption, OPEN (Q55): top-down orthographic, whole arena, no follow (04 §4). */
export const DEFAULT_CAMERA: CameraConfig = {
  projection: { kind: 'top-down' },
  zoom: 1,
  follow: null,
  padding: { top: 56, right: 16, bottom: 72, left: 16 },
  easeMs: 220,
};

/**
 * The world-to-screen transform for a viewport of `width` × `height` CSS px and an arena of
 * `arenaCm` (the log header's arena): letterboxed to fit inside the padding at zoom 1, centred on
 * `focusCm` (the followed unit) when zoomed, clamped so the arena edge never leaves the screen.
 */
export function viewTransform(
  camera: CameraConfig,
  viewport: { width: number; height: number },
  arenaCm: { width: number; height: number },
  focusCm?: { x: number; y: number } | null,
): ViewTransform {
  return notImplemented('render.viewTransform', camera, viewport, arenaCm, focusCm);
}
