/**
 * Host-element helpers: resolution from the device pixel ratio, the interface scale, DPR change watching.
 * DOM only, no PixiJS.
 */

/** Canvas resolution: min(devicePixelRatio, maxResolution), never below 1 (a zoomed-out browser keeps full sharpness). */
export function canvasResolution(devicePixelRatio: number, maxResolution: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const cap = Number.isFinite(maxResolution) && maxResolution >= 1 ? maxResolution : 2;
  return Math.max(1, Math.min(dpr, cap));
}

/**
 * Call `onChange` when the device pixel ratio changes (the window moved to another monitor, the browser zoom
 * changed). Re-arms itself on each change. Returns the stop function.
 */
export function watchDevicePixelRatio(onChange: (dpr: number) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  let query: MediaQueryList | null = null;
  let stopped = false;
  const handler = (): void => {
    if (stopped) return;
    arm();
    onChange(window.devicePixelRatio);
  };
  const arm = (): void => {
    query?.removeEventListener('change', handler);
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener('change', handler);
  };
  arm();
  return () => {
    stopped = true;
    query?.removeEventListener('change', handler);
    query = null;
  };
}
