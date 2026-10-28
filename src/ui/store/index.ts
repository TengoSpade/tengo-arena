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
  MATCH_PAUSED,
  isTicketSlot,
  slotName,
  MANUAL_SLOT_IDS,
  AUTOSAVE_ROUND_SLOT,
  AUTOSAVE_SLOTS,
  type AppStore,
} from './create-store';
export { coreEngine, EngineContext, useEngine, safeView, type GameEngine } from './engine';
export { matchDayFacade, useMatchDay, type MatchDayFacade, type PendingLevelUps } from './match-day';
// M2 contract (05-technical-m2 §A7): the arena viewer's facade (stubs until WP-M2E).
export { arenaFacade, useArena, MATCH_WATCHING, WATCH_NOT_SHOWN, WATCH_MISMATCH, SAVE_ROUND_FAILED, type ArenaFacade, type ArenaSettings, type WatchPreference } from './arena';
export { DEFAULT_ARENA_SETTINGS } from './arena-settings';
export { errorText, blockerText } from './messages';
export {
  settings,
  updateSettings,
  updateArenaSettings,
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
// The digest's copy lives in store/digest.ts (imported directly by Home, kept out of the main bundle).
export { needsActionNow, NEEDS_ACTION_LIMIT } from './digest-flags';
export { blockerTarget } from './digest-targets';
