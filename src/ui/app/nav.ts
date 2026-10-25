/** Side navigation (04 §6.1): Home 1 · Squad 2 · Fixtures 3 · League 4 · Market 5 · Finances 6 · Class codex 7; footer Save / Load, Settings. */
import type { IconName } from '../components/Icon';
import type { TextKey } from '../text';
import type { RouteId } from './routes';

export interface NavItem {
  id: RouteId;
  label: TextKey;
  icon: IconName;
  href: string;
  key?: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', label: 'nav.home', icon: 'home', href: '#/home', key: '1' },
  { id: 'squad', label: 'nav.squad', icon: 'squad', href: '#/squad', key: '2' },
  { id: 'fixtures', label: 'nav.fixtures', icon: 'fixtures', href: '#/fixtures', key: '3' },
  { id: 'league', label: 'nav.league', icon: 'league', href: '#/league', key: '4' },
  { id: 'market', label: 'nav.market', icon: 'market', href: '#/market', key: '5' },
  { id: 'finances', label: 'nav.finances', icon: 'finances', href: '#/finances', key: '6' },
  { id: 'codex', label: 'nav.codex', icon: 'codex', href: '#/codex', key: '7' },
];

export const NAV_FOOTER: readonly NavItem[] = [
  { id: 'saves', label: 'nav.saves', icon: 'save', href: '#/saves', key: 's' },
  { id: 'settings', label: 'nav.settings', icon: 'settings', href: '#/settings' },
];

/** Which nav item a route highlights (the fighter profile belongs to Squad, a report to Fixtures). */
export function navOwner(routeId: RouteId | null): RouteId | null {
  if (routeId === 'fighter') return 'squad';
  if (routeId === 'match-report') return 'fixtures';
  if (routeId === 'season-review') return 'league';
  return routeId;
}
