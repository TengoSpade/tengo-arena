/**
 * ui/store — the UI's facade over core/game. Owner: WP6 (UI foundation).
 * CONTRACT (fixed, contract.ts): GameStore, StorePlatform, StoreContext,
 * useStore(). Implementation: createGameStore() in create-store.ts.
 * Additive helpers: the engine seam (useEngine, coreEngine), the AppStore
 * extras (quickSave, commandLog, dirty...), slot ids, UI settings and the
 * error/blocker text mapping.
 */
export { StoreContext, useStore, type GameStore, type StorePlatform } from './contract';
export {
  createGameStore,
  engineErrorFrom,
  isAutosaveSlot,
  MANUAL_SLOT_IDS,
  AUTOSAVE_SLOTS,
  type AppStore,
} from './create-store';
export { coreEngine, EngineContext, useEngine, safeView, type GameEngine } from './engine';
export { errorText, blockerText } from './messages';
export {
  settings,
  updateSettings,
  applySettingsToDocument,
  pacingStops,
  effectiveTheme,
  reducedMotion,
  DEFAULT_SETTINGS,
  type UiSettings,
  type PacingPreset,
  type PacingStops,
  type ThemeSetting,
} from './settings';
export { useAppStore } from './use-app-store';
export { clubContext, usePlayerClub, fighterViewOf, type ClubContext } from './views';
export { buildDigest, newsToDigest, needsActionCount, DIGEST_LIMIT, NEEDS_ACTION_LIMIT, type DigestItem, type DigestKind } from './digest';
export { blockerTarget } from './digest-targets';
