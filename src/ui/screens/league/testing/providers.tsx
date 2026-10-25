/**
 * Test and preview wrapper: the fake store plus WP7's fake engine views.
 * Never import from production code.
 */
import type { ComponentChildren } from 'preact';
import { EngineContext, StoreContext, type GameStore } from '../../../store';
import { fakeEngine } from './fake-core';

export function Providers({ store, children }: { store: GameStore; children: ComponentChildren }) {
  return (
    <StoreContext.Provider value={store}>
      <EngineContext.Provider value={fakeEngine()}>{children}</EngineContext.Provider>
    </StoreContext.Provider>
  );
}
