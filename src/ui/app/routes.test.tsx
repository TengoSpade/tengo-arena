import { cleanup, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { ROUTES, matchRoute } from './routes';

afterEach(cleanup);

describe('routes', () => {
  it('match hash paths with params', () => {
    expect(matchRoute('#/fighter/f-12')).toMatchObject({ route: { id: 'fighter' }, params: { id: 'f-12' } });
    expect(matchRoute('#/squad')?.route.id).toBe('squad');
    expect(matchRoute('#/nope')).toBeNull();
  });

  it('every route has a unique id and path and a loadable screen', async () => {
    expect(new Set(ROUTES.map((r) => r.id)).size).toBe(ROUTES.length);
    expect(new Set(ROUTES.map((r) => r.path)).size).toBe(ROUTES.length);
    for (const route of ROUTES) {
      const { default: Screen } = await route.load();
      const { getByTestId, unmount } = render(<Screen params={{}} />);
      expect(getByTestId(`screen-${route.id}`)).toBeTruthy();
      unmount();
    }
  });
});
