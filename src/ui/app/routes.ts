/**
 * Route table: every M1 screen, pre-registered so screen packages never edit
 * this file. Owner: WP6 (may change presentation fields, not ids or paths
 * without telling WP7). Screens are lazy-loaded (one chunk each).
 *
 * Hash routes: "#/<path>" with ":param" segments, e.g. "#/fighter/f-12".
 */
import type { ComponentType } from 'preact';

export interface ScreenProps {
  /** Route params, e.g. { id: 'f-12' }. */
  params: Readonly<Record<string, string>>;
}

export type RouteId =
  | 'home'
  | 'new-game'
  | 'club-select'
  | 'squad'
  | 'fighter'
  | 'codex'
  | 'league'
  | 'fixtures'
  | 'match-report'
  | 'market'
  | 'finances'
  | 'season-review'
  | 'saves'
  | 'settings'
  | 'between-rounds'
  // M2 (05-technical-m2 §A7): the arena viewer, live (the player's match being watched) and replay.
  | 'arena'
  | 'replay';

export interface RouteDef {
  id: RouteId;
  path: string;
  /** Work package that owns the screen folder (src/ui/screens/<id>); M2 screens: WP-M2E (src/ui/screens/arena). */
  owner: 'WP6' | 'WP7' | 'WP-M2E';
  /** Shown in the side navigation. */
  nav: boolean;
  load: () => Promise<{ default: ComponentType<ScreenProps> }>;
}

export const ROUTES: readonly RouteDef[] = [
  { id: 'home', path: 'home', owner: 'WP6', nav: true, load: () => import('../screens/home') },
  { id: 'new-game', path: 'new-game', owner: 'WP6', nav: false, load: () => import('../screens/new-game') },
  { id: 'club-select', path: 'club-select', owner: 'WP6', nav: false, load: () => import('../screens/club-select') },
  { id: 'squad', path: 'squad', owner: 'WP6', nav: true, load: () => import('../screens/squad') },
  { id: 'fighter', path: 'fighter/:id', owner: 'WP6', nav: false, load: () => import('../screens/fighter') },
  { id: 'codex', path: 'codex', owner: 'WP6', nav: true, load: () => import('../screens/codex') },
  { id: 'league', path: 'league', owner: 'WP7', nav: true, load: () => import('../screens/league') },
  { id: 'fixtures', path: 'fixtures', owner: 'WP7', nav: true, load: () => import('../screens/fixtures') },
  { id: 'match-report', path: 'match/:fixtureId', owner: 'WP7', nav: false, load: () => import('../screens/match-report') },
  { id: 'market', path: 'market', owner: 'WP7', nav: true, load: () => import('../screens/market') },
  { id: 'finances', path: 'finances', owner: 'WP7', nav: true, load: () => import('../screens/finances') },
  { id: 'season-review', path: 'season-review', owner: 'WP7', nav: false, load: () => import('../screens/season-review') },
  { id: 'saves', path: 'saves', owner: 'WP7', nav: true, load: () => import('../screens/saves') },
  { id: 'settings', path: 'settings', owner: 'WP7', nav: true, load: () => import('../screens/settings') },
  { id: 'between-rounds', path: 'between-rounds', owner: 'WP7', nav: false, load: () => import('../screens/between-rounds') },
  { id: 'arena', path: 'arena', owner: 'WP-M2E', nav: false, load: () => import('../screens/arena') },
  // "#/replay/<fixtureId>?round=2&tick=340" (round and tick optional: a key moment of the report jumps there, 04 ui-report).
  { id: 'replay', path: 'replay/:fixtureId', owner: 'WP-M2E', nav: false, load: () => import('../screens/arena/replay') },
];

/**
 * Match "#/fighter/f-12" against the table. A query ("#/codex?class=oathguard")
 * adds its keys to params (path params win).
 */
export function matchRoute(hash: string): { route: RouteDef; params: Record<string, string> } | null {
  const raw = hash.replace(/^#\/?/, '');
  const q = raw.indexOf('?');
  const path = q >= 0 ? raw.slice(0, q) : raw;
  const query = q >= 0 ? new URLSearchParams(raw.slice(q + 1)) : null;
  const parts = path.split('/').filter(Boolean);
  for (const route of ROUTES) {
    const pattern = route.path.split('/');
    if (pattern.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    pattern.forEach((seg, i) => {
      const part = parts[i]!;
      if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(part);
      else if (seg !== part) ok = false;
    });
    if (ok) {
      if (query) for (const [k, v] of query) if (!(k in params)) params[k] = v;
      return { route, params };
    }
  }
  return null;
}

/** Hash for a route id with params, e.g. hrefFor('fighter', { id: 'f-12' }) -> "#/fighter/f-12". */
export function hrefFor(id: RouteId, params: Readonly<Record<string, string>> = {}, query?: Readonly<Record<string, string>>): string {
  const route = ROUTES.find((r) => r.id === id);
  if (!route) return '#/home';
  const path = route.path
    .split('/')
    .map((seg) => (seg.startsWith(':') ? encodeURIComponent(params[seg.slice(1)] ?? '') : seg))
    .join('/');
  const qs = query && Object.keys(query).length > 0 ? `?${new URLSearchParams(query as Record<string, string>).toString()}` : '';
  return `#/${path}${qs}`;
}
