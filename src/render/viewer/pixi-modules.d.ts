/**
 * Two PixiJS modules the idle prefetch names (prefetchViewerChunks): the browser environment (a public subpath without a
 * types condition) and the WebGL renderer (aliased in vite.config.ts, because the package does not export the file).
 */
declare module 'pixi.js/browser';
declare module 'pixi-webgl-renderer' {
  export { WebGLRenderer } from 'pixi.js';
}
