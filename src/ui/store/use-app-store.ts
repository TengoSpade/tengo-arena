import { useStore } from './contract';
import type { AppStore } from './create-store';

/**
 * The store with its additive AppStore members (quickSave, dirty, commandLog...).
 * Fake stores in tests that only implement GameStore get safe defaults
 * through optional chaining at the call sites; prefer useStore() in screens.
 */
export function useAppStore(): Partial<AppStore> & ReturnType<typeof useStore> {
  return useStore() as Partial<AppStore> & ReturnType<typeof useStore>;
}
