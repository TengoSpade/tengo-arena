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
  | 'settings';

export interface RouteDef {
  id: RouteId;
  path: string;
  /** Work package that owns the screen folder (src/ui/screens/<id>). */
  owner: 'WP6' | 'WP7';
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
];

/** Match "#/fighter/f-12" against the table. */
export function matchRoute(hash: string): { route: RouteDef; params: Record<string, string> } | null {
  const path = hash.replace(/^#\/?/, '');
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
    if (ok) return { route, params };
  }
  return null;
}
