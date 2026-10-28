/**
 * How the viewer destroys display objects. PixiJS v8's `Graphics.destroy(options)` destroys the context it owns only
 * when called with NO options, or with `context: true`: `destroy({ children: true })` leaves every child Graphics'
 * context (and the renderer's GPU data for it) alive, which grew the heap by about 0.65 MB per round (found by the
 * 20-round teardown check). Always destroy with this.
 */
export const DESTROY_ALL = { children: true, context: true } as const;
