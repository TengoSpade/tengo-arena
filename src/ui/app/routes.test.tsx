import { cleanup, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders, createTestStore } from '../debug/test-store';
import { ROUTES, hrefFor, matchRoute } from './routes';

// Settings › Tickets asks the dev-server plugin for its folder; there is no server here.
beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 }))));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('routes', () => {
  it('match hash paths with params and queries', () => {
    expect(matchRoute('#/fighter/f-12')).toMatchObject({ route: { id: 'fighter' }, params: { id: 'f-12' } });
    expect(matchRoute('#/squad')?.route.id).toBe('squad');
    expect(matchRoute('#/codex?class=oathguard')).toMatchObject({ route: { id: 'codex' }, params: { class: 'oathguard' } });
    expect(matchRoute('#/nope')).toBeNull();
    expect(hrefFor('fighter', { id: 'f-12' })).toBe('#/fighter/f-12');
    expect(hrefFor('match-report', { fixtureId: 'lg:1:t:MW1:a:b' })).toBe('#/match/lg%3A1%3At%3AMW1%3Aa%3Ab');
  });

  it('every route has a unique id and path and a loadable screen', async () => {
    expect(new Set(ROUTES.map((r) => r.id)).size).toBe(ROUTES.length);
    expect(new Set(ROUTES.map((r) => r.path)).size).toBe(ROUTES.length);
    const { store } = createTestStore({ world: 'dev', weekIndex: 11 });
    const fighterId = store.game.value!.clubs[store.game.value!.playerClubId!]!.lineup.fighters[0]!.fighterId;
    for (const route of ROUTES) {
      const { default: Screen } = await route.load();
      const params: Record<string, string> = route.id === 'fighter' ? { id: fighterId } : {};
      const { getByTestId, unmount } = render(
        <TestProviders store={store}>
          <Screen params={params} />
        </TestProviders>,
      );
      expect(getByTestId(`screen-${route.id}`)).toBeTruthy();
      unmount();
    }
  });
});
