/**
 * Hash router (tech-002): `#/<path>` with the route table of routes.ts.
 * `currentHash` is a signal so the frame and screens re-render on change.
 */
import { signal } from '@preact/signals';
import { matchRoute, type RouteDef } from './routes';

const initial = typeof location !== 'undefined' ? location.hash : '';
export const currentHash = signal(initial || '#/home');
let depth = 0;

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    currentHash.value = location.hash || '#/home';
  });
}

/** Navigate to "#/squad" (or "squad"). Pushes browser history so Alt ← and Esc go back. */
export function navigate(path: string): void {
  const hash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
  if (typeof location === 'undefined') {
    currentHash.value = hash;
    return;
  }
  if (location.hash === hash) {
    currentHash.value = hash;
    return;
  }
  depth += 1;
  location.hash = hash;
  currentHash.value = hash;
}

/** Back to the previous screen (Esc, Alt ←); Home when there is no in-app history. */
export function goBack(fallback = '#/home'): void {
  if (depth > 0 && typeof history !== 'undefined') {
    depth -= 1;
    history.back();
  } else navigate(fallback);
}

export interface CurrentRoute {
  route: RouteDef | null;
  params: Record<string, string>;
  hash: string;
}

export function useRoute(): CurrentRoute {
  const hash = currentHash.value;
  const m = matchRoute(hash);
  return { route: m?.route ?? null, params: m?.params ?? {}, hash };
}
