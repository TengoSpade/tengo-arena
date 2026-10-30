/**
 * Test and preview wrapper: the fake store, WP7's fake engine views and the
 * app's shortcut listener (as the WP6 frame installs it).
 * Never import from production code.
 */
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { installShortcuts } from '../../../app/shortcuts';
import { EngineContext, StoreContext, type GameStore } from '../../../store';
import { fakeEngine } from './fake-core';

export function Providers({ store, children, shortcuts = true }: { store: GameStore; children: ComponentChildren; shortcuts?: boolean }) {
  useEffect(() => (shortcuts ? installShortcuts(() => ({})) : undefined), [shortcuts]);
  return (
    <StoreContext.Provider value={store}>
      <EngineContext.Provider value={fakeEngine()}>{children}</EngineContext.Provider>
    </StoreContext.Provider>
  );
}
